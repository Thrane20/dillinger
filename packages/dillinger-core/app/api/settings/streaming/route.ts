import { NextRequest, NextResponse } from 'next/server';
import { SettingsService } from '@/lib/services/settings';
import type { StreamingSettings } from '@dillinger/shared';

const settingsService = SettingsService.getInstance();

// GET /api/settings/streaming - Get streaming settings
export async function GET() {
  try {
    const settings = await settingsService.getStreamingSettings();
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('Failed to get streaming settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get streaming settings', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/settings/streaming - Update streaming settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const updates: Partial<StreamingSettings> = {};

    if (body.streamingMode !== undefined) {
      if (!['profiles', 'graph'].includes(body.streamingMode)) {
        return NextResponse.json(
          { success: false, message: "Invalid streamingMode (expected 'profiles' | 'graph')" },
          { status: 400 }
        );
      }
      updates.streamingMode = body.streamingMode;
    }

    // Validate and extract fields
    if (body.gpuType !== undefined) {
      if (!['auto', 'amd', 'nvidia'].includes(body.gpuType)) {
        return NextResponse.json(
          { success: false, message: "Invalid gpuType (expected 'auto' | 'amd' | 'nvidia')" },
          { status: 400 }
        );
      }
      updates.gpuType = body.gpuType;
    }

    if (body.codec !== undefined) {
      if (!['h264', 'h265', 'av1'].includes(body.codec)) {
        return NextResponse.json(
          { success: false, message: "Invalid codec (expected 'h264' | 'h265' | 'av1')" },
          { status: 400 }
        );
      }
      updates.codec = body.codec;
    }

    if (body.quality !== undefined) {
      if (!['low', 'medium', 'high', 'ultra'].includes(body.quality)) {
        return NextResponse.json(
          { success: false, message: "Invalid quality (expected 'low' | 'medium' | 'high' | 'ultra')" },
          { status: 400 }
        );
      }
      updates.quality = body.quality;
    }

    if (body.customBitrate !== undefined) {
      if (typeof body.customBitrate !== 'number' || body.customBitrate < 1 || body.customBitrate > 200) {
        return NextResponse.json(
          { success: false, message: 'Invalid customBitrate (expected number 1-200)' },
          { status: 400 }
        );
      }
      updates.customBitrate = body.customBitrate;
    }

    if (body.idleTimeoutMinutes !== undefined) {
      if (typeof body.idleTimeoutMinutes !== 'number' || body.idleTimeoutMinutes < 0 || body.idleTimeoutMinutes > 1440) {
        return NextResponse.json(
          { success: false, message: 'Invalid idleTimeoutMinutes (expected number 0-1440)' },
          { status: 400 }
        );
      }
      updates.idleTimeoutMinutes = body.idleTimeoutMinutes;
    }

    if (body.waylandSocketPath !== undefined) {
      if (typeof body.waylandSocketPath !== 'string' || !body.waylandSocketPath.startsWith('/')) {
        return NextResponse.json(
          { success: false, message: 'Invalid waylandSocketPath (expected absolute path)' },
          { status: 400 }
        );
      }
      updates.waylandSocketPath = body.waylandSocketPath;
    }

    if (body.defaultProfileId !== undefined) {
      if (typeof body.defaultProfileId !== 'string') {
        return NextResponse.json(
          { success: false, message: 'Invalid defaultProfileId (expected string)' },
          { status: 400 }
        );
      }
      updates.defaultProfileId = body.defaultProfileId;
    }

    if (body.autoStart !== undefined) {
      if (typeof body.autoStart !== 'boolean') {
        return NextResponse.json(
          { success: false, message: 'Invalid autoStart (expected boolean)' },
          { status: 400 }
        );
      }
      updates.autoStart = body.autoStart;
    }

    if (body.streamingGraphPath !== undefined) {
      if (typeof body.streamingGraphPath !== 'string' || !body.streamingGraphPath.startsWith('/')) {
        return NextResponse.json(
          { success: false, message: 'Invalid streamingGraphPath (expected absolute path)' },
          { status: 400 }
        );
      }
      updates.streamingGraphPath = body.streamingGraphPath;
    }

    await settingsService.updateStreamingSettings(updates);
    return NextResponse.json({ success: true, message: 'Streaming settings updated successfully' });
  } catch (error) {
    console.error('Failed to update streaming settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update streaming settings', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
