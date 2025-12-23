import { NextResponse } from 'next/server';
import Docker from 'dockerode';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// Base image repository (without tag)
const REGISTRY_BASE = 'ghcr.io/thrane20/dillinger';

// Runner image configuration - maps platform IDs to ghcr.io images
// All images hosted at ghcr.io/thrane20 (Gaming On Linux)
export const RUNNER_IMAGES: Record<string, {
  repository: string;  // Base repository without tag
  name: string;
  description: string;
  platforms: string[];
}> = {
  'base': {
    repository: `${REGISTRY_BASE}/runner-base`,
    name: 'Base Runner',
    description: 'Core infrastructure for all runners (X11, GPU, Audio)',
    platforms: [],
  },
  'wine': {
    repository: `${REGISTRY_BASE}/runner-wine`,
    name: 'Wine Runner',
    description: 'Windows games via Wine compatibility layer',
    platforms: ['windows-wine'],
  },
  'vice': {
    repository: `${REGISTRY_BASE}/runner-vice`,
    name: 'VICE Runner',
    description: 'Commodore 64/128/VIC-20/Plus4/PET emulation',
    platforms: ['c64', 'c128', 'vic20', 'plus4', 'pet'],
  },
  'retroarch': {
    repository: `${REGISTRY_BASE}/runner-retroarch`,
    name: 'RetroArch Runner',
    description: 'Multi-system emulation including arcade (MAME)',
    platforms: ['arcade', 'mame', 'nes', 'snes', 'genesis'],
  },
  'fs-uae': {
    repository: `${REGISTRY_BASE}/runner-fs-uae`,
    name: 'FS-UAE Runner',
    description: 'Amiga emulation via FS-UAE',
    platforms: ['amiga', 'amiga500', 'amiga1200', 'cd32'],
  },
  'linux-native': {
    repository: `${REGISTRY_BASE}/runner-linux-native`,
    name: 'Linux Native Runner',
    description: 'Native Linux games and applications',
    platforms: ['linux-native'],
  },
};

export interface RunnerStatus {
  id: string;
  repository: string;
  image: string;  // Full image reference (repo:tag)
  name: string;
  description: string;
  platforms: string[];
  installed: boolean;
  installedVersion?: string;  // Actual installed version tag
  latestVersion?: string;     // Latest available version from registry
  updateAvailable?: boolean;  // True if latestVersion > installedVersion
  imageId?: string;
  size?: number;
  created?: string;
  pulling?: boolean;
  pullProgress?: number;
}

/**
 * Extract version from Docker image labels or tags
 */
function getInstalledVersion(image: Docker.ImageInfo, repository: string): string | undefined {
  if (!image.RepoTags) return undefined;

  // Find all tags for this repository
  const matchingTags = image.RepoTags.filter(tag => tag.startsWith(repository + ':'));
  
  // Only look for versioned tags (semver format) - no :latest fallback
  const versionTag = matchingTags.find(tag => {
    const tagPart = tag.split(':')[1];
    return tagPart && /^\d+\.\d+\.\d+$/.test(tagPart);
  });
  
  if (versionTag) {
    return versionTag.split(':')[1];
  }
  
  return undefined;
}

/**
 * Fetch latest version tag from ghcr.io registry
 */
