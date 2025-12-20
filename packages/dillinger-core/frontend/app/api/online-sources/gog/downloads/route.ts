import { NextResponse } from 'next/server';
import { DownloadManager } from '@/lib/services/download-manager';

// Disable caching for this dynamic route
export const dynamic = 'force-dynamic';

// GET /api/online-sources/gog/downloads - Get all active downloads
export async function GET() {
  try {
    const downloadManager = await DownloadManager.getInitializedInstance();
    const downloads = downloadManager.getAllDownloads();
    
    return NextResponse.json({
      downloads,
      total: downloads.length,
    });
  } catch (error) {
    console.error('Failed to get downloads:', error);
    return NextResponse.json(
      { error: 'Failed to get downloads', message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error' },
      { status: 500 }
    );
  }
}
