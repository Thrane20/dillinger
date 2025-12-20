import { NextRequest, NextResponse } from 'next/server';
import { SettingsService } from '@/lib/services/settings';
import { DockerService } from '@/lib/services/docker-service';

const settingsService = SettingsService.getInstance();
const dockerService = DockerService.getInstance();

// GET /api/settings/audio - Get audio settings and available sinks
export async function GET() {
  try {
    const settings = await settingsService.getAudioSettings();
    const availableSinks = await dockerService.getAvailableAudioSinks();

    return NextResponse.json({
      settings,
      availableSinks,
    });
  } catch (error) {
    console.error('Failed to get audio settings:', error);
    return NextResponse.json(
      { error: 'Failed to get audio settings', message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/settings/audio - Update audio settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { defaultSink } = body;

    if (!defaultSink) {
      return NextResponse.json(
        { success: false, message: 'Missing defaultSink' },
        { status: 400 }
      );
    }

    await settingsService.updateAudioSettings({ defaultSink });

    return NextResponse.json({
      success: true,
      message: 'Audio settings updated successfully',
    });
  } catch (error) {
    console.error('Failed to update audio settings:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error' },
      { status: 500 }
    );
  }
}
