import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { JSONStorageService } from '@/lib/services/storage';
import type { Volume, VolumePurpose } from '@dillinger/shared';
import { access } from 'fs/promises';
import { constants } from 'fs';

const execAsync = promisify(exec);
const storage = JSONStorageService.getInstance();

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
    const { name, hostPath, type = 'bind', purpose = 'other', linkExisting = false, dockerVolumeName: existingVolumeName } = body;

    if (!name || !hostPath) {
      return NextResponse.json(
        { success: false, error: 'Name and hostPath are required' },
        { status: 400 }
      );
    }

    // Validate purpose
    const validPurposes: VolumePurpose[] = ['installers', 'installed', 'roms', 'other'];
    const volumePurpose: VolumePurpose = validPurposes.includes(purpose) ? purpose : 'other';

    // Validate that path exists and is accessible (only for new volumes)
    if (!linkExisting) {
      try {
        await access(hostPath, constants.F_OK | constants.R_OK);
      } catch (error) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Path does not exist or is not accessible',
            warning: 'Please ensure the path exists on the host system'
          },
          { status: 400 }
        );
      }
    }

    let dockerVolumeName: string;
    
    // If linking existing volume, use provided name, otherwise generate one
    if (linkExisting && existingVolumeName) {
      dockerVolumeName = existingVolumeName;
    } else {
      dockerVolumeName = `dillinger_${name.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;
    }

    let status: 'active' | 'error' = 'active';
    let errorMessage: string | null = null;

    // Create Docker volume only if not linking existing
    if (type === 'docker' && !linkExisting) {
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
      id: `vol_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      dockerVolumeName,
      hostPath,
      createdAt: new Date().toISOString(),
      type,
      status,
      purpose: volumePurpose,
    };

    await storage.writeEntity('volumes', volume.id, volume);

    if (status === 'error') {
      return NextResponse.json(
        { success: false, error: errorMessage || 'Failed to create volume', data: volume },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: volume,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating volume:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create volume' },
      { status: 500 }
    );
  }
}

// PATCH /api/volumes?id=<volumeId> - Update volume purpose
export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const volumeId = searchParams.get('id');
    
    if (!volumeId) {
      return NextResponse.json(
        { success: false, error: 'Volume ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { purpose } = body;

    if (!purpose) {
      return NextResponse.json(
        { success: false, error: 'Purpose is required' },
        { status: 400 }
      );
    }

    // Validate purpose
    const validPurposes: VolumePurpose[] = ['installers', 'installed', 'roms', 'other'];
    if (!validPurposes.includes(purpose)) {
      return NextResponse.json(
        { success: false, error: 'Invalid purpose. Must be one of: installers, installed, roms, other' },
        { status: 400 }
      );
    }

    // Get existing volume
    const existingVolume = await storage.readEntity<Volume>('volumes', volumeId);
    if (!existingVolume) {
      return NextResponse.json(
        { success: false, error: 'Volume not found' },
        { status: 404 }
      );
    }

    // Update volume
    const updatedVolume: Volume = {
      ...existingVolume,
      purpose,
    };

    await storage.writeEntity('volumes', volumeId, updatedVolume);

    return NextResponse.json({
      success: true,
      data: updatedVolume,
    });
  } catch (error) {
    console.error('Error updating volume:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update volume' },
      { status: 500 }
    );
  }
}
