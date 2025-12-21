import { NextRequest, NextResponse } from 'next/server';
import { JSONStorageService } from '@/lib/services/storage';
import type { Game } from '@dillinger/shared';
import { migrateGameToMultiPlatform } from '@dillinger/shared';

const storage = JSONStorageService.getInstance();

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

// PUT /api/games/[id]/default-platform - Set default platform
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { platformId } = body;

    if (!id || !platformId) {
      return NextResponse.json(
        { success: false, error: 'Game ID and platformId are required' },
        { status: 400 }
      );
    }

    const { game, fileKey } = await findGameAndFileKey(id);
    if (!game || !fileKey) {
      return NextResponse.json(
        { success: false, error: 'Game not found' },
        { status: 404 }
      );
    }

    const migratedGame = migrateGameToMultiPlatform(game);

    // Check if platform exists
    if (!migratedGame.platforms.find(p => p.platformId === platformId)) {
      return NextResponse.json(
        { success: false, error: `Platform ${platformId} not configured for this game` },
        { status: 404 }
      );
    }

    // Update default platform
    const updatedGame = {
      ...migratedGame,
      defaultPlatformId: platformId,
      updated: new Date().toISOString(),
    };

    await storage.writeEntity('games', fileKey, updatedGame);

    return NextResponse.json({
      success: true,
      data: updatedGame,
      message: 'Default platform updated successfully',
    });
  } catch (error) {
    console.error('Error updating default platform:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update default platform',
        message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
