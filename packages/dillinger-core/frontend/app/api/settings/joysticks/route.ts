import { NextRequest, NextResponse } from 'next/server';
import { SettingsService } from '@/lib/services/settings';
import { getAvailableJoysticks } from '@/lib/utils/hardware';

const settingsService = SettingsService.getInstance();

// GET /api/settings/joysticks - Get available joysticks and saved configuration
export async function GET() {
  try {
    const available = await getAvailableJoysticks();
    const settings = await settingsService.getJoystickSettings();
    
    return NextResponse.json({
      success: true,
      available,
      settings
    });
  } catch (error) {
    console.error('Failed to get joystick settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get joystick settings', message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/settings/joysticks - Update joystick configuration for a platform
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { platform, deviceId, deviceName } = body;
    
    if (!platform || !deviceId) {
      return NextResponse.json(
        { success: false, message: 'Missing platform or deviceId' },
        { status: 400 }
      );
    }

    await settingsService.updateJoystickSettings({
      [platform]: {
        deviceId,
        deviceName: deviceName || 'Unknown Device'
      }
    });
    
    return NextResponse.json({
      success: true,
      message: `Joystick settings for ${platform} updated successfully`,
    });
  } catch (error) {
    console.error('Failed to update joystick settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update joystick settings', message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error' },
      { status: 500 }
    );
  }
}
