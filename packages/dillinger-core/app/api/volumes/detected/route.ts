import { NextResponse } from 'next/server';
import { detectFirstClassVolumes } from '@/lib/services/volume-manager';

/**
 * GET /api/volumes/detected - Detect all mounted volumes in the container
 * Reads /proc/mounts to find bind mounts and volumes
 */
export async function GET() {
  try {
    const detected = await detectFirstClassVolumes();
    
    return NextResponse.json({
      success: true,
      data: {
        volumes: detected.volumes,
        firstClassStatus: detected.firstClassStatus,
      },
    });
  } catch (error) {
    console.error('Error detecting volumes:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to detect volumes' },
      { status: 500 }
    );
  }
}
