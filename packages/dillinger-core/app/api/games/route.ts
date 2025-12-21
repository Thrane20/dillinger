import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { JSONStorageService } from '@/lib/services/storage';
import type { Game } from '@dillinger/shared';
import { migrateGameToMultiPlatform } from '@dillinger/shared';

const storage = JSONStorageService.getInstance();

/**
 * Generate a URL-friendly slug from a title
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// GET /api/games - List all games
export async function GET() {
  try {
    const games = await storage.listEntities<Game>('games');
    const migratedGames = games.map(migrateGameToMultiPlatform);
    return NextResponse.json({
      success: true,
      data: migratedGames,
      count: migratedGames.length,
    });
  } catch (error) {
    console.error('Error listing games:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list games',
        message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST /api/games - Create a new game
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      slug,
      filePath,
      platformId,
      platforms,
      defaultPlatformId,
      collectionIds = [],
      tags = [],
      metadata = {},
      settings = {},
    } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json(
        { success: false, error: 'Title is required' },
        { status: 400 }
      );
    }

    const gameSlug = slug || slugify(title);

    const game: Game = {
      id: uuidv4(),
      slug: gameSlug,
      title,
      collectionIds,
      tags,
      metadata,
      fileInfo: {
        size: 0,
        lastModified: new Date().toISOString(),
      },
      platforms: platforms || [],
      defaultPlatformId,
      filePath,
      platformId,
      settings,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };

    if (platformId && (!platforms || platforms.length === 0)) {
      game.platforms = [{
        platformId,
        filePath,
        settings,
      }];
      game.defaultPlatformId = platformId;
    }

    await storage.writeEntity('games', game.id, game);
    const migratedGame = migrateGameToMultiPlatform(game);

    return NextResponse.json(
      {
        success: true,
        data: migratedGame,
        message: 'Game added successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating game:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create game',
        message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

