import { NextRequest, NextResponse } from 'next/server';
import { DownloadManager } from '@/lib/services/download-manager';

// Disable caching for this dynamic route
export const dynamic = 'force-dynamic';

// GET /api/online-sources/gog/downloads/[gameId]/progress - Get download progress for a specific game
export async function GET(
  __request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    
    const downloadManager = await DownloadManager.getInitializedInstance();
    const progress = downloadManager.getDownloadStatus(gameId);
    
    if (!progress) {
      return NextResponse.json(
        { error: 'Download not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(progress);
  } catch (error) {
    console.error('Failed to get download progress:', error);
    return NextResponse.json(
      { error: 'Failed to get download progress', message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error' },
      { status: 500 }
    );
  }
}
