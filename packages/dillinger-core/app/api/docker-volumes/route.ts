import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface DockerVolume {
  name: string;
  driver: string;
  mountpoint: string;
  createdAt?: string;
  size?: string;
}

/**
 * GET /api/docker-volumes - List all Docker volumes on the host
 * Used to show existing volumes that can be linked in the volume manager
 */
export async function GET() {
  console.log('[docker-volumes] API called - fetching Docker volumes from host');
  
  try {
    // Get all Docker volumes with JSON format
    console.log('[docker-volumes] Running: docker volume ls');
    const { stdout } = await execAsync('docker volume ls --format "{{json .}}"', {
      timeout: 10000,
    });

    console.log('[docker-volumes] Found raw output:', stdout.substring(0, 200));
    
    const lines = stdout.trim().split('\n').filter(Boolean);
    const volumes: DockerVolume[] = [];

    console.log(`[docker-volumes] Processing ${lines.length} volumes`);

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        
        // Get detailed info including mountpoint
        const inspectCmd = `docker volume inspect ${parsed.Name}`;
        const { stdout: inspectOutput } = await execAsync(inspectCmd, { timeout: 5000 });
        const inspectData = JSON.parse(inspectOutput);
        
        if (inspectData && inspectData.length > 0) {
          const volumeInfo = inspectData[0];
          volumes.push({
            name: parsed.Name || volumeInfo.Name,
            driver: parsed.Driver || volumeInfo.Driver,
            mountpoint: volumeInfo.Mountpoint,
            createdAt: volumeInfo.CreatedAt,
          });
        }
      } catch (parseError) {
        console.error('[docker-volumes] Failed to parse volume:', line, parseError);
      }
    }

    console.log(`[docker-volumes] Successfully enumerated ${volumes.length} volumes`);
    
    return NextResponse.json({
      success: true,
      data: {
        volumes,
        count: volumes.length,
      },
    });
  } catch (error) {
    console.error('[docker-volumes] Error listing Docker volumes:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list Docker volumes',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
