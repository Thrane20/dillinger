import { NextRequest, NextResponse } from 'next/server';
import { JSONStorageService } from '@/lib/services/storage';
import type { Game } from '@dillinger/shared';
import { 
  migrateGameToMultiPlatform,
  setPlatformConfig,
} from '@dillinger/shared';

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

// POST /api/games/[id]/platforms - Add a platform configuration to a game
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { platformId, filePath, settings, installation } = body;

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

    // Add or update platform configuration
    const updatedGame = setPlatformConfig(game, platformId, {
      platformId,
      filePath,
      settings,
      installation,
    });

    await storage.writeEntity('games', fileKey, updatedGame);
    const migratedGame = migrateGameToMultiPlatform(updatedGame);

    return NextResponse.json({
      success: true,
      data: migratedGame,
      message: 'Platform configuration added successfully',
    });
  } catch (error) {
    console.error('Error adding platform configuration:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to add platform configuration',
        message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
