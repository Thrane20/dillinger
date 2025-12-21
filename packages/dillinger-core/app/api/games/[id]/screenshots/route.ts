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
    
    // Read all PNG files from the directory
    const files = await fs.readdir(emulatorHomeDir);
    const screenshots = [];
    
    for (const file of files) {
      if (file.toLowerCase().endsWith('.png')) {
        const filePath = path.join(emulatorHomeDir, file);
        const stats = await fs.stat(filePath);
        
        screenshots.push({
          filename: file,
          path: `/api/games/${id}/screenshots/${encodeURIComponent(file)}`,
          size: stats.size,
          modified: stats.mtime.toISOString(),
          modifiedTimestamp: stats.mtime.getTime(),
        });
      }
    }
    
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
