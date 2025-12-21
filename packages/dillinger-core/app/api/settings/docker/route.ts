import { NextRequest, NextResponse } from 'next/server';
import { SettingsService } from '@/lib/services/settings';

const settingsService = SettingsService.getInstance();

// GET /api/settings/docker - Get Docker settings
export async function GET() {
  try {
    const settings = await settingsService.getDockerSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Failed to get Docker settings:', error);
    return NextResponse.json(
      { error: 'Failed to get Docker settings', message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/settings/docker - Update Docker settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { autoRemoveContainers } = body;

    await settingsService.updateDockerSettings({ autoRemoveContainers });

    return NextResponse.json({
      success: true,
      message: 'Docker settings updated successfully',
    });
  } catch (error) {
    console.error('Failed to update Docker settings:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error' },
      { status: 500 }
    );
  }
}
