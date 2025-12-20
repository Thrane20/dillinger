import { NextRequest, NextResponse } from 'next/server';
import { SettingsService } from '@/lib/services/settings';
import { DownloadManager } from '@/lib/services/download-manager';

const settingsService = SettingsService.getInstance();

// GET /api/settings/downloads - Get download settings
export async function GET() {
  try {
    const settings = await settingsService.getDownloadSettings();
    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error('Failed to get download settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get download settings', message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT /api/settings/downloads - Update download settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { maxConcurrent } = body;
    
    if (maxConcurrent !== undefined) {
      const validated = Math.max(1, Math.min(maxConcurrent, 10));
      await settingsService.updateDownloadSettings({ maxConcurrent: validated });
      
      const downloadManager = await DownloadManager.getInitializedInstance();
      downloadManager.setMaxConcurrentDownloads(validated);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Download settings updated successfully',
    });
  } catch (error) {
    console.error('Failed to update download settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update download settings', message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error' },
      { status: 500 }
    );
  }
}
