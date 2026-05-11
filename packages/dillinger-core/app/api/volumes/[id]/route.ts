import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { JSONStorageService } from '@/lib/services/storage';
import {
  getVolumeMetadataStore,
  saveVolumeMetadataStore,
} from '@/lib/services/volume-manager';
import type { Volume, VolumePurpose, VolumeStorageType } from '@dillinger/shared';

const execAsync = promisify(exec);
const storage = JSONStorageService.getInstance();

function normalizeHostPath(value: string): string {
  return value.trim().replace(/\/+$/, '') || '/';
}

function isVolumePurpose(value: unknown): value is VolumePurpose {
  return ['core', 'roms', 'cache', 'installed', 'downloads', 'installers'].includes(String(value));
}

function isStorageType(value: unknown): value is VolumeStorageType {
  return ['ssd', 'platter', 'archive'].includes(String(value));
}

async function moveMetadata(previousHostPath: string, nextHostPath: string, body: Record<string, unknown>) {
  const data = await getVolumeMetadataStore();
  const previous = data.volumes[previousHostPath] ?? {};
  const next = previousHostPath === nextHostPath ? previous : { ...previous, ...(data.volumes[nextHostPath] ?? {}) };

  if (previousHostPath !== nextHostPath) {
    delete data.volumes[previousHostPath];
  }

  if (body.friendlyName !== undefined) {
    const friendlyName = typeof body.friendlyName === 'string' ? body.friendlyName.trim() : '';
    if (friendlyName) next.friendlyName = friendlyName;
    else delete next.friendlyName;
  }

  if (body.storageType !== undefined) {
    if (isStorageType(body.storageType)) next.storageType = body.storageType;
    else delete next.storageType;
  }

  if (body.purpose !== undefined) {
    if (isVolumePurpose(body.purpose)) next.purpose = body.purpose;
    else delete next.purpose;
  }

  if (Object.values(next).some(Boolean)) {
    data.volumes[nextHostPath] = next;
  } else {
    delete data.volumes[nextHostPath];
  }

  await saveVolumeMetadataStore(data);
}

// GET /api/volumes/[id] - Get a specific volume
export async function GET(
  __request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Volume ID is required' },
        { status: 400 }
      );
    }
    
    const volume = await storage.readEntity<Volume>('volumes', id);

    if (!volume) {
      return NextResponse.json(
        { success: false, error: 'Volume not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: volume,
    });
  } catch (error) {
    console.error('Error reading volume:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Failed to read volume' },
      { status: 500 }
    );
  }
}

// PUT /api/volumes/[id] - Update a volume
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Volume ID is required' },
        { status: 400 }
      );
    }

    const current = await storage.readEntity<Volume>('volumes', id);
    if (!current) {
      return NextResponse.json(
        { success: false, error: 'Volume not found' },
        { status: 404 }
      );
    }

    const updated: Volume = {
      ...current,
      name: typeof body.name === 'string' && body.name.trim() ? body.name.trim() : current.name,
      hostPath: typeof body.hostPath === 'string' && body.hostPath.trim() ? normalizeHostPath(body.hostPath) : current.hostPath,
      dockerVolumeName:
        typeof body.dockerVolumeName === 'string' && body.dockerVolumeName.trim()
          ? body.dockerVolumeName.trim()
          : current.dockerVolumeName,
      type: body.type === 'bind' || body.type === 'docker' ? body.type : current.type,
      status: body.status === 'error' ? 'error' : body.status === 'active' ? 'active' : current.status,
      purpose: body.purpose !== undefined ? (isVolumePurpose(body.purpose) ? body.purpose : undefined) : current.purpose,
    };

    await storage.writeEntity('volumes', updated.id, updated);
    await moveMetadata(current.hostPath, updated.hostPath, { ...body, purpose: updated.purpose ?? null });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Error updating volume:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update volume' },
      { status: 500 }
    );
  }
}

// DELETE /api/volumes/[id] - Delete a volume
export async function DELETE(
  __request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Volume ID is required' },
        { status: 400 }
      );
    }
    
    const volume = await storage.readEntity<Volume>('volumes', id);

    if (!volume) {
      return NextResponse.json(
        { success: false, error: 'Volume not found' },
        { status: 404 }
      );
    }

    if (volume.type === 'docker') {
      try {
        await execAsync(`docker volume rm "${volume.dockerVolumeName}"`);
      } catch (error) {
        console.warn('Failed to remove Docker volume:', error);
      }
    }

    await storage.deleteEntity('volumes', id);

    return NextResponse.json({
      success: true,
      message: 'Volume deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting volume:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Failed to delete volume' },
      { status: 500 }
    );
  }
}
