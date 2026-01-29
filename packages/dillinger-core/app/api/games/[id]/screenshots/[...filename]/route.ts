import { NextRequest, NextResponse } from 'next/server';
import { JSONStorageService } from '@/lib/services/storage';
import * as fs from 'fs-extra';
import * as path from 'path';
import type { Game } from '@dillinger/shared';

const storage = JSONStorageService.getInstance();
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

/**
 * Helper to find a game
 */
async function findGame(id: string): Promise<Game | null> {
  const directGame = await storage.readEntity<Game>('games', id);
  if (directGame) {
    return directGame;
  }
  
  const allGames = await storage.listEntities<Game>('games');
  return allGames.find((g) => g.id === id || g.slug === id) || null;
}

// GET /api/games/[id]/screenshots/[...filename] - Serve a screenshot image file
export async function GET(
  __request: NextRequest,
  { params }: { params: Promise<{ id: string; filename: string[] }> }
) {
  try {
    const { id, filename } = await params;

    if (!id || !filename || filename.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Game ID and filename are required' },
        { status: 400 }
      );
    }

    const game = await findGame(id);

    if (!game) {
      return NextResponse.json(
        { success: false, error: 'Game not found' },
        { status: 404 }
      );
    }

    const decodedPath = filename.map((part) => decodeURIComponent(part)).join('/');

    // Construct path to screenshot
    const dillingerRoot = storage.getDillingerRoot();
    const gameIdentifier = game.slug || game.id;
    const emulatorHomeDir = path.join(dillingerRoot, 'emulator-homes', gameIdentifier);
    const screenshotPath = path.join(emulatorHomeDir, decodedPath);

    // Security check: ensure file is within emulator home directory
    const resolvedBase = path.resolve(emulatorHomeDir);
    const resolvedFile = path.resolve(screenshotPath);
    if (!resolvedFile.startsWith(resolvedBase + path.sep)) {
      return NextResponse.json(
        { success: false, error: 'Invalid screenshot path' },
        { status: 400 }
      );
    }

    // Check if file exists
    if (!await fs.pathExists(resolvedFile)) {
      return NextResponse.json(
        { success: false, error: 'Screenshot not found' },
        { status: 404 }
      );
    }

    // Verify it's an allowed image type
    const ext = path.extname(resolvedFile).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { success: false, error: 'Invalid screenshot file type' },
        { status: 400 }
      );
    }

    const fileBuffer = await fs.readFile(resolvedFile);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error serving screenshot:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to serve screenshot' },
      { status: 500 }
    );
  }
}
