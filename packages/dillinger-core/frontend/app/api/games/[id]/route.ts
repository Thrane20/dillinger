import { NextRequest, NextResponse } from 'next/server';
import { JSONStorageService } from '@/lib/services/storage';
import type { Game } from '@dillinger/shared';
import { 
  migrateGameToMultiPlatform,
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

// GET /api/games/[id] - Get a specific game
export async function GET(
  _request: NextRequest,
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

    const { game } = await findGameAndFileKey(id);
    
    if (!game) {
      return NextResponse.json(
        { success: false, error: 'Game not found' },
        { status: 404 }
      );
    }

    const migratedGame = migrateGameToMultiPlatform(game);

    return NextResponse.json({
      success: true,
      data: migratedGame,
    });
  } catch (error) {
    console.error('Error getting game:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get game',
        message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// PUT /api/games/[id] - Update a game
export async function PUT(
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
    const {
      title,
      slug,
      filePath,
      platformId,
      platforms,
      defaultPlatformId,
      collectionIds,
      tags,
      metadata,
      settings,
    } = body;

    const updatedGame: Game = {
      ...existingGame,
      title: title ?? existingGame.title,
      slug: slug ?? existingGame.slug,
      filePath: filePath ?? existingGame.filePath,
      platformId: platformId ?? existingGame.platformId,
      platforms: platforms ?? existingGame.platforms,
      defaultPlatformId: defaultPlatformId ?? existingGame.defaultPlatformId,
      collectionIds: collectionIds ?? existingGame.collectionIds,
      tags: tags ?? existingGame.tags,
      metadata: { ...existingGame.metadata, ...metadata },
      settings: settings ?? existingGame.settings,
      updated: new Date().toISOString(),
    };

    await storage.writeEntity('games', fileKey, updatedGame);
    const migratedGame = migrateGameToMultiPlatform(updatedGame);

    return NextResponse.json({
      success: true,
      data: migratedGame,
      message: 'Game updated successfully',
    });
  } catch (error) {
    console.error('Error updating game:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update game',
        message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/games/[id] - Delete a game
export async function DELETE(
  _request: NextRequest,
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

    const { game, fileKey } = await findGameAndFileKey(id);
    if (!game || !fileKey) {
      return NextResponse.json(
        { success: false, error: 'Game not found' },
        { status: 404 }
      );
    }

    const deleted = await storage.deleteEntity('games', fileKey);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete game' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Game deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting game:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete game',
        message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// PATCH /api/games/[id] - Update game settings
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
    const { settings, platforms, defaultPlatformId } = body;

    const updatedGame: Game = {
      ...existingGame,
      settings: settings ? { ...existingGame.settings, ...settings } : existingGame.settings,
      platforms: platforms ?? existingGame.platforms,
      defaultPlatformId: defaultPlatformId ?? existingGame.defaultPlatformId,
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
