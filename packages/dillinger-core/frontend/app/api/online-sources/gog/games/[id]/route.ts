import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getGameDetails } from '@/lib/services/gog-auth';

// GET /api/online-sources/gog/games/[id] - Get specific GOG game details
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authenticated = await isAuthenticated();
    
    if (!authenticated) {
      return NextResponse.json(
        { error: 'Not authenticated with GOG' },
        { status: 401 }
      );
    }

    const game = await getGameDetails(id);
    
    if (!game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(game);
  } catch (error) {
    console.error('Failed to get GOG game details:', error);
    return NextResponse.json(
      { error: 'Failed to get GOG game details', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
