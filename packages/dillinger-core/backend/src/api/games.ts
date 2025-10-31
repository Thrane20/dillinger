import { Router } from 'express';
import type { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { JSONStorageService } from '../services/storage.js';

const router = Router();
const storage = JSONStorageService.getInstance();

// Validation rules for game creation
const createGameValidation = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('filePath').trim().notEmpty().withMessage('File path is required'),
  body('platformId').trim().notEmpty().withMessage('Platform ID is required'),
  body('collectionIds').optional().isArray().withMessage('Collection IDs must be an array'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  body('metadata').optional().isObject().withMessage('Metadata must be an object'),
];

// GET /api/games - List all games
router.get('/', async (_req: Request, res: Response) => {
  try {
    const games = await storage.listEntities('games');
    res.json({
      success: true,
      data: games,
      count: games.length,
    });
  } catch (error) {
    console.error('Error listing games:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list games',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/games/:id - Get a specific game
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const game = await storage.readEntity('games', req.params.id);
    
    if (!game) {
      res.status(404).json({
        success: false,
        error: 'Game not found',
      });
      return;
    }

    res.json({
      success: true,
      data: game,
    });
  } catch (error) {
    console.error('Error getting game:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get game',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/games - Create a new game
router.post('/', createGameValidation, async (req: Request, res: Response) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
      return;
    }

    const {
      title,
      filePath,
      platformId,
      collectionIds = [],
      tags = [],
      metadata = {},
      settings = {},
    } = req.body;

    // Create new game object
    const game = {
      id: uuidv4(),
      title,
      filePath,
      platformId,
      collectionIds,
      tags,
      metadata,
      fileInfo: {
        size: 0, // TODO: Get actual file size
        lastModified: new Date().toISOString(),
      },
      settings,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };

    // Save to storage
    await storage.writeEntity('games', game.id, game);

    res.status(201).json({
      success: true,
      data: game,
      message: 'Game added successfully',
    });
  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create game',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// PUT /api/games/:id - Update a game
router.put('/:id', createGameValidation, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
      });
      return;
    }

    const existingGame = await storage.readEntity('games', req.params.id);
    if (!existingGame) {
      res.status(404).json({
        success: false,
        error: 'Game not found',
      });
      return;
    }

    const updatedGame = {
      ...existingGame,
      ...req.body,
      id: req.params.id, // Preserve ID
      created: existingGame.created, // Preserve creation date
      updated: new Date().toISOString(),
    };

    await storage.writeEntity('games', req.params.id, updatedGame);

    res.json({
      success: true,
      data: updatedGame,
      message: 'Game updated successfully',
    });
  } catch (error) {
    console.error('Error updating game:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update game',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// DELETE /api/games/:id - Delete a game
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const game = await storage.readEntity('games', req.params.id);
    if (!game) {
      res.status(404).json({
        success: false,
        error: 'Game not found',
      });
      return;
    }

    await storage.deleteEntity('games', req.params.id);

    res.json({
      success: true,
      message: 'Game deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting game:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete game',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
