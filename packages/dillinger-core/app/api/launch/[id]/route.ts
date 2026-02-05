import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { JSONStorageService } from '@/lib/services/storage';
import { DockerService } from '@/lib/services/docker-service';
import { StreamingGraphService } from '@/lib/services/streaming-graph';
import { validateGraphStore } from '@/lib/services/streaming-graph-validator';
import { GameSessionsService } from '@/lib/services/game-sessions';
import { collectSessionScreenshots } from '@/lib/services/session-screenshots';
import { logger } from '@/lib/services/logger';
import type { Game, Platform, GameSession } from '@dillinger/shared';
import {
  migrateGameToMultiPlatform,
  getDefaultPlatformConfig,
  getPlatformConfig,
} from '@dillinger/shared';

const storage = JSONStorageService.getInstance();
const docker = DockerService.getInstance();
const gameSessions = GameSessionsService.getInstance();
const graphService = StreamingGraphService.getInstance();

/**
 * Helper to find a game and its storage filename
 */
async function findGameAndFileKey(id: string): Promise<{ game: Game | null; fileKey: string | null }> {
  const directGame = await storage.readEntity<Game>('games', id);
  if (directGame) {
    return { game: directGame, fileKey: id };
  }
  
  const allGames = await storage.listEntities<Game>('games');
  const foundGame = allGames.find((g) => g.id === id || g.slug === id);
  
  if (!foundGame) {
    return { game: null, fileKey: null };
  }
  
  return { game: foundGame, fileKey: foundGame.id };
}

