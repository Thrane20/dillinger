/**
 * Wine Version by ID API
 * 
 * GET /api/wine-versions/[id] - Get a specific installed version
 * DELETE /api/wine-versions/[id] - Remove an installed version
 */

import { NextRequest, NextResponse } from 'next/server';
import { wineVersionsService } from '@/lib/services/wine-versions';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/wine-versions/[id]
 * Get details of a specific installed Wine version
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  
  try {
    const version = await wineVersionsService.getInstalledVersion(id);
    
    if (!version) {
      return NextResponse.json(
        { error: `Version not found: ${id}` },
        { status: 404 }
      );
    }
    
    return NextResponse.json(version);
  } catch (error) {
    console.error(`Error fetching wine version ${id}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch wine version' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/wine-versions/[id]
 * Remove an installed Wine version
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  
  try {
    await wineVersionsService.removeVersion(id);
    
    return NextResponse.json({
      success: true,
      message: `Removed Wine version: ${id}`,
    });
  } catch (error) {
    console.error(`Error removing wine version ${id}:`, error);
    const message = error instanceof Error ? error.message : 'Failed to remove version';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
