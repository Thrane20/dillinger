import { NextRequest, NextResponse } from 'next/server';
import { JSONStorageService } from '@/lib/services/storage';
import * as fs from 'fs-extra';
import * as path from 'path';
import type { Game } from '@dillinger/shared';

const storage = JSONStorageService.getInstance();

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

// GET /api/games/[id]/saves/[filename] - Download a save file
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; filename: string }> }
) {
  try {
    const { id, filename } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'sram' | 'state' | null;
    
    if (!id || !filename) {
      return NextResponse.json(
        { success: false, error: 'Game ID and filename are required' },
        { status: 400 }
      );
    }
    
    if (!type || (type !== 'sram' && type !== 'state')) {
      return NextResponse.json(
        { success: false, error: 'type query param must be "sram" or "state"' },
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
    
    // Construct path to save file
    const dillingerRoot = storage.getDillingerRoot();
    const gameId = game.id || game.slug || 'unknown';
    const subDir = type === 'sram' ? 'sram' : 'states';
    const decodedFilename = decodeURIComponent(filename);
    const filePath = path.join(dillingerRoot, 'saves', gameId, subDir, decodedFilename);
    
    // Security check: ensure file is within expected directory
    const expectedDir = path.join(dillingerRoot, 'saves', gameId, subDir);
    if (!filePath.startsWith(expectedDir)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file path' },
        { status: 400 }
      );
    }
    
    // Check if file exists
    if (!await fs.pathExists(filePath)) {
      return NextResponse.json(
        { success: false, error: 'Save file not found' },
        { status: 404 }
      );
    }
    
    // Read file and return as download
    const fileBuffer = await fs.readFile(filePath);
    const stats = await fs.stat(filePath);
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${decodedFilename}"`,
        'Content-Length': stats.size.toString(),
      },
    });
  } catch (error) {
    console.error('Error downloading save:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to download save' },
      { status: 500 }
    );
  }
}
