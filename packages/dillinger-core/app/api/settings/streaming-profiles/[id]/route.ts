import { NextRequest, NextResponse } from 'next/server';
import { StreamingProfileService } from '@/lib/services/streaming-profile';

const streamingProfileService = StreamingProfileService.getInstance();

// GET /api/settings/streaming-profiles/[id] - Get a specific streaming profile
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const profile = await streamingProfileService.getProfile(id);

    if (!profile) {
      return NextResponse.json(
        { success: false, message: `Profile "${id}" not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error('Failed to get streaming profile:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get streaming profile', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT /api/settings/streaming-profiles/[id] - Update a streaming profile
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim() === '') {
        return NextResponse.json(
          { success: false, message: 'Invalid name' },
          { status: 400 }
        );
      }
      updates.name = body.name;
    }

    if (body.description !== undefined) {
      updates.description = body.description || undefined;
    }

    if (body.width !== undefined) {
      if (typeof body.width !== 'number' || body.width < 640 || body.width > 7680) {
        return NextResponse.json(
          { success: false, message: 'Invalid width (expected number 640-7680)' },
          { status: 400 }
        );
      }
      updates.width = body.width;
    }

    if (body.height !== undefined) {
      if (typeof body.height !== 'number' || body.height < 480 || body.height > 4320) {
        return NextResponse.json(
          { success: false, message: 'Invalid height (expected number 480-4320)' },
          { status: 400 }
        );
      }
      updates.height = body.height;
    }

    if (body.refreshRate !== undefined) {
      if (typeof body.refreshRate !== 'number' || body.refreshRate < 24 || body.refreshRate > 360) {
        return NextResponse.json(
          { success: false, message: 'Invalid refreshRate (expected number 24-360)' },
          { status: 400 }
        );
      }
      updates.refreshRate = body.refreshRate;
    }

    if (body.customConfig !== undefined) {
      updates.customConfig = body.customConfig || undefined;
    }

    const profile = await streamingProfileService.updateProfile(id, updates);
    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error('Failed to update streaming profile:', error);
    const status = error instanceof Error && error.message.includes('not found') ? 404 : 500;
    return NextResponse.json(
      { success: false, error: 'Failed to update streaming profile', message: error instanceof Error ? error.message : 'Unknown error' },
      { status }
    );
  }
}

// DELETE /api/settings/streaming-profiles/[id] - Delete a streaming profile
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await streamingProfileService.deleteProfile(id);
    return NextResponse.json({ success: true, message: `Profile "${id}" deleted` });
  } catch (error) {
    console.error('Failed to delete streaming profile:', error);
    let status = 500;
    if (error instanceof Error) {
      if (error.message.includes('not found')) status = 404;
      if (error.message.includes('Cannot delete')) status = 403;
    }
    return NextResponse.json(
      { success: false, error: 'Failed to delete streaming profile', message: error instanceof Error ? error.message : 'Unknown error' },
      { status }
    );
  }
}
