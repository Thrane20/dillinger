import { NextRequest, NextResponse } from 'next/server';
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

// POST /api/launch/[id]/registry-setup - Run registry setup scripts for Wine games
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

    // Check if game is installed
    if (game.installation?.status !== 'installed') {
      return NextResponse.json(
        { error: 'Game must be installed first' },
        { status: 400 }
      );
    }

    if (!game.platformId) {
      return NextResponse.json(
        { error: 'Game has no platform configured' },
        { status: 400 }
      );
    }

    // Get platform (checks user overrides, then bundled defaults)
    const platform = await storage.readPlatform<Platform>(game.platformId);
    if (!platform) {
      return NextResponse.json(
        { error: 'Platform not found' },
        { status: 404 }
      );
    }

    // Run registry setup
    const result = await docker.runRegistrySetup({ game, platform });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
      });
    } else {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error in registry-setup endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to run registry setup', details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
