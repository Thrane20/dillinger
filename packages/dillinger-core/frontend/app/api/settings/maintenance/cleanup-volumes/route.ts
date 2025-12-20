import { NextResponse } from 'next/server';
import { DockerService } from '@/lib/services/docker-service';

const dockerService = DockerService.getInstance();

// POST /api/settings/maintenance/cleanup-volumes - Clean up orphaned Docker volumes
export async function POST() {
  try {
    const result = await dockerService.cleanupOrphanedVolumes();
    
    return NextResponse.json({
      success: true,
      message: `Cleaned up ${result.removed} orphaned volume(s)`,
      removed: result.removed,
      volumes: result.volumes,
    });
  } catch (error) {
    console.error('Failed to cleanup volumes:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error' },
      { status: 500 }
    );
  }
}
