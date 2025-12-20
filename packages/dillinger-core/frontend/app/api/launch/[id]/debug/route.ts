import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { JSONStorageService } from '@/lib/services/storage';
import { DockerService } from '@/lib/services/docker-service';
import type { Game, Platform } from '@dillinger/shared';

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

// POST /api/launch/[id]/debug - Launch a debug container for troubleshooting
export async function POST(
  __request: NextRequest,
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

    // Get game from storage
    const { game } = await findGameAndFileKey(gameId);
    
    if (!game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    if (!game.platformId) {
      return NextResponse.json(
        { error: 'Game has no platform configured' },
        { status: 400 }
      );
    }

    // Get platform from storage
    const platform = await storage.readEntity<Platform>('platforms', game.platformId);
    if (!platform) {
      return NextResponse.json(
        { error: 'Platform not found' },
        { status: 404 }
      );
    }

    // Create a session ID for the debug container
    const sessionId = `debug-${uuidv4()}`;

    // Launch the debug container
    const containerInfo = await docker.launchDebugContainer({
      game,
      platform,
      sessionId,
    });

    return NextResponse.json({
      success: true,
      container: {
        containerId: containerInfo.containerId,
        status: containerInfo.status,
        execCommand: containerInfo.execCommand,
      },
      message: 'Debug container started. Use the execCommand to attach to it.',
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to launch debug container', details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
