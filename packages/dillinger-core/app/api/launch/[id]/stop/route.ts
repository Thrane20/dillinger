import { NextRequest, NextResponse } from 'next/server';
import { JSONStorageService } from '@/lib/services/storage';
import { DockerService } from '@/lib/services/docker-service';
import { collectSessionScreenshots } from '@/lib/services/session-screenshots';
import type { Game, GameSession } from '@dillinger/shared';

const storage = JSONStorageService.getInstance();
const docker = DockerService.getInstance();

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

// POST /api/launch/[id]/stop - Stop a running game session
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: gameId } = await params;
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      );
    }

    // Get session from storage
    const session = await storage.readEntity<GameSession>('sessions', sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (session.gameId !== gameId) {
      return NextResponse.json(
        { error: 'Session does not belong to this game' },
        { status: 400 }
      );
    }

    if (!session.containerId) {
      return NextResponse.json(
        { error: 'No container associated with this session' },
        { status: 400 }
      );
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

      const { game: currentGame, fileKey } = await findGameAndFileKey(gameId);
      if (currentGame && session.performance.startTime && session.performance.endTime) {
        const gameIdentifier = currentGame.slug || currentGame.id;
        session.screenshots = await collectSessionScreenshots({
          dillingerRoot: storage.getDillingerRoot(),
          gameId: currentGame.id,
          gameIdentifier,
          startTime: session.performance.startTime,
          endTime: session.performance.endTime,
        });
      }
      await storage.writeEntity('sessions', sessionId, session);

      // Update game's total play time
      const durationHours = session.performance.duration / 3600;

      if (currentGame && fileKey) {
        const updatedGame = {
          ...currentGame,
          metadata: {
            ...currentGame.metadata,
            playTime: (currentGame.metadata?.playTime || 0) + durationHours,
          },
        };
        
        await storage.writeEntity('games', fileKey, updatedGame);
      }

      return NextResponse.json({
        success: true,
        session: {
          id: session.id,
          status: session.status,
          duration: session.performance.duration,
        },
      });
    } catch (error) {
      return NextResponse.json(
        { error: 'Failed to stop game', details: error instanceof Error ? error.message : "Unknown error" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in stop endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
