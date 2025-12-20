import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { DockerService } from '@/lib/services/docker-service';
import type { Game, Platform } from '@dillinger/shared';

const dockerService = DockerService.getInstance();

// POST /api/settings/platforms/retroarch/launch-gui - Launch RetroArch GUI for configuration
export async function POST() {
  try {
    const now = new Date().toISOString();
    const game: Partial<Game> = {
      id: 'retroarch-gui',
      title: 'RetroArch GUI',
      platformId: 'arcade',
      filePath: 'MENU',
      settings: {
        emulator: {
          core: 'mame'
        }
      },
      created: now,
      updated: now,
    };
    
    const platform: Partial<Platform> = {
      id: 'arcade',
      type: 'emulator',
      configuration: {
        containerImage: 'dillinger/runner-retroarch:latest',
        supportedExtensions: ['.zip', '.rom', '.bin']
      }
    };
    
    const sessionId = uuidv4();
    
    const result = await dockerService.launchGame({
      game: game as Game,
      platform: platform as Platform,
      sessionId,
      mode: 'local'
    });
    
    return NextResponse.json({
      success: true,
      message: 'RetroArch GUI launched',
      containerId: result.containerId
    });
  } catch (error) {
    console.error('Failed to launch RetroArch GUI:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to launch RetroArch GUI', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
