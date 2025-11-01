import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { JSONStorageService } from '../services/storage.js';
import { DockerService } from '../services/docker-service.js';
import type { Game, Platform, GameSession } from '@dillinger/shared';

const router = Router();
const storage = JSONStorageService.getInstance();
const docker = DockerService.getInstance();

/**
 * GET /api/games
 * List all games
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const games = await storage.listEntities<Game>('games');
    return res.status(200).json({
      success: true,
      games,
    });
  } catch (error: any) {
    console.error('Error listing games:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message,
    });
  }
});

/**
 * GET /api/games/:id
 * Get a specific game by ID or slug
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const gameId = req.params.id;
    if (!gameId) {
      return res.status(400).json({ error: 'Game ID required' });
    }
    
    // Try direct lookup first
    let game = await storage.readEntity<Game>('games', gameId);
    
    // If not found, search by slug
    if (!game) {
      const allGames = await storage.listEntities<Game>('games');
      game = allGames.find(g => g.slug === gameId) || null;
    }
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    return res.status(200).json({
      success: true,
      game,
    });
  } catch (error: any) {
    console.error('Error getting game:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message,
    });
  }
});

/**
 * POST /api/games/:id/launch
 * Launch a game in a Docker container by ID or slug
 */
router.post('/:id/launch', async (req: Request, res: Response) => {
  try {
    const gameId = req.params.id;
    if (!gameId) {
      return res.status(400).json({ error: 'Game ID required' });
    }

    // Get game from storage (try direct lookup first, then by slug)
    let game = await storage.readEntity<Game>('games', gameId);
    if (!game) {
      const allGames = await storage.listEntities<Game>('games');
      game = allGames.find(g => g.slug === gameId) || null;
    }
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Get platform from storage
    const platform = await storage.readEntity<Platform>('platforms', game.platformId);
    if (!platform) {
      return res.status(404).json({ error: 'Platform not found' });
    }

    // Check if platform is active
    if (!platform.isActive) {
      return res.status(400).json({ error: 'Platform is not active' });
    }

    // Create a new session
    const sessionId = uuidv4();
    const now = new Date().toISOString();

    const session: GameSession = {
      id: sessionId,
      gameId: game.id,
      platformId: platform.id,
      status: 'starting',
      display: {
        method: platform.displayStreaming.method,
      },
      performance: {
        startTime: now,
      },
      settings: {
        gameSettings: game.settings,
        platformSettings: platform.configuration,
      },
      created: now,
      updated: now,
    };

    // Save session to storage
    await storage.writeEntity('sessions', sessionId, session);

    // Launch the game container
    try {
      const containerInfo = await docker.launchGame({
        game,
        platform,
        sessionId,
      });

      // Update session with container info
      session.status = 'running';
      session.containerId = containerInfo.containerId;
      session.updated = new Date().toISOString();
      await storage.writeEntity('sessions', sessionId, session);

      // Update game metadata with play tracking
      // Re-read the game to get the latest playCount (avoid race conditions)
      let currentGame = await storage.readEntity<Game>('games', gameId);
      if (!currentGame && game.slug) {
        currentGame = await storage.readEntity<Game>('games', game.slug);
      }
      
      if (currentGame) {
        const updatedGame = {
          ...currentGame,
          metadata: {
            ...currentGame.metadata,
            lastPlayed: now,
            playCount: (currentGame.metadata?.playCount || 0) + 1,
          },
        };
        
        // Determine the storage file key (could be slug or id)
        let storageKey = currentGame.id;
        if (currentGame.slug) {
          // Check if file exists with slug as key
          const slugFile = await storage.readEntity<Game>('games', currentGame.slug);
          if (slugFile && slugFile.id === currentGame.id) {
            storageKey = currentGame.slug;
          }
        }
        
        await storage.writeEntity('games', storageKey, updatedGame);
      }

      return res.status(200).json({
        success: true,
        session: {
          id: session.id,
          gameId: session.gameId,
          status: session.status,
          containerId: session.containerId,
        },
      });
    } catch (error: any) {
      // Update session with error
      session.status = 'error';
      session.errors = [
        {
          timestamp: new Date().toISOString(),
          message: error.message || 'Failed to launch game',
        },
      ];
      session.updated = new Date().toISOString();
      await storage.writeEntity('sessions', sessionId, session);

      return res.status(500).json({
        error: 'Failed to launch game',
        details: error.message,
        sessionId: session.id,
      });
    }
  } catch (error: any) {
    console.error('Error in launch endpoint:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message,
    });
  }
});

/**
 * POST /api/games/:id/stop
 * Stop a running game session
 */
router.post('/:id/stop', async (req: Request, res: Response) => {
  try {
    const gameId = req.params.id;
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    // Get session from storage
    const session = await storage.readEntity<GameSession>('sessions', sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.gameId !== gameId) {
      return res.status(400).json({ error: 'Session does not belong to this game' });
    }

    if (!session.containerId) {
      return res.status(400).json({ error: 'No container associated with this session' });
    }

    // Stop the container
    try {
      await docker.stopGame(session.containerId);

      // Update session with end time and duration
      session.status = 'stopped';
      session.performance.endTime = new Date().toISOString();
      session.performance.duration = Math.floor(
        (new Date(session.performance.endTime).getTime() - 
         new Date(session.performance.startTime).getTime()) / 1000
      );
      session.updated = new Date().toISOString();
      await storage.writeEntity('sessions', sessionId, session);

      // Update game's total play time (convert seconds to hours)
      const durationHours = session.performance.duration / 3600;
      
      // Re-read game from storage right before updating to avoid race conditions
      // (try direct lookup first, then by slug)
      let currentGame = await storage.readEntity<Game>('games', gameId);
      if (!currentGame) {
        const allGames = await storage.listEntities<Game>('games');
        currentGame = allGames.find(g => g.slug === gameId) || null;
      }
      
      if (currentGame) {
        const updatedGame = {
          ...currentGame,
          metadata: {
            ...currentGame.metadata,
            playTime: (currentGame.metadata?.playTime || 0) + durationHours,
          },
        };
        
        // Determine the storage file key (could be slug or id)
        let storageKey = currentGame.id;
        if (currentGame.slug) {
          // Check if file exists with slug as key
          const slugFile = await storage.readEntity<Game>('games', currentGame.slug);
          if (slugFile && slugFile.id === currentGame.id) {
            storageKey = currentGame.slug;
          }
        }
        
        await storage.writeEntity('games', storageKey, updatedGame);
      }

      return res.status(200).json({
        success: true,
        session: {
          id: session.id,
          status: session.status,
          duration: session.performance.duration,
        },
      });
    } catch (error: any) {
      return res.status(500).json({
        error: 'Failed to stop game',
        details: error.message,
      });
    }
  } catch (error: any) {
    console.error('Error in stop endpoint:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message,
    });
  }
});

/**
 * GET /api/games/:id/sessions
 * Get all sessions for a game
 */
router.get('/:id/sessions', async (req: Request, res: Response) => {
  try {
    const gameId = req.params.id;
    const allSessions = await storage.listEntities<GameSession>('sessions');
    const sessions = allSessions.filter(s => s.gameId === gameId);
    
    return res.status(200).json({
      success: true,
      sessions,
    });
  } catch (error: any) {
    console.error('Error in sessions endpoint:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message,
    });
  }
});

export default router;
