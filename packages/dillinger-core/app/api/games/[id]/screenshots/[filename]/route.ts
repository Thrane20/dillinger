import { NextRequest, NextResponse } from 'next/server';
import { JSONStorageService } from '@/lib/services/storage';
import * as fs from 'fs-extra';
import * as path from 'path';
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

// GET /api/games/[id]/screenshots/[filename] - Serve a screenshot image file
export async function GET(
  __request: NextRequest,
  { params }: { params: Promise<{ id: string; filename: string }> }
) {
  try {
    const { id, filename } = await params;
    
    if (!id || !filename) {
      return NextResponse.json(
        { success: false, error: 'Game ID and filename are required' },
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
    
    // Validate filename to prevent directory traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json(
        { success: false, error: 'Invalid filename' },
        { status: 400 }
      );
    }
    
    // Construct path to screenshot
    const dillingerRoot = storage.getDillingerRoot();
    const gameIdentifier = game.slug || game.id;
    const emulatorHomeDir = path.join(dillingerRoot, 'emulator-homes', gameIdentifier);
    const screenshotPath = path.join(emulatorHomeDir, filename);
    
    // Check if file exists
    if (!await fs.pathExists(screenshotPath)) {
      return NextResponse.json(
        { success: false, error: 'Screenshot not found' },
        { status: 404 }
      );
    }
    
    // Verify it's a PNG file
    if (!filename.toLowerCase().endsWith('.png')) {
      return NextResponse.json(
        { success: false, error: 'Only PNG files are supported' },
        { status: 400 }
      );
    }
    
    // Read and serve the file
    const fileBuffer = await fs.readFile(screenshotPath);
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error) {
    console.error('Error serving screenshot:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to serve screenshot',
        message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
