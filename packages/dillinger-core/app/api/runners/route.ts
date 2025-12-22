import { NextResponse } from 'next/server';
import Docker from 'dockerode';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// Runner image configuration - maps platform IDs to ghcr.io images
// All images hosted at ghcr.io/thrane20 (Gaming On Linux)
export const RUNNER_IMAGES: Record<string, {
  image: string;
  name: string;
  description: string;
  platforms: string[];
}> = {
  'base': {
    image: 'ghcr.io/thrane20/dillinger/runner-base:latest',
    name: 'Base Runner',
    description: 'Core infrastructure for all runners (X11, GPU, Audio)',
    platforms: [],
  },
  'wine': {
    image: 'ghcr.io/thrane20/dillinger/runner-wine:latest',
    name: 'Wine Runner',
    description: 'Windows games via Wine compatibility layer',
    platforms: ['windows-wine'],
  },
  'vice': {
    image: 'ghcr.io/thrane20/dillinger/runner-vice:latest',
    name: 'VICE Runner',
    description: 'Commodore 64/128/VIC-20/Plus4/PET emulation',
    platforms: ['c64', 'c128', 'vic20', 'plus4', 'pet'],
  },
  'retroarch': {
    image: 'ghcr.io/thrane20/dillinger/runner-retroarch:latest',
    name: 'RetroArch Runner',
    description: 'Multi-system emulation including arcade (MAME)',
    platforms: ['arcade', 'mame', 'nes', 'snes', 'genesis'],
  },
  'fs-uae': {
    image: 'ghcr.io/thrane20/dillinger/runner-fs-uae:latest',
    name: 'FS-UAE Runner',
    description: 'Amiga emulation via FS-UAE',
    platforms: ['amiga', 'amiga500', 'amiga1200', 'cd32'],
  },
  'linux-native': {
    image: 'ghcr.io/thrane20/dillinger/runner-linux-native:latest',
    name: 'Linux Native Runner',
    description: 'Native Linux games and applications',
    platforms: ['linux-native'],
  },
};

export interface RunnerStatus {
  id: string;
  image: string;
  name: string;
  description: string;
  platforms: string[];
  installed: boolean;
  imageId?: string;
  size?: number;
  created?: string;
  pulling?: boolean;
  pullProgress?: number;
}

/**
 * GET /api/runners
 * List all runner images and their installation status
 */
export async function GET() {
  try {
    // Get list of local images
    const images = await docker.listImages({ all: true });
    
    const runners: RunnerStatus[] = [];
    
    for (const [id, config] of Object.entries(RUNNER_IMAGES)) {
      // Check if image exists locally (by repository name)
      const foundImage = images.find(img => 
        img.RepoTags?.some(tag => 
          tag === config.image || 
          tag.startsWith(config.image.split(':')[0])
        )
      );
      
      runners.push({
        id,
        ...config,
        installed: !!foundImage,
        imageId: foundImage?.Id,
        size: foundImage?.Size,
        created: foundImage?.Created ? new Date(foundImage.Created * 1000).toISOString() : undefined,
      });
    }
    
    return NextResponse.json({
      success: true,
      runners,
    });
  } catch (error) {
    console.error('Error listing runners:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list runners' },
      { status: 500 }
    );
  }
}
