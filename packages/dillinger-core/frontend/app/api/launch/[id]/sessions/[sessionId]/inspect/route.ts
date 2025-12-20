import { NextRequest, NextResponse } from 'next/server';
import { JSONStorageService } from '@/lib/services/storage';
import { DockerService } from '@/lib/services/docker-service';
import type { GameSession } from '@dillinger/shared';

const storage = JSONStorageService.getInstance();
const docker = DockerService.getInstance();

// GET /api/launch/[id]/sessions/[sessionId]/inspect - Fetch Docker inspect data
export async function GET(
  __request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const { id: gameId, sessionId } = await params;
    if (!gameId || !sessionId) {
      return NextResponse.json(
        { error: 'Game ID and session ID required' },
        { status: 400 }
      );
    }

    const session = await storage.readEntity<GameSession>('sessions', sessionId);
    if (!session || session.gameId !== gameId) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (!session.containerId) {
      return NextResponse.json(
        { error: 'Session has no containerId yet' },
        { status: 400 }
      );
    }

    const inspect = await docker.inspectContainer(session.containerId);
    return NextResponse.json({
      success: true,
      containerId: session.containerId,
      inspect,
    });
  } catch (error) {
    console.error('Error inspecting container:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
