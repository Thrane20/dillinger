import { NextRequest, NextResponse } from 'next/server';
import { JSONStorageService } from '@/lib/services/storage';
import type { Game } from '@dillinger/shared';

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

// POST /api/games/[id]/install/complete - Mark installation as complete
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Game ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { success: installSuccess, error: installError } = body;

    const { game, fileKey } = await findGameAndFileKey(id);
    if (!game || !fileKey) {
      return NextResponse.json(
        { success: false, error: 'Game not found' },
        { status: 404 }
      );
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

    return NextResponse.json({
      success: true,
      data: updatedGame,
      message: installSuccess ? 'Installation completed successfully' : 'Installation failed',
    });
  } catch (error) {
    console.error('Error completing installation:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update installation status',
        message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
