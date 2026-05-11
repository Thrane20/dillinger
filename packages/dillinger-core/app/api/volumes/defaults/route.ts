import { NextRequest, NextResponse } from 'next/server';
import { getVolumeDefaults } from '@/lib/services/volume-defaults';

// Type definitions
export interface VolumeDefaults {
  defaults: {
    installers: string | null;
    downloads: string | null;
    installed: string | null;
    roms: string | null;
  };
  volumeMetadata: Record<string, {
    storageType?: 'ssd' | 'platter' | 'archive';
  }>;
}

async function getDefaults(): Promise<VolumeDefaults> {
  const resolved = await getVolumeDefaults();

  return {
    defaults: {
      installers: resolved.defaults.installers,
      downloads: resolved.defaults.downloads,
      installed: resolved.defaults.installed,
      roms: resolved.defaults.roms,
    },
    volumeMetadata: resolved.volumeMetadata,
  };
}

// GET /api/volumes/defaults - Get current volume defaults and metadata
export async function GET() {
  try {
    const data = await getDefaults();
    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error getting volume defaults:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to get volume defaults' },
      { status: 500 }
    );
  }
}

// PUT /api/volumes/defaults - Update volume defaults
export async function PUT(request: NextRequest) {
  try {
    await request.json().catch(() => ({}));
    const data = await getDefaults();
    return NextResponse.json({
      success: true,
      message: 'Volume defaults follow managed volume roles and are read-only',
      data,
    });
  } catch (error) {
    console.error('Error updating volume defaults:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update volume defaults' },
      { status: 500 }
    );
  }
}
