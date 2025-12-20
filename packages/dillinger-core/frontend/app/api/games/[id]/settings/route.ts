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

// PATCH /api/games/[id]/settings - Update game settings (gamescope, moonlight, launch, etc.)
export async function PATCH(
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

    const { game: existingGame, fileKey } = await findGameAndFileKey(id);
    if (!existingGame || !fileKey) {
      return NextResponse.json(
        { success: false, error: 'Game not found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    // Merge settings - deep merge for nested objects
    const updatedSettings: Record<string, unknown> = {
      ...existingGame.settings,
      ...body,
    };

    // Deep merge for nested settings objects
    if (body.wine) {
      updatedSettings.wine = {
        ...existingGame.settings?.wine,
        ...body.wine,
      };
    }
    if (body.launch) {
      updatedSettings.launch = {
        ...existingGame.settings?.launch,
        ...body.launch,
      };
    }
    if (body.gamescope) {
      updatedSettings.gamescope = {
        ...existingGame.settings?.gamescope,
        ...body.gamescope,
      };
    }
    if (body.moonlight) {
      updatedSettings.moonlight = {
        ...existingGame.settings?.moonlight,
        ...body.moonlight,
      };
    }
    if (body.emulator) {
      updatedSettings.emulator = {
        ...existingGame.settings?.emulator,
        ...body.emulator,
      };
    }

    const updatedGame = {
      ...existingGame,
      settings: updatedSettings,
      updated: new Date().toISOString(),
    };

    await storage.writeEntity('games', fileKey, updatedGame);
    const migratedGame = migrateGameToMultiPlatform(updatedGame);

    return NextResponse.json({
      success: true,
      data: migratedGame,
      message: 'Game settings updated successfully',
    });
  } catch (error) {
    console.error('Error updating game settings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update game settings',
        message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
