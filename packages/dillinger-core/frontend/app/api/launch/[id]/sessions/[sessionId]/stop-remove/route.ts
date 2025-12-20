import { NextRequest, NextResponse } from 'next/server';
import { JSONStorageService } from '@/lib/services/storage';
import { DockerService } from '@/lib/services/docker-service';
import type { GameSession } from '@dillinger/shared';

const storage = JSONStorageService.getInstance();
const docker = DockerService.getInstance();

// POST /api/launch/[id]/sessions/[sessionId]/stop-remove - Stop and remove the session container
export async function POST(
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

    // Stop is best-effort; remove with force handles running too
    try {
      await docker.stopContainer(session.containerId);
    } catch (e) {
      // ignore stop errors here; removal is the goal
    }
    await docker.removeContainer(session.containerId, true);

    session.status = 'stopped';
    session.updated = new Date().toISOString();
    if (session.performance) {
      session.performance.endTime = new Date().toISOString();
    }
    await storage.writeEntity('sessions', sessionId, session);

    return NextResponse.json({
      success: true,
      containerId: session.containerId,
      removed: true,
    });
  } catch (error) {
    console.error('Error stop+removing session container:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
