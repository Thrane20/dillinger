import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

const DILLINGER_ROOT = process.env.DILLINGER_ROOT || '/data';
const VOLUME_METADATA_FILE = path.join(DILLINGER_ROOT, 'storage', 'volume-metadata.json');

// Metadata stored for each volume, keyed by mount path
export interface VolumeMetadata {
  friendlyName?: string;
  storageType?: 'ssd' | 'platter' | 'archive';
}

export interface VolumeMetadataStore {
  // Keyed by mount path (e.g., "/data", "/mnt/games")
  volumes: Record<string, VolumeMetadata>;
  defaults: {
    installers: string | null; // mount path
    downloads: string | null;
    installed: string | null;
    roms: string | null;
  };
}

type DefaultType = 'installers' | 'downloads' | 'installed' | 'roms';

async function getVolumeMetadata(): Promise<VolumeMetadataStore> {
  try {
    const content = await fs.readFile(VOLUME_METADATA_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {
      volumes: {},
      defaults: {
        installers: null,
        downloads: null,
        installed: null,
        roms: null,
      },
    };
  }
}

async function saveVolumeMetadata(data: VolumeMetadataStore): Promise<void> {
  const dir = path.dirname(VOLUME_METADATA_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(VOLUME_METADATA_FILE, JSON.stringify(data, null, 2));
}

/**
 * GET /api/volumes/metadata - Get all volume metadata
 */
export async function GET() {
  try {
    const data = await getVolumeMetadata();
    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error getting volume metadata:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to get volume metadata' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/volumes/metadata - Update volume metadata
 * Body can contain:
 * - mountPath: string (required) - the path to update
 * - friendlyName?: string - custom name for the volume
 * - storageType?: 'ssd' | 'platter' | 'archive' | null - storage type
 * - setAsDefault?: DefaultType - set this volume as default for a purpose
 * - clearDefault?: DefaultType - clear this volume as default for a purpose
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { mountPath, friendlyName, storageType, setAsDefault, clearDefault } = body;

    if (!mountPath) {
      return NextResponse.json(
        { success: false, error: 'mountPath is required' },
        { status: 400 }
      );
    }

    const data = await getVolumeMetadata();

    // Ensure volume entry exists
    if (!data.volumes[mountPath]) {
      data.volumes[mountPath] = {};
    }

    // Update friendly name
    if (friendlyName !== undefined) {
      if (friendlyName) {
        data.volumes[mountPath].friendlyName = friendlyName;
      } else {
        delete data.volumes[mountPath].friendlyName;
      }
    }

    // Update storage type
    if (storageType !== undefined) {
      if (storageType) {
        data.volumes[mountPath].storageType = storageType;
      } else {
        delete data.volumes[mountPath].storageType;
      }
    }

    // Set as default
    if (setAsDefault && ['installers', 'downloads', 'installed', 'roms'].includes(setAsDefault)) {
      data.defaults[setAsDefault as DefaultType] = mountPath;
    }

    // Clear as default
    if (clearDefault && ['installers', 'downloads', 'installed', 'roms'].includes(clearDefault)) {
      if (data.defaults[clearDefault as DefaultType] === mountPath) {
        data.defaults[clearDefault as DefaultType] = null;
      }
    }

    // Clean up empty volume entries
    if (Object.keys(data.volumes[mountPath]).length === 0) {
      delete data.volumes[mountPath];
    }

    await saveVolumeMetadata(data);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error updating volume metadata:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update volume metadata' },
      { status: 500 }
    );
  }
}
