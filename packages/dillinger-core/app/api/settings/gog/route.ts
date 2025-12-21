import { NextRequest, NextResponse } from 'next/server';
import { SettingsService } from '@/lib/services/settings';

const settingsService = SettingsService.getInstance();

// GET /api/settings/gog - Get GOG settings
export async function GET() {
  try {
    const settings = await settingsService.getGOGSettings();
    
    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error('Failed to get GOG settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get GOG settings', message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT /api/settings/gog - Update GOG settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessCode } = body;
    
    await settingsService.updateGOGSettings({ accessCode });
    
    return NextResponse.json({
      success: true,
      message: 'GOG settings updated successfully',
    });
  } catch (error) {
    console.error('Failed to update GOG settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update GOG settings', message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error' },
      { status: 500 }
    );
  }
}
