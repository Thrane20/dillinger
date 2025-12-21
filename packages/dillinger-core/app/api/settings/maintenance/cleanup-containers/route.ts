import { NextResponse } from 'next/server';
import { DockerService } from '@/lib/services/docker-service';

const dockerService = DockerService.getInstance();

// POST /api/settings/maintenance/cleanup-containers - Clean up stopped game containers
export async function POST() {
  try {
    const result = await dockerService.cleanupStoppedContainers();
    
    return NextResponse.json({
      success: true,
      message: `Cleaned up ${result.removed} stopped container(s)`,
      removed: result.removed,
      containers: result.containers,
    });
  } catch (error) {
    console.error('Failed to cleanup containers:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error' },
      { status: 500 }
    );
  }
}
