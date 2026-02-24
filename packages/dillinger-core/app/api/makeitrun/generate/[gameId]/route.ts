import { NextRequest, NextResponse } from 'next/server';
import type { Game } from '@dillinger/shared';
import { JSONStorageService } from '@/lib/services/storage';
import { makeItRunService } from '@/lib/services/makeitrun-service';
import { lookupCompatibility } from '@/lib/services/compatibility-service';

const storage = JSONStorageService.getInstance();

async function findGame(id: string): Promise<Game | null> {
  const directGame = await storage.readEntity<Game>('games', id);
  if (directGame) {
    return directGame;
  }

  const allGames = await storage.listEntities<Game>('games');
  return allGames.find((game) => game.id === id || game.slug === id) || null;
}

function extractGogId(game: Game): string | undefined {
  const directMetadataId = (game.metadata as { gogId?: unknown } | undefined)?.gogId;
  if (typeof directMetadataId === 'number' && Number.isFinite(directMetadataId)) {
    return String(Math.trunc(directMetadataId));
  }

  const slugCandidate = game.slug || '';
  const trailingDigits = slugCandidate.match(/(\d{8,})$/)?.[1];
  if (trailingDigits) {
    return trailingDigits;
  }

  return undefined;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    if (!gameId) {
      return NextResponse.json({ success: false, error: 'Game ID is required' }, { status: 400 });
    }

    const game = await findGame(gameId);
    if (!game) {
      return NextResponse.json({ success: false, error: 'Game not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const useCompatibility = body.useCompatibility !== false;

    let config = makeItRunService.generateFromGame(game);

    if (useCompatibility) {
      const report = await lookupCompatibility({
        title: game.title,
        slug: game.slug,
        gogId: extractGogId(game),
      });
      config = makeItRunService.generateFromCompatibility(game, report);
    }

    const saved = await makeItRunService.saveConfig(config);
    return NextResponse.json({
      success: true,
      data: saved,
      message: 'MakeItRun config generated successfully',
    });
  } catch (error) {
    console.error('Error generating MakeItRun config:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate MakeItRun config',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
