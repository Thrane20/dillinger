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

function sanitizeDockerVolumeSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeHostPath(value: string): string {
  return value.trim().replace(/\/+$/, '') || '/';
}

function isVolumePurpose(value: unknown): value is VolumePurpose {
  return ['core', 'roms', 'cache', 'installed', 'downloads', 'installers'].includes(String(value));
}

function isStorageType(value: unknown): value is VolumeStorageType {
  return ['ssd', 'platter', 'archive'].includes(String(value));
}

async function saveMetadata(hostPath: string, body: Record<string, unknown>) {
  const hasMetadata =
    body.friendlyName !== undefined ||
    body.storageType !== undefined ||
    body.purpose !== undefined;

  if (!hasMetadata) return;

  const metadata = await getVolumeMetadataStore();
  const entry = metadata.volumes[hostPath] ?? {};

  if (body.friendlyName !== undefined) {
    const friendlyName = typeof body.friendlyName === 'string' ? body.friendlyName.trim() : '';
    if (friendlyName) entry.friendlyName = friendlyName;
    else delete entry.friendlyName;
  }

  if (body.storageType !== undefined) {
    if (isStorageType(body.storageType)) entry.storageType = body.storageType;
    else delete entry.storageType;
  }

  if (body.purpose !== undefined) {
    if (isVolumePurpose(body.purpose)) entry.purpose = body.purpose;
    else delete entry.purpose;
  }

  if (Object.values(entry).some(Boolean)) {
    metadata.volumes[hostPath] = entry;
  } else {
    delete metadata.volumes[hostPath];
  }

  await saveVolumeMetadataStore(metadata);
}

// GET /api/volumes - Get all configured volumes
export async function GET() {
  try {
    const volumes = await storage.listEntities<Volume>('volumes');
    return NextResponse.json({
      success: true,
      data: volumes,
    });
  } catch (error) {
    console.error('Error listing volumes:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Failed to list volumes' },
      { status: 500 }
    );
  }
}

// POST /api/volumes - Create a new volume or link existing Docker volume
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type = 'bind', purpose, linkExisting = false, dockerVolumeName: existingVolumeName } = body;
    const hostPath = typeof body.hostPath === 'string' ? normalizeHostPath(body.hostPath) : '';

    if (!name || !hostPath) {
      return NextResponse.json(
        { success: false, error: 'Name and hostPath are required' },
        { status: 400 }
      );
    }

    // Note: We skip filesystem validation here because the container cannot access host paths
    // Docker will validate the path exists on the host when creating the volume

    let dockerVolumeName: string;
    
    // If linking existing volume, use provided name, otherwise generate one
    if (existingVolumeName) {
      dockerVolumeName = String(existingVolumeName).trim();
    } else {
      const segment = sanitizeDockerVolumeSegment(name);
      dockerVolumeName = `dillinger_${segment || 'volume'}`;
    }

    const volumes = await storage.listEntities<Volume>('volumes');
    const existing = volumes.find((volume) =>
      volume.dockerVolumeName === dockerVolumeName ||
      normalizeHostPath(volume.hostPath) === hostPath
    );

    let status: 'active' | 'error' = 'active';
    let errorMessage: string | null = null;

    // Create Docker volume only if not linking existing
    if (type === 'docker' && !linkExisting && !existing) {
      try {
        const createCmd = `docker volume create --driver local --opt type=none --opt device="${hostPath}" --opt o=bind "${dockerVolumeName}"`;
        await execAsync(createCmd);
      } catch (error) {
        console.error('Error creating Docker volume:', error);
        status = 'error';
        errorMessage = error instanceof Error ? error.message : 'Failed to create Docker volume';
      }
    }

    const volume: Volume = {
      ...(existing ?? {}),
      id: existing?.id ?? `vol_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: String(name).trim(),
      dockerVolumeName,
      hostPath,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      type,
      status,
      purpose: isVolumePurpose(purpose) ? purpose : undefined,
    };

    await storage.writeEntity('volumes', volume.id, volume);
    await saveMetadata(hostPath, { ...body, purpose: volume.purpose ?? null });

    if (status === 'error') {
      return NextResponse.json(
        { success: false, error: errorMessage || 'Failed to create volume', data: volume },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: volume,
    }, { status: existing ? 200 : 201 });
  } catch (error) {
    console.error('Error creating volume:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create volume' },
      { status: 500 }
    );
  }
}
