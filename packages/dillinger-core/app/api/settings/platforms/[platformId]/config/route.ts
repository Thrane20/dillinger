import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs-extra';
import * as path from 'path';

const DILLINGER_ROOT = process.env.DILLINGER_ROOT || '/data';

// GET /api/settings/platforms/[platformId]/config - Get platform master configuration
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ platformId: string }> }
) {
  try {
    const { platformId } = await params;
    
    let configPath = '';
    if (platformId === 'arcade') {
      configPath = path.join(DILLINGER_ROOT, 'storage', 'platform-configs', 'arcade', 'retroarch.cfg');
    } else {
      return NextResponse.json(
        { success: false, message: `Configuration not supported for platform: ${platformId}` },
        { status: 400 }
      );
    }
    
    if (!await fs.pathExists(configPath)) {
      return NextResponse.json(
        { success: false, message: 'Configuration file not found' },
        { status: 404 }
      );
    }
    
    const content = await fs.readFile(configPath, 'utf-8');
    
    return NextResponse.json({
      success: true,
      content,
    });
  } catch (error) {
    console.error('Failed to get platform config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get platform config', message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/settings/platforms/[platformId]/config - Update platform master configuration
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ platformId: string }> }
) {
  try {
    const { platformId } = await params;
    const body = await request.json();
    const { content } = body;
    
    if (!content) {
      return NextResponse.json(
        { success: false, message: 'Missing content' },
        { status: 400 }
      );
    }
    
    let configPath = '';
    if (platformId === 'arcade') {
      configPath = path.join(DILLINGER_ROOT, 'storage', 'platform-configs', 'arcade', 'retroarch.cfg');
    } else {
      return NextResponse.json(
        { success: false, message: `Configuration not supported for platform: ${platformId}` },
        { status: 400 }
      );
    }
    
    await fs.ensureDir(path.dirname(configPath));
    await fs.writeFile(configPath, content, 'utf-8');
    
    return NextResponse.json({
      success: true,
      message: 'Configuration saved successfully',
    });
  } catch (error) {
    console.error('Failed to update platform config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update platform config', message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error' },
      { status: 500 }
    );
  }
}
