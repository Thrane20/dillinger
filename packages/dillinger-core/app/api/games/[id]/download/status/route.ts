import { NextRequest, NextResponse } from 'next/server';
import { DownloadManager } from '@/lib/services/download-manager';

// Disable caching for this dynamic route
export const dynamic = 'force-dynamic';

// GET /api/games/[id]/download/status - Get download status for a game
export async function GET(
  __request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: gameId } = await params;
    
    if (!gameId) {
      return NextResponse.json(
        { success: false, error: 'Game ID is required' },
        { status: 400 }
      );
    }
    
    const downloadManager = await DownloadManager.getInitializedInstance();
    const status = downloadManager.getDownloadStatus(gameId);
    
    return NextResponse.json({
      success: true,
      status,
    });
  } catch (error) {
    console.error('Error getting download status:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get download status',
        message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/games/[id]/download/status - Cancel an active download for a game
export async function DELETE(
  __request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: gameId } = await params;
    
    if (!gameId) {
      return NextResponse.json(
        { success: false, error: 'Game ID is required' },
        { status: 400 }
      );
    }
    
    const downloadManager = await DownloadManager.getInitializedInstance();
    await downloadManager.cancelDownload(gameId);
    
    return NextResponse.json({
      success: true,
      message: 'Download cancelled',
    });
  } catch (error) {
    console.error('Error cancelling download:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to cancel download',
        message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
