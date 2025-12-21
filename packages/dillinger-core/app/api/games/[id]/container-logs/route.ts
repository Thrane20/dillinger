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

// GET /api/games/[id]/container-logs - Get logs from the installation or launch container
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'install';
    const tail = searchParams.get('tail') || '100';
    
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

    // Get the container ID based on type
    let containerId: string | null = null;
    
    if (type === 'install' && game.installation?.containerId) {
      containerId = game.installation.containerId;
    } else if (type === 'launch') {
      return NextResponse.json(
        { success: false, error: 'Launch container logs not yet implemented' },
        { status: 400 }
      );
    }

    if (!containerId) {
      return NextResponse.json(
        { success: false, error: 'No container found for this game' },
        { status: 404 }
      );
    }

    // Get the logs from Docker
    const logs = await dockerService.getContainerLogs(containerId, parseInt(tail));

    return NextResponse.json({
      success: true,
      logs,
      containerId,
    });
  } catch (error) {
    console.error('Error getting container logs:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get container logs',
        message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
