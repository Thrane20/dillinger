import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

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

type DefaultType = 'installers' | 'downloads' | 'installed' | 'roms';

const DILLINGER_ROOT = process.env.DILLINGER_ROOT || '/data';
const DEFAULTS_FILE = path.join(DILLINGER_ROOT, 'storage', 'volume-defaults.json');

async function getDefaults(): Promise<VolumeDefaults> {
  try {
    const content = await fs.readFile(DEFAULTS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    // Return empty defaults if file doesn't exist
    return {
      defaults: {
        installers: null,
        downloads: null,
        installed: null,
        roms: null,
      },
      volumeMetadata: {},
    };
  }
}

async function saveDefaults(data: VolumeDefaults): Promise<void> {
  const dir = path.dirname(DEFAULTS_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(DEFAULTS_FILE, JSON.stringify(data, null, 2));
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
    const body = await request.json();
    const { volumeId, defaultType, storageType } = body;

    const data = await getDefaults();

    // Update default assignment
    if (defaultType && ['installers', 'downloads', 'installed', 'roms'].includes(defaultType)) {
      // Clear this volume from any other default first (a volume can only be one default type)
      // Actually, let's allow a volume to be multiple defaults - user might want same volume for downloads and installers
      data.defaults[defaultType as DefaultType] = volumeId || null;
    }

    // Update storage type metadata
    if (volumeId && storageType !== undefined) {
      if (!data.volumeMetadata[volumeId]) {
        data.volumeMetadata[volumeId] = {};
      }
      if (storageType) {
        data.volumeMetadata[volumeId].storageType = storageType;
      } else {
        delete data.volumeMetadata[volumeId].storageType;
      }
    }

    await saveDefaults(data);

    return NextResponse.json({
      success: true,
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
