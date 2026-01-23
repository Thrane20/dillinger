/**
 * DXVK Default Version API
 * 
 * PUT /api/dxvk-versions/default - Set the default DXVK version
 */

import { NextRequest, NextResponse } from 'next/server';
import { dxvkVersionsService } from '@/lib/services/dxvk-versions';

/**
 * PUT /api/dxvk-versions/default
 * Set the default DXVK version
 * Body: { versionId: string | null } (null = use winetricks default)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { versionId } = body;
    
    await dxvkVersionsService.setDefaultVersion(versionId);
    
    return NextResponse.json({ success: true, defaultId: versionId });
  } catch (error) {
    console.error('Error setting default DXVK version:', error);
    const message = error instanceof Error ? error.message : 'Failed to set default version';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
