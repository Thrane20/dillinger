import { NextRequest, NextResponse } from 'next/server';
import { SettingsService } from '@/lib/services/settings';

const settingsService = SettingsService.getInstance();

// GET /api/settings/gpu - Get GPU settings
export async function GET() {
  try {
    const settings = await settingsService.getGpuSettings();
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('Failed to get GPU settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get GPU settings', message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/settings/gpu - Update GPU settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { vendor } = body as { vendor?: string };

    if (vendor !== undefined && vendor !== 'auto' && vendor !== 'amd' && vendor !== 'nvidia') {
      return NextResponse.json(
        { success: false, message: "Invalid vendor (expected 'auto' | 'amd' | 'nvidia')" },
        { status: 400 }
      );
    }

    await settingsService.updateGpuSettings({ vendor: vendor as any });
    return NextResponse.json({ success: true, message: 'GPU settings updated successfully' });
  } catch (error) {
    console.error('Failed to update GPU settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update GPU settings', message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error' },
      { status: 500 }
    );
  }
}
