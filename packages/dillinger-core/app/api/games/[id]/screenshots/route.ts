import { NextRequest, NextResponse } from 'next/server';
import { JSONStorageService } from '@/lib/services/storage';
import * as fs from 'fs-extra';
import * as path from 'path';
import type { Game } from '@dillinger/shared';

const storage = JSONStorageService.getInstance();
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

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

function encodePathSegments(relativePath: string): string {
  return relativePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

async function collectScreenshots(
  baseDir: string,
  emulatorHomeDir: string,
  results: Array<{ filename: string; path: string; size: number; modified: string; modifiedTimestamp: number }>,
  seen: Set<string>,
  gameId: string
): Promise<void> {
  if (!await fs.pathExists(baseDir)) {
    return;
  }

  const entries = await fs.readdir(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(baseDir, entry.name);

    if (entry.isDirectory()) {
      await collectScreenshots(fullPath, emulatorHomeDir, results, seen, gameId);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) {
      continue;
    }

    const relativePath = path
      .relative(emulatorHomeDir, fullPath)
      .split(path.sep)
      .join('/');

    if (relativePath.startsWith('..') || seen.has(relativePath)) {
      continue;
    }

    const stats = await fs.stat(fullPath);
    seen.add(relativePath);

    results.push({
      filename: relativePath,
      path: `/api/games/${gameId}/screenshots/${encodePathSegments(relativePath)}`,
      size: stats.size,
      modified: stats.mtime.toISOString(),
      modifiedTimestamp: stats.mtime.getTime(),
    });
  }
}

// GET /api/games/[id]/screenshots - Get list of screenshots for a game
export async function GET(
  __request: NextRequest,
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
    
    // Construct path to emulator home directory
    const dillingerRoot = storage.getDillingerRoot();
    const gameIdentifier = game.slug || game.id;
    const emulatorHomeDir = path.join(dillingerRoot, 'emulator-homes', gameIdentifier);
    
    // Check if directory exists
    if (!await fs.pathExists(emulatorHomeDir)) {
      return NextResponse.json({
        success: true,
        data: {
          screenshots: [],
          path: emulatorHomeDir,
        },
      });
    }

    const screenshots: Array<{ filename: string; path: string; size: number; modified: string; modifiedTimestamp: number }> = [];
    const seen = new Set<string>();
    const retroarchScreenshotsDir = path.join(emulatorHomeDir, '.config', 'retroarch', 'screenshots');

    await collectScreenshots(retroarchScreenshotsDir, emulatorHomeDir, screenshots, seen, id);
    await collectScreenshots(emulatorHomeDir, emulatorHomeDir, screenshots, seen, id);
    
    // Sort by modified date (newest first)
    screenshots.sort((a, b) => b.modifiedTimestamp - a.modifiedTimestamp);
    
    return NextResponse.json({
      success: true,
      data: {
        screenshots,
        path: emulatorHomeDir,
      },
    });
  } catch (error) {
    console.error('Error getting screenshots:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get screenshots',
        message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
