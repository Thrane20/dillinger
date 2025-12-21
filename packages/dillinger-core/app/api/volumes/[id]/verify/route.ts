import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { JSONStorageService } from '@/lib/services/storage';
import type { Volume } from '@dillinger/shared';

const execAsync = promisify(exec);
const storage = JSONStorageService.getInstance();

// POST /api/volumes/[id]/verify - Verify volume status and accessibility
export async function POST(
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

    let isAccessible = false;
    let errorMessage: string | null = null;

    if (volume.type === 'docker') {
      try {
        await execAsync(`docker volume inspect "${volume.dockerVolumeName}"`);
        isAccessible = true;
      } catch (error) {
        errorMessage = 'Docker volume not found';
      }
    } else {
      isAccessible = true;
    }

    const updatedVolume: Volume = {
      ...volume,
      lastVerified: new Date().toISOString(),
    };

    await storage.writeEntity('volumes', id, updatedVolume);
    
    return NextResponse.json({
      success: true,
      data: {
        isAccessible,
        errorMessage,
        volume: updatedVolume,
      },
    });
  } catch (error) {
    console.error('Error verifying volume:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Failed to verify volume' },
      { status: 500 }
    );
  }
}
