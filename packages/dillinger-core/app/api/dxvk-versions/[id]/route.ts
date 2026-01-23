/**
 * DXVK Version Management API
 * 
 * GET /api/dxvk-versions/[id] - Get a specific installed version
 * DELETE /api/dxvk-versions/[id] - Remove an installed version
 */

import { NextRequest, NextResponse } from 'next/server';
import { dxvkVersionsService } from '@/lib/services/dxvk-versions';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/dxvk-versions/[id]
 * Get details of a specific installed DXVK version
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const version = await dxvkVersionsService.getVersion(id);
    
    if (!version) {
      return NextResponse.json(
        { error: `DXVK version ${id} not found` },
        { status: 404 }
      );
    }
    
    return NextResponse.json(version);
  } catch (error) {
    console.error('Error fetching DXVK version:', error);
    return NextResponse.json(
      { error: 'Failed to fetch DXVK version' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/dxvk-versions/[id]
 * Remove an installed DXVK version
 */
export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    await dxvkVersionsService.removeVersion(id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing DXVK version:', error);
    const message = error instanceof Error ? error.message : 'Failed to remove version';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
