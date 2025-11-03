import { Router } from 'express';
import type { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { v4 as uuidv4 } from 'uuid';
import { JSONStorageService } from '../services/storage.js';
import { DockerService } from '../services/docker-service.js';
import type { InstallGameRequest, InstallGameResponse } from '@dillinger/shared';

const router = Router();
const storage = JSONStorageService.getInstance();
const dockerService = DockerService.getInstance();

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

    // Check if launch configuration was saved with a valid command
    // If so, mark the game as installed
    let installationUpdate = {};
    if (req.body.settings?.launch?.command) {
      // Extract install path from command if available, or use existing
      const installPath = existingGame.installation?.installPath;
      
      installationUpdate = {
        installation: {
          ...existingGame.installation,
          status: 'installed',
          installPath: installPath || existingGame.installation?.installPath,
          installedAt: existingGame.installation?.installedAt || new Date().toISOString(),
        }
      };
      
      console.log(`✅ Marking game "${req.body.title || existingGame.title}" as installed (launch config saved)`);
    }

    const updatedGame = {
      ...existingGame,
      ...req.body,
      ...installationUpdate,
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

// POST /api/games/:id/install - Install a game using Docker with GUI
router.post('/:id/install', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { installerPath, installPath, platformId } = req.body as InstallGameRequest;

    if (!id || !installerPath || !installPath || !platformId) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: installerPath, installPath, platformId',
      } as InstallGameResponse);
      return;
    }

    // Find the game
    const { game, fileKey } = await findGameAndFileKey(id);
    if (!game || !fileKey) {
      res.status(404).json({
        success: false,
        error: 'Game not found',
      } as InstallGameResponse);
      return;
    }

    // Get platform information
    const platform = await storage.readEntity<any>('platforms', platformId);
    if (!platform) {
      res.status(404).json({
        success: false,
        error: 'Platform not found',
      } as InstallGameResponse);
      return;
    }

    // Generate session ID for this installation
    const sessionId = uuidv4();

    console.log(`🎮 Starting game installation for: ${game.title}`);
    console.log(`  Installer: ${installerPath}`);
    console.log(`  Install target: ${installPath}`);
    console.log(`  Platform: ${platform.name}`);

    // Start installation container
    const containerInfo = await dockerService.installGame({
      installerPath,
      installPath,
      platform,
      sessionId,
    });

    // Update game with installation information
    const updatedGame = {
      ...game,
      installation: {
        status: 'installing' as const,
        installPath,
        installerPath,
        containerId: containerInfo.containerId,
        installMethod: 'automated' as const,
      },
      updated: new Date().toISOString(),
    };

    await storage.writeEntity('games', fileKey, updatedGame);

    console.log(`✓ Installation started with container: ${containerInfo.containerId}`);

    res.json({
      success: true,
      containerId: containerInfo.containerId,
      message: 'Installation started. The installation GUI should appear on your display.',
    } as InstallGameResponse);
  } catch (error) {
    console.error('Error starting game installation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start installation',
      message: error instanceof Error ? error.message : 'Unknown error',
    } as InstallGameResponse);
  }
});

// POST /api/games/:id/install/complete - Mark installation as complete
router.post('/:id/install/complete', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Game ID is required',
      });
      return;
    }

    const { success: installSuccess, error: installError } = req.body;

    const { game, fileKey } = await findGameAndFileKey(id);
    if (!game || !fileKey) {
      res.status(404).json({
        success: false,
        error: 'Game not found',
      });
      return;
    }

    const updatedGame = {
      ...game,
      installation: {
        ...game.installation,
        status: installSuccess ? ('installed' as const) : ('failed' as const),
        installedAt: installSuccess ? new Date().toISOString() : undefined,
        error: installError,
        containerId: undefined, // Clear container ID after completion
      },
      updated: new Date().toISOString(),
    };

    await storage.writeEntity('games', fileKey, updatedGame);

    console.log(`✓ Installation ${installSuccess ? 'completed' : 'failed'} for: ${game.title}`);

    res.json({
      success: true,
      data: updatedGame,
      message: installSuccess ? 'Installation completed successfully' : 'Installation failed',
    });
  } catch (error) {
    console.error('Error completing installation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update installation status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/games/:id/install/status - Check installation status
router.get('/:id/install/status', async (req: Request, res: Response) => {
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

    const installation = game.installation;
    if (!installation || !installation.containerId) {
      res.json({
        success: true,
        status: installation?.status || 'not_installed',
        isRunning: false,
      });
      return;
    }

    // Check if installation container is still running
    try {
      const containerResult = await dockerService.waitForInstallationComplete(installation.containerId);
      
      if (containerResult.success || containerResult.exitCode !== -1) {
        // Installation finished - scan for executables
        console.log(`🎮 Installation completed for ${game.title}, scanning for executables...`);
        
        const executables = await dockerService.scanForGameExecutables(installation.installPath || '');
        
        // Update game with installation completion and discovered executables
        const updatedGame = {
          ...game,
          installation: {
            ...installation,
            status: containerResult.success ? ('installed' as const) : ('failed' as const),
            installedAt: containerResult.success ? new Date().toISOString() : undefined,
            error: containerResult.success ? undefined : `Installation failed with exit code ${containerResult.exitCode}`,
            containerId: undefined, // Clear container ID
          },
          // Auto-set the most likely executable as filePath
          filePath: executables.length > 0 ? `${installation.installPath}/${executables[0]}` : game.filePath,
          // Auto-set working directory to installation path if empty
          settings: {
            ...game.settings,
            launch: {
              ...game.settings?.launch,
              workingDirectory: game.settings?.launch?.workingDirectory || installation.installPath || '',
            }
          },
          updated: new Date().toISOString(),
        };

        await storage.writeEntity('games', fileKey, updatedGame);

        res.json({
          success: true,
          status: updatedGame.installation?.status,
          isRunning: false,
          executables: executables,
          autoSelectedExecutable: executables.length > 0 ? executables[0] : null,
        });
      } else {
        // Still running
        res.json({
          success: true,
          status: 'installing',
          isRunning: true,
        });
      }
    } catch (error) {
      console.error('Error checking container status:', error);
      res.json({
        success: true,
        status: 'failed',
        isRunning: false,
        error: 'Failed to check installation status',
      });
    }
  } catch (error) {
    console.error('Error checking installation status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check installation status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/games/:id/shortcuts - Scan for Windows shortcuts (.lnk files)
router.get('/:id/shortcuts', async (req: Request, res: Response) => {
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
    if (!game || !game.installation?.installPath) {
      res.status(404).json({
        success: false,
        error: 'Game not found or not installed',
      });
      return;
    }

    const shortcuts = await dockerService.scanForShortcuts(game.installation.installPath);
    
    res.json({
      success: true,
      shortcuts: shortcuts,
    });
  } catch (error) {
    console.error('Error scanning for shortcuts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to scan for shortcuts',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/games/:id/shortcuts/parse - Parse a specific .lnk file
router.post('/:id/shortcuts/parse', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { shortcutPath } = req.body;
    
    if (!id || !shortcutPath) {
      res.status(400).json({
        success: false,
        error: 'Game ID and shortcut path are required',
      });
      return;
    }

    const { game } = await findGameAndFileKey(id);
    if (!game || !game.installation?.installPath) {
      res.status(404).json({
        success: false,
        error: 'Game not found or not installed',
      });
      return;
    }

    const shortcutInfo = await dockerService.parseShortcut(shortcutPath);
    
    res.json({
      success: true,
      shortcut: shortcutInfo,
    });
  } catch (error) {
    console.error('Error parsing shortcut:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to parse shortcut',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
