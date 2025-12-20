import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// GET /api/volumes/docker/list - List all Docker volumes with their mount points
export async function GET() {
  try {
    const { stdout } = await execAsync('docker volume ls --format "{{json .}}"');
    const volumeLines = stdout.trim().split('\n').filter(Boolean);
    
    const volumeDetails = await Promise.all(
      volumeLines.map(async (line) => {
        try {
          const volumeInfo = JSON.parse(line);
          const volumeName = volumeInfo.Name;
          
          const { stdout: inspectOutput } = await execAsync(`docker volume inspect "${volumeName}"`);
          const inspectData = JSON.parse(inspectOutput);
          
          if (inspectData && inspectData[0]) {
            const mountpoint = inspectData[0].Mountpoint;
            const options = inspectData[0].Options || {};
            const hostPath = options.device || mountpoint;
            
            return {
              name: volumeName,
              mountpoint: hostPath,
              driver: inspectData[0].Driver,
              createdAt: inspectData[0].CreatedAt,
            };
          }
          
          return {
            name: volumeName,
            mountpoint: null,
            driver: volumeInfo.Driver,
          };
        } catch (err) {
          console.error(`Failed to inspect volume ${line}:`, err);
          return null;
        }
      })
    );

    const volumes = volumeDetails.filter(Boolean);

    return NextResponse.json({
      success: true,
      data: volumes,
    });
  } catch (error) {
    console.error('Error listing Docker volumes:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Failed to list Docker volumes' },
      { status: 500 }
    );
  }
}
