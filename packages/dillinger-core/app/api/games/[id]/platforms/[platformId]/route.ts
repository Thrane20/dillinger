import { NextRequest, NextResponse } from 'next/server';
import { JSONStorageService } from '@/lib/services/storage';
import * as fs from 'fs-extra';
import * as path from 'path';
import type { Game } from '@dillinger/shared';
import { 
  migrateGameToMultiPlatform,
  setPlatformConfig,
  getPlatformConfig,
  removePlatformConfig,
} from '@dillinger/shared';

const storage = JSONStorageService.getInstance();
const DILLINGER_CORE_PATH = process.env.DILLINGER_CORE_PATH || '/data';

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

// GET /api/games/[id]/platforms/[platformId] - Get a platform configuration
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; platformId: string }> }
) {
  try {
    const { id, platformId } = await params;

    if (!id || !platformId) {
      return NextResponse.json(
        { success: false, error: 'Game ID and platformId are required' },
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
    const platformConfig = getPlatformConfig(migratedGame, platformId);
    
    if (!platformConfig) {
      return NextResponse.json(
        { success: false, error: `Platform ${platformId} not configured for this game` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: platformConfig,
    });
  } catch (error) {
    console.error('Error getting platform configuration:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get platform configuration',
        message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// PUT /api/games/[id]/platforms/[platformId] - Update a platform configuration
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; platformId: string }> }
) {
  try {
    const { id, platformId } = await params;
    const body = await request.json();
    const { filePath, settings, installation } = body;

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

    // Check if platform exists
    const existingConfig = getPlatformConfig(game, platformId);
    if (!existingConfig) {
      return NextResponse.json(
        { success: false, error: `Platform ${platformId} not configured for this game` },
        { status: 404 }
      );
    }

    // Update platform configuration
    const updatedGame = setPlatformConfig(game, platformId, {
      platformId,
      filePath: filePath !== undefined ? filePath : existingConfig.filePath,
      settings: settings !== undefined ? { ...existingConfig.settings, ...settings } : existingConfig.settings,
      installation: installation !== undefined ? { ...existingConfig.installation, ...installation } : existingConfig.installation,
    });

    await storage.writeEntity('games', fileKey, updatedGame);
    const migratedGame = migrateGameToMultiPlatform(updatedGame);

    return NextResponse.json({
      success: true,
      data: migratedGame,
      message: 'Platform configuration updated successfully',
    });
  } catch (error) {
    console.error('Error updating platform configuration:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update platform configuration',
        message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/games/[id]/platforms/[platformId] - Remove a platform configuration
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; platformId: string }> }
) {
  try {
    const { id, platformId } = await params;

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

    // Remove platform configuration
    const updatedGame = removePlatformConfig(game, platformId);

    // If no platforms left, delete the entire game
    if (updatedGame.platforms.length === 0) {
      await storage.deleteEntity('games', fileKey);
      
      // Clean up associated directories
      if (game.slug) {
        const metadataPath = path.join(DILLINGER_CORE_PATH, 'storage', 'metadata', game.slug);
        try {
          if (await fs.pathExists(metadataPath)) {
            await fs.remove(metadataPath);
          }
        } catch (error) {
          console.warn(`Failed to delete metadata directory for ${game.slug}:`, error);
        }
      }

      const savesPath = path.join(DILLINGER_CORE_PATH, 'saves', game.id);
      try {
        if (await fs.pathExists(savesPath)) {
          await fs.remove(savesPath);
        }
      } catch (error) {
        console.warn(`Failed to delete saves directory for ${game.id}:`, error);
      }

      return NextResponse.json({
        success: true,
        message: 'Last platform removed - game deleted',
        gameDeleted: true,
      });
    }

    await storage.writeEntity('games', fileKey, updatedGame);
    const migratedGame = migrateGameToMultiPlatform(updatedGame);

    return NextResponse.json({
      success: true,
      data: migratedGame,
      message: 'Platform configuration removed successfully',
      gameDeleted: false,
    });
  } catch (error) {
    console.error('Error removing platform configuration:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to remove platform configuration',
        message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
