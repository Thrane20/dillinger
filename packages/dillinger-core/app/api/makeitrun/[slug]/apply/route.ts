import { NextRequest, NextResponse } from 'next/server';
import type { Game } from '@dillinger/shared';
import { JSONStorageService } from '@/lib/services/storage';
import { makeItRunService } from '@/lib/services/makeitrun-service';

const storage = JSONStorageService.getInstance();

async function findGameAndFileKey(id: string): Promise<{ game: Game | null; fileKey: string | null }> {
  const directGame = await storage.readEntity<Game>('games', id);
  if (directGame) {
    return { game: directGame, fileKey: id };
  }

  const allGames = await storage.listEntities<Game>('games');
  const foundGame = allGames.find((game) => game.id === id || game.slug === id);
  if (!foundGame) {
    return { game: null, fileKey: null };
  }

  return { game: foundGame, fileKey: foundGame.id };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug) {
      return NextResponse.json({ success: false, error: 'Slug is required' }, { status: 400 });
    }

    const body = await request.json();
    const gameId = body.gameId as string | undefined;
    if (!gameId) {
      return NextResponse.json({ success: false, error: 'gameId is required' }, { status: 400 });
    }

    const config = await makeItRunService.loadConfig(slug);
    if (!config) {
      return NextResponse.json({ success: false, error: 'MakeItRun config not found' }, { status: 404 });
    }

    const { game, fileKey } = await findGameAndFileKey(gameId);
    if (!game || !fileKey) {
      return NextResponse.json({ success: false, error: 'Game not found' }, { status: 404 });
    }

    const updatedGame = makeItRunService.applyToGame(game, config);
    await storage.writeEntity('games', fileKey, updatedGame);

    return NextResponse.json({
      success: true,
      data: updatedGame,
      message: 'MakeItRun config applied successfully',
    });
  } catch (error) {
    console.error('Error applying MakeItRun config:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to apply MakeItRun config',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
