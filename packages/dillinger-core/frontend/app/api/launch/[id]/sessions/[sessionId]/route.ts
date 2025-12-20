import { NextRequest, NextResponse } from 'next/server';
import { JSONStorageService } from '@/lib/services/storage';
import type { GameSession } from '@dillinger/shared';

const storage = JSONStorageService.getInstance();

// GET /api/launch/[id]/sessions/[sessionId] - Get a single session
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
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (session.gameId !== gameId) {
      return NextResponse.json(
        { error: 'Session not found for this game' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      session,
    });
  } catch (error) {
    console.error('Error getting session:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