async function getLatestVersionFromRegistry(repository: string): Promise<string | undefined> {
  try {
    // ghcr.io uses the OCI distribution API
    // For public packages, we can query tags without authentication
    const [, , packagePath] = repository.match(/^ghcr\.io\/(.+)\/(.+)$/) || [];
    if (!packagePath) return undefined;
    
    // GitHub Container Registry API for listing tags
    const apiUrl = `https://ghcr.io/v2/thrane20/dillinger/${packagePath}/tags/list`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/vnd.oci.image.index.v1+json',
      },
    });
    
    if (!response.ok) {
      // Try unauthenticated token flow for ghcr.io
      const wwwAuth = response.headers.get('www-authenticate');
      if (wwwAuth && response.status === 401) {
        // Extract realm and scope from WWW-Authenticate header
        const realmMatch = wwwAuth.match(/realm="([^"]+)"/);
        const scopeMatch = wwwAuth.match(/scope="([^"]+)"/);
        
        if (realmMatch && scopeMatch) {
          // Get anonymous token
          const tokenUrl = `${realmMatch[1]}?scope=${encodeURIComponent(scopeMatch[1])}&service=ghcr.io`;
          const tokenResponse = await fetch(tokenUrl);
          
          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            
            // Retry with token
            const authResponse = await fetch(apiUrl, {
              headers: {
                'Authorization': `Bearer ${tokenData.token}`,
                'Accept': 'application/vnd.oci.image.index.v1+json',
              },
            });
            
            if (authResponse.ok) {
              const data = await authResponse.json();
              return findLatestVersionTag(data.tags);
            }
          }
        }
      }
      return undefined;
    }
    
    const data = await response.json();
    return findLatestVersionTag(data.tags);
  } catch (error) {
    console.error(`Error fetching registry tags for ${repository}:`, error);
    return undefined;
  }
}

/**
 * Find the highest semantic version from a list of tags
 */
function findLatestVersionTag(tags: string[]): string | undefined {
  if (!tags || !Array.isArray(tags)) return undefined;
  
  // Filter to only semantic version tags
  const versionTags = tags.filter(tag => /^\d+\.\d+\.\d+$/.test(tag));
  
  if (versionTags.length === 0) return undefined;
  
  // Sort by semantic version (descending)
  versionTags.sort((a, b) => {
    const [aMajor, aMinor, aPatch] = a.split('.').map(Number);
    const [bMajor, bMinor, bPatch] = b.split('.').map(Number);
    
    if (aMajor !== bMajor) return bMajor - aMajor;
    if (aMinor !== bMinor) return bMinor - aMinor;
    return bPatch - aPatch;
  });
  
  return versionTags[0];
}

/**
 * Compare two semantic versions
 * Returns true if v1 > v2
 */
function isNewerVersion(v1: string | undefined, v2: string | undefined): boolean {
  if (!v1 || !v2) return false;
  if (v1 === 'latest' || v2 === 'latest') return false;  // Can't compare 'latest'
  
  const [v1Major, v1Minor, v1Patch] = v1.split('.').map(Number);
  const [v2Major, v2Minor, v2Patch] = v2.split('.').map(Number);
  
  if (v1Major !== v2Major) return v1Major > v2Major;
  if (v1Minor !== v2Minor) return v1Minor > v2Minor;
  return v1Patch > v2Patch;
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
    
    // Fetch latest versions in parallel for all runners
    const latestVersionPromises = Object.entries(RUNNER_IMAGES).map(
      async ([id, config]) => {
        const latestVersion = await getLatestVersionFromRegistry(config.repository);
        return { id, latestVersion };
      }
    );
    
    const latestVersions = await Promise.all(latestVersionPromises);
    const latestVersionMap = new Map(latestVersions.map(v => [v.id, v.latestVersion]));
    
    for (const [id, config] of Object.entries(RUNNER_IMAGES)) {
      // Check if image exists locally (by repository name)
      const foundImage = images.find(img => 
        img.RepoTags?.some(tag => 
          tag.startsWith(config.repository + ':')
        )
      );
      
      const installedVersion = foundImage ? getInstalledVersion(foundImage, config.repository) : undefined;
      const latestVersion = latestVersionMap.get(id);
      const updateAvailable = isNewerVersion(latestVersion, installedVersion);
      
      runners.push({
        id,
        repository: config.repository,
        image: `${config.repository}:${installedVersion || 'latest'}`,
        name: config.name,
        description: config.description,
        platforms: config.platforms,
        installed: !!foundImage,
        installedVersion,
        latestVersion,
        updateAvailable,
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
