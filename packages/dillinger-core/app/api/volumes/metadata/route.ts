import { NextRequest, NextResponse } from 'next/server';
import {
  getVolumeMetadataStore,
  saveVolumeMetadataStore,
  type VolumeMetadataStore,
} from '@/lib/services/volume-manager';

/**
 * GET /api/volumes/metadata - Get all volume metadata
 */
export async function GET() {
  try {
    const data = await getVolumeMetadataStore();
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
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { mountPath, friendlyName, storageType } = body;

    if (!mountPath) {
      return NextResponse.json(
        { success: false, error: 'mountPath is required' },
        { status: 400 }
      );
    }

    const data = await getVolumeMetadataStore();

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

    // Clean up empty volume entries
    if (Object.keys(data.volumes[mountPath]).length === 0) {
      delete data.volumes[mountPath];
    }

    await saveVolumeMetadataStore(data as VolumeMetadataStore);

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
