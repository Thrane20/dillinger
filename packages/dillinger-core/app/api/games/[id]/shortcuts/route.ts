import { NextRequest, NextResponse } from 'next/server';
import { JSONStorageService } from '@/lib/services/storage';
import { DockerService } from '@/lib/services/docker-service';
import type { Game } from '@dillinger/shared';

const storage = JSONStorageService.getInstance();
const dockerService = DockerService.getInstance();

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

// GET /api/games/[id]/shortcuts - Scan for Windows shortcuts (.lnk files)
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
    if (!game || !game.installation?.installPath) {
      return NextResponse.json(
        { success: false, error: 'Game not found or not installed' },
        { status: 404 }
      );
    }

    const shortcuts = await dockerService.scanForShortcuts(game.installation.installPath);
    
    return NextResponse.json({
      success: true,
      shortcuts: shortcuts,
    });
  } catch (error) {
    console.error('Error scanning for shortcuts:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to scan for shortcuts',
        message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST /api/games/[id]/shortcuts - Parse a specific .lnk file
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { shortcutPath } = body;
    
    if (!id || !shortcutPath) {
      return NextResponse.json(
        { success: false, error: 'Game ID and shortcut path are required' },
        { status: 400 }
      );
    }

    const { game } = await findGameAndFileKey(id);
    if (!game || !game.installation?.installPath) {
      return NextResponse.json(
        { success: false, error: 'Game not found or not installed' },
        { status: 404 }
      );
    }

    const shortcutInfo = await dockerService.parseShortcut(shortcutPath);
    
    return NextResponse.json({
      success: true,
      shortcut: shortcutInfo,
    });
  } catch (error) {
    console.error('Error parsing shortcut:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to parse shortcut',
        message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
