/**
 * Wine Versions Default API
 * 
 * PUT /api/wine-versions/default - Set the default Wine version
 * GET /api/wine-versions/default - Get the current default version
 */

import { NextRequest, NextResponse } from 'next/server';
import { wineVersionsService } from '@/lib/services/wine-versions';

/**
 * GET /api/wine-versions/default
 * Get the current default Wine version
 */
export async function GET() {
  try {
    const defaultVersion = await wineVersionsService.getDefaultVersion();
    
    if (!defaultVersion) {
      return NextResponse.json(
        { error: 'No default version set' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(defaultVersion);
  } catch (error) {
    console.error('Error fetching default wine version:', error);
    return NextResponse.json(
      { error: 'Failed to fetch default wine version' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/wine-versions/default
 * Set the default Wine version
 * 
 * Body: { versionId: string }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { versionId } = body;

    if (!versionId || typeof versionId !== 'string') {
      return NextResponse.json(
        { error: 'versionId is required' },
        { status: 400 }
      );
    }

    await wineVersionsService.setDefaultVersion(versionId);
    const defaultVersion = await wineVersionsService.getDefaultVersion();
    
    return NextResponse.json({
      success: true,
      default: defaultVersion,
    });
  } catch (error) {
    console.error('Error setting default wine version:', error);
    const message = error instanceof Error ? error.message : 'Failed to set default';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
