import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { JSONStorageService } from '@/lib/services/storage';
import type { Volume } from '@dillinger/shared';

const execAsync = promisify(exec);
const storage = JSONStorageService.getInstance();

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
