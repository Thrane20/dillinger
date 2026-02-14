import { NextRequest, NextResponse } from 'next/server';
import { StreamingProfileService } from '@/lib/services/streaming-profile';
import type { StreamingProfile } from '@dillinger/shared';

const streamingProfileService = StreamingProfileService.getInstance();

// GET /api/settings/streaming-profiles - Get all streaming profiles
export async function GET() {
  try {
    const profiles = await streamingProfileService.getAllProfiles();
    return NextResponse.json({ success: true, profiles });
  } catch (error) {
    console.error('Failed to get streaming profiles:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get streaming profiles', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/settings/streaming-profiles - Create a new streaming profile
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.id || typeof body.id !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Profile ID is required' },
        { status: 400 }
      );
    }

    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { success: false, message: 'Profile name is required' },
        { status: 400 }
      );
    }

    if (!body.width || typeof body.width !== 'number' || body.width < 640 || body.width > 7680) {
      return NextResponse.json(
        { success: false, message: 'Invalid width (expected number 640-7680)' },
        { status: 400 }
      );
    }

    if (!body.height || typeof body.height !== 'number' || body.height < 480 || body.height > 4320) {
      return NextResponse.json(
        { success: false, message: 'Invalid height (expected number 480-4320)' },
        { status: 400 }
      );
    }

    if (!body.refreshRate || typeof body.refreshRate !== 'number' || body.refreshRate < 24 || body.refreshRate > 360) {
      return NextResponse.json(
        { success: false, message: 'Invalid refreshRate (expected number 24-360)' },
        { status: 400 }
      );
    }

    // Sanitize ID (alphanumeric, hyphens, underscores only)
    const sanitizedId = body.id.toLowerCase().replace(/[^a-z0-9_-]/g, '-');

    const profileData: Omit<StreamingProfile, 'created' | 'updated'> = {
      id: sanitizedId,
      name: body.name,
      description: body.description || undefined,
      width: body.width,
      height: body.height,
      refreshRate: body.refreshRate,
      customConfig: body.customConfig || undefined,
    };

    const profile = await streamingProfileService.createProfile(profileData);
    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error('Failed to create streaming profile:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create streaming profile', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: error instanceof Error && error.message.includes('already exists') ? 409 : 500 }
    );
  }
}
