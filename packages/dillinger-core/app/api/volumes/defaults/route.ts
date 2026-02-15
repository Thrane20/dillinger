import { NextRequest, NextResponse } from 'next/server';
import { detectFirstClassVolumes, getVolumeMetadataStore } from '@/lib/services/volume-manager';

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
  const [detected, metadata] = await Promise.all([
    detectFirstClassVolumes(),
    getVolumeMetadataStore(),
  ]);

  const installersPath = detected.firstClassStatus.cache.mountPath || '/cache';
  const downloadsPath = detected.firstClassStatus.cache.mountPath || '/cache';
  const installedPath = detected.firstClassStatus.installed.mounts[0]?.mountPath || '/installed';
  const romsPath = detected.firstClassStatus.roms.mountPath || '/roms';

  return {
    defaults: {
      installers: installersPath,
      downloads: downloadsPath,
      installed: installedPath,
      roms: romsPath,
    },
    volumeMetadata: metadata.volumes,
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
      message: 'Volume defaults are now convention-based and read-only',
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
