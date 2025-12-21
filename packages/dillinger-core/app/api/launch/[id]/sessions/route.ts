import { NextRequest, NextResponse } from 'next/server';
import { GameSessionsService } from '@/lib/services/game-sessions';

const gameSessions = GameSessionsService.getInstance();

// GET /api/launch/[id]/sessions - Get all sessions for a game
export async function GET(
  __request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: gameId } = await params;
    
    if (!gameId) {
      return NextResponse.json(
        { error: 'Game ID is required' },
        { status: 400 }
      );
    }
    
    const sessions = await gameSessions.getSessions(gameId);
    const stats = await gameSessions.getStats(gameId);
    
    return NextResponse.json({
      success: true,
      sessions,
      stats,
    });
  } catch (error) {
    console.error('Error in sessions endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error' },
      { status: 500 }
    );
  }
}
