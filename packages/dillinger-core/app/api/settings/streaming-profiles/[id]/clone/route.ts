import { NextRequest, NextResponse } from 'next/server';
import { StreamingProfileService } from '@/lib/services/streaming-profile';

const streamingProfileService = StreamingProfileService.getInstance();

// POST /api/settings/streaming-profiles/[id]/clone - Clone a streaming profile
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sourceId } = await params;
    const body = await request.json();

    // Validate required fields
    if (!body.newId || typeof body.newId !== 'string') {
      return NextResponse.json(
        { success: false, message: 'newId is required' },
        { status: 400 }
      );
    }

    if (!body.newName || typeof body.newName !== 'string') {
      return NextResponse.json(
        { success: false, message: 'newName is required' },
        { status: 400 }
      );
    }

    // Sanitize ID (alphanumeric, hyphens, underscores only)
    const sanitizedId = body.newId.toLowerCase().replace(/[^a-z0-9_-]/g, '-');

    const profile = await streamingProfileService.cloneProfile(sourceId, sanitizedId, body.newName);
    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error('Failed to clone streaming profile:', error);
    let status = 500;
    if (error instanceof Error) {
      if (error.message.includes('not found')) status = 404;
      if (error.message.includes('already exists')) status = 409;
    }
    return NextResponse.json(
      { success: false, error: 'Failed to clone streaming profile', message: error instanceof Error ? error.message : 'Unknown error' },
      { status }
    );
  }
}
