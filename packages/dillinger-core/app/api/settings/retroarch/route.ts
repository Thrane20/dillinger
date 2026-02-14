import { NextRequest, NextResponse } from 'next/server';
import { SettingsService } from '@/lib/services/settings';

const settingsService = SettingsService.getInstance();

// GET /api/settings/retroarch - Get RetroArch settings
export async function GET() {
  try {
    const settings = await settingsService.getRetroarchSettings();
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('Failed to get RetroArch settings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get RetroArch settings',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST /api/settings/retroarch - Update RetroArch settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mame } = body as { mame?: { aspect?: '4:3' | 'auto'; integerScale?: boolean; borderlessFullscreen?: boolean } };

    await settingsService.updateRetroarchSettings({ mame });

    return NextResponse.json({ success: true, message: 'RetroArch settings updated successfully' });
  } catch (error) {
    console.error('Failed to update RetroArch settings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update RetroArch settings',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
