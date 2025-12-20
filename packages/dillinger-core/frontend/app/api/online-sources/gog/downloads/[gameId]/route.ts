import { NextRequest, NextResponse } from 'next/server';
import { DownloadManager } from '@/lib/services/download-manager';

// DELETE /api/online-sources/gog/downloads/[gameId] - Cancel a download
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    
    const downloadManager = await DownloadManager.getInitializedInstance();
    await downloadManager.cancelDownload(gameId);
    
    return NextResponse.json({
      success: true,
      message: 'Download cancelled',
    });
  } catch (error) {
    console.error('Failed to cancel download:', error);
    return NextResponse.json(
      { error: 'Failed to cancel download', message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error' },
      { status: 500 }
    );
  }
}