// POST /api/launch/[id] - Launch a game in a Docker container
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: gameId } = await params;
    const body = await request.json();
    const { mode = 'local', platformId, keepContainer = false, keepAlive = false } = body;

    logger.info('🎮 Launch request received', {
      gameId,
      mode,
      platformId: platformId || 'auto',
      keepContainer,
      keepAlive,
      requestId: request.headers.get('x-request-id') || undefined,
    });
    
    if (!gameId) {
      return NextResponse.json(
        { error: 'Game ID required' },
        { status: 400 }
      );
    }

    // Get game from storage
    const { game, fileKey } = await findGameAndFileKey(gameId);
    
    if (!game || !fileKey) {
      logger.warn('Game not found for launch request', { gameId });
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    logger.debug('Game resolved for launch', {
      requestedId: gameId,
      storedId: fileKey,
      slug: game.slug,
      title: game.title,
    });

    // Migrate game to multi-platform format
    const migratedGame = migrateGameToMultiPlatform(game);
    
    // Determine which platform to use
    let targetPlatformId: string;
    let platformConfig;
    
    if (platformId) {
      platformConfig = getPlatformConfig(migratedGame, platformId);
      if (!platformConfig) {
        logger.warn('Requested platform not configured for game', { gameId, platformId });
        return NextResponse.json(
          { error: `Platform ${platformId} not configured for this game` },
          { status: 404 }
        );
      }
      targetPlatformId = platformId;
    } else {
      platformConfig = getDefaultPlatformConfig(migratedGame);
      if (!platformConfig) {
        logger.warn('No default platform configured for game', { gameId });
        return NextResponse.json(
          { error: 'No platform configured for this game' },
          { status: 400 }
        );
      }
      targetPlatformId = platformConfig.platformId;
    }

    // Get platform from storage (checks user overrides, then bundled defaults)
    const platform = await storage.readPlatform<Platform>(targetPlatformId);
    if (!platform) {
      logger.warn('Target platform not found in storage', { platformId: targetPlatformId, gameId });
      return NextResponse.json(
        { error: 'Platform not found' },
        { status: 404 }
      );
    }

    // Check if platform is active
    if (!platform.isActive) {
      logger.warn('Attempted to launch game on inactive platform', { gameId, platformId: platform.id });
      return NextResponse.json(
        { error: 'Platform is not active' },
        { status: 400 }
      );
    }

    logger.info('Using platform for launch', {
      gameId,
      platformId: platform.id,
      platformName: platform.name,
      mode,
    });

    // Block streaming launch if streaming graph validation fails
    if (mode === 'streaming') {
      const graphStore = await graphService.getGraphStore();
      const validation = validateGraphStore(graphStore);
      if (validation.status === 'blocking') {
        return NextResponse.json(
          {
            error: 'Streaming graph validation failed',
            validation,
          },
          { status: 400 }
        );
      }
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
        gameSettings: platformConfig.settings,
        platformSettings: platform.configuration,
      },
      created: now,
      updated: now,
    };

    // Save session to storage
    await storage.writeEntity('sessions', sessionId, session);
    await gameSessions.addSession(game.id, sessionId, platform.id);

    logger.info('Session created for launch', {
      sessionId,
      gameId: game.id,
      platformId: platform.id,
      mode,
    });

    // Launch the game container
    try {
      const gameForLaunch = {
        ...game,
        platformId: targetPlatformId,
        filePath: platformConfig.filePath || game.filePath,
        settings: platformConfig.settings,
        installation: platformConfig.installation || game.installation,
      };
      
      const containerInfo = await docker.launchGame({
        game: gameForLaunch,
        platform,
        sessionId,
        mode,
        keepContainer: keepContainer === true,
        keepAlive: keepAlive === true,
      });

      logger.info('Docker launch succeeded', {
        sessionId,
        gameId: game.id,
        platformId: platform.id,
        containerId: containerInfo.containerId,
      });

      // Update session with container info
      session.status = 'running';
      session.containerId = containerInfo.containerId;
      session.updated = new Date().toISOString();
      await storage.writeEntity('sessions', sessionId, session);
      await gameSessions.updateSessionStatus(game.id, sessionId, 'running', containerInfo.containerId);

      // Start monitoring the container asynchronously
      docker.monitorGameContainer(
        containerInfo.containerId,
        sessionId,
        async (exitCode) => {
          logger.info('Game container exited', {
            sessionId,
            gameId: game.id,
            exitCode,
          });
          
          try {
            const currentSession = await storage.readEntity<GameSession>('sessions', sessionId);
            if (currentSession) {
              currentSession.status = exitCode === 0 ? 'stopped' : 'error';
              currentSession.updated = new Date().toISOString();

              if (currentSession.performance) {
                currentSession.performance.endTime = new Date().toISOString();
              }

              if (currentSession.performance?.startTime && currentSession.performance?.endTime) {
                const gameIdentifier = game.slug || game.id;
                currentSession.screenshots = await collectSessionScreenshots({
                  dillingerRoot: storage.getDillingerRoot(),
                  gameId: game.id,
                  gameIdentifier,
                  startTime: currentSession.performance.startTime,
                  endTime: currentSession.performance.endTime,
                });
              }
              
              if (exitCode !== 0) {
                if (!currentSession.errors) {
                  currentSession.errors = [];
                }
                currentSession.errors.push({
                  timestamp: new Date().toISOString(),
                  message: `Container exited with code ${exitCode}`,
                });
              }
              
              await storage.writeEntity('sessions', sessionId, currentSession);
              logger.info('Session status updated after container exit', {
                sessionId,
                status: currentSession.status,
              });
              
              await gameSessions.endSession(game.id, sessionId, exitCode);
            }
          } catch (error) {
            console.error('Error updating session after container stop:', error);
          }
        }
      ).catch(err => {
        logger.error('Error in container monitoring', {
          sessionId,
          gameId: game.id,
          error: err instanceof Error ? err.message : err,
        });
      });

      // Update game metadata with play tracking
      const currentGame = await storage.readEntity<Game>('games', fileKey);
      
      if (currentGame) {
        const updatedGame = {
          ...currentGame,
          metadata: {
            ...currentGame.metadata,
            lastPlayed: now,
            playCount: (currentGame.metadata?.playCount || 0) + 1,
          },
        };
        
        await storage.writeEntity('games', fileKey, updatedGame);
      }

      logger.info('Launch request completed successfully', {
        sessionId,
        gameId: game.id,
        platformId: platform.id,
      });

      return NextResponse.json({
        success: true,
        session: {
          id: session.id,
          gameId: session.gameId,
          status: session.status,
          containerId: session.containerId,
        },
      });
    } catch (error) {
      // Update session with error
      logger.error('Failed to launch game container', {
        sessionId,
        gameId: game.id,
        platformId: platform.id,
        error: error instanceof Error ? error.message : error,
      });

      session.status = 'error';
      session.errors = [
        {
          timestamp: new Date().toISOString(),
          message: error instanceof Error ? error.message : 'Failed to launch game',
        },
      ];
      session.updated = new Date().toISOString();
      await storage.writeEntity('sessions', sessionId, session);

      return NextResponse.json(
        {
          error: 'Failed to launch game',
          details: error instanceof Error ? error.message : "Unknown error",
          sessionId: session.id,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('Unhandled error in launch endpoint', {
      error: error instanceof Error ? error.message : error,
    });
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// GET /api/launch/[id] - Get a specific game
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: gameId } = await params;
    if (!gameId) {
      return NextResponse.json(
        { error: 'Game ID required' },
        { status: 400 }
      );
    }
    
    const { game } = await findGameAndFileKey(gameId);
    
    if (!game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      game,
    });
  } catch (error) {
    console.error('Error getting game:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
