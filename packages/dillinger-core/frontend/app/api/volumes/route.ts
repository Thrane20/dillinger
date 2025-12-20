import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { JSONStorageService } from '@/lib/services/storage';
import type { Volume } from '@dillinger/shared';

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

// POST /api/volumes - Create a new volume
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, hostPath, type = 'bind' } = body;

    if (!name || !hostPath) {
      return NextResponse.json(
        { success: false, error: 'Name and hostPath are required' },
        { status: 400 }
      );
    }

    const dockerVolumeName = `dillinger_${name.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;

    let status: 'active' | 'error' = 'active';
    let errorMessage: string | null = null;

    if (type === 'docker') {
      try {
        const createCmd = `docker volume create --driver local --opt type=none --opt device="${hostPath}" --opt o=bind "${dockerVolumeName}"`;
        await execAsync(createCmd);
      } catch (error) {
        console.error('Error creating Docker volume:', error);
        status = 'error';
        errorMessage = error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Failed to create Docker volume';
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
      { success: false, error: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Failed to create volume' },
      { status: 500 }
    );
  }
}
