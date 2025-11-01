import { Router } from 'express';
import type { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { JSONStorageService } from '../services/storage.js';

const router = Router();
const storage = JSONStorageService.getInstance();

/**
 * Generate a URL-friendly slug from a title
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces, underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Helper to find a game and its storage filename
 * Returns { game, fileKey } or { game: null, fileKey: null }
 */
async function findGameAndFileKey(id: string): Promise<{ game: any | null; fileKey: string | null }> {
  // Try to read directly first (for slug-based or direct ID match)
  const directGame = await storage.readEntity<any>('games', id);
  if (directGame) {
    return { game: directGame, fileKey: id };
  }
  
  // Not found by direct lookup - search through all games
  // This handles the case where filename doesn't match the game's ID field
  // Also check for slug matches
  const allGames = await storage.listEntities<any>('games');
  const foundGame = allGames.find((g: any) => g.id === id || g.slug === id);
  
  if (!foundGame) {
    return { game: null, fileKey: null };
  }
  
  // Found the game - now we need to determine its filename
  // For now, games are stored with their ID as the filename
  // So if we found it, the fileKey is the game's ID
  return { game: foundGame, fileKey: foundGame.id };
}

// Validation rules for game creation/update
const gameValidation = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('filePath').optional().trim(),
  body('platformId').optional().trim(),
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
    const { id } = req.params;
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Game ID is required',
      });
      return;
    }

    const { game } = await findGameAndFileKey(id);
    
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
router.post('/', gameValidation, async (req: Request, res: Response) => {
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
      slug,
      filePath,
      platformId,
      collectionIds = [],
      tags = [],
      metadata = {},
      settings = {},
    } = req.body;

    // Generate slug if not provided
    const gameSlug = slug || slugify(title);

    // Create new game object
    const game = {
      id: uuidv4(),
      slug: gameSlug,
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
router.put('/:id', gameValidation, async (req: Request, res: Response) => {
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

    const { id } = req.params;
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Game ID is required',
      });
      return;
    }

    const { game: existingGame, fileKey } = await findGameAndFileKey(id);
    
    if (!existingGame || !fileKey) {
      res.status(404).json({
        success: false,
        error: 'Game not found',
      });
      return;
    }

    // If title changed and slug wasn't explicitly provided, regenerate slug
    let newSlug = req.body.slug;
    if (req.body.title && req.body.title !== existingGame.title && !req.body.slug) {
      newSlug = slugify(req.body.title);
    }

    const updatedGame = {
      ...existingGame,
      ...req.body,
      ...(newSlug ? { slug: newSlug } : {}),
      id: existingGame.id, // Preserve original ID
      created: existingGame.created, // Preserve creation date
      updated: new Date().toISOString(),
    };

    await storage.writeEntity('games', fileKey, updatedGame);

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
    const { id } = req.params;
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Game ID is required',
      });
      return;
    }

    const { game, fileKey } = await findGameAndFileKey(id);
    
    if (!game || !fileKey) {
      res.status(404).json({
        success: false,
        error: 'Game not found',
      });
      return;
    }

    await storage.deleteEntity('games', fileKey);

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
