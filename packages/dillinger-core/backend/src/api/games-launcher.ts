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
 * Get a specific game
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const gameId = req.params.id;
    if (!gameId) {
      return res.status(400).json({ error: 'Game ID required' });
    }
    
    const game = await storage.readEntity<Game>('games', gameId);
    
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
 * Launch a game in a Docker container
 */
router.post('/:id/launch', async (req: Request, res: Response) => {
  try {
    const gameId = req.params.id;
    if (!gameId) {
      return res.status(400).json({ error: 'Game ID required' });
    }

    // Get game from storage
    const game = await storage.readEntity<Game>('games', gameId);
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

      // Update session
      session.status = 'stopped';
      session.performance.endTime = new Date().toISOString();
      session.performance.duration = Math.floor(
        (new Date(session.performance.endTime).getTime() - 
         new Date(session.performance.startTime).getTime()) / 1000
      );
      session.updated = new Date().toISOString();
      await storage.writeEntity('sessions', sessionId, session);

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
