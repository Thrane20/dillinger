import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

const DILLINGER_ROOT = process.env.DILLINGER_ROOT || '/data';
const VOLUME_METADATA_FILE = path.join(DILLINGER_ROOT, 'storage', 'volume-metadata.json');

// Metadata stored for each volume, keyed by mount path
export interface VolumeMetadata {
  friendlyName?: string;
  storageType?: 'ssd' | 'platter' | 'archive';
}

export interface VolumeMetadataStore {
  // Keyed by mount path (e.g., "/data", "/mnt/games")
  volumes: Record<string, VolumeMetadata>;
  defaults: {
    installers: string | null; // mount path
    downloads: string | null;
    installed: string | null;
    roms: string | null;
  };
}

export interface DetectedVolume {
  mountPath: string;
  device: string;
  fsType: string;
  isSystem: boolean;
  friendlyName?: string;
  storageType?: 'ssd' | 'platter' | 'archive';
  isDefaultFor: string[]; // e.g., ['installers', 'roms']
}

// System paths to exclude from detected volumes
const SYSTEM_PATHS = [
  '/proc',
  '/sys',
  '/dev',
  '/run',
  '/etc',
  '/var/run',
  '/tmp/.X11-unix',
];

// Paths that are always system/internal
const SYSTEM_PATH_PREFIXES = [
  '/proc/',
  '/sys/',
  '/dev/',
];

async function getVolumeMetadata(): Promise<VolumeMetadataStore> {
  try {
    const content = await fs.readFile(VOLUME_METADATA_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {
      volumes: {},
      defaults: {
        installers: null,
        downloads: null,
        installed: null,
        roms: null,
      },
    };
  }
}

function isSystemPath(mountPath: string): boolean {
  // Exact matches
  if (SYSTEM_PATHS.includes(mountPath)) return true;
  
  // Prefix matches
  for (const prefix of SYSTEM_PATH_PREFIXES) {
    if (mountPath.startsWith(prefix)) return true;
  }
  
  return false;
}

/**
 * GET /api/volumes/detected - Detect all mounted volumes in the container
 * Reads /proc/mounts to find bind mounts and volumes
 */
export async function GET() {
  try {
    // Read /proc/mounts to get all mount points
    const mountsContent = await fs.readFile('/proc/mounts', 'utf-8');
    const lines = mountsContent.trim().split('\n');
    
    // Also get df output for size info (optional enhancement)
    let dfOutput: Record<string, { size: string; used: string; available: string }> = {};
    try {
      const { stdout } = await execAsync('df -h 2>/dev/null || true');
      const dfLines = stdout.trim().split('\n').slice(1); // Skip header
      for (const line of dfLines) {
        const parts = line.split(/\s+/);
        if (parts.length >= 6) {
          const mountPoint = parts[5];
          dfOutput[mountPoint] = {
            size: parts[1],
            used: parts[2],
            available: parts[3],
          };
        }
      }
    } catch {
      // df not critical, continue without it
    }
    
    // Load stored metadata
    const metadata = await getVolumeMetadata();
    
    const detectedVolumes: DetectedVolume[] = [];
    const seenPaths = new Set<string>();
    
    for (const line of lines) {
      const parts = line.split(' ');
      if (parts.length < 4) continue;
      
      const [device, mountPath, fsType] = parts;
      
      // Skip if already seen (can have duplicate entries)
      if (seenPaths.has(mountPath)) continue;
      seenPaths.add(mountPath);
      
      // Skip system paths
      if (isSystemPath(mountPath)) continue;
      
      // Skip certain filesystem types
      if (['proc', 'sysfs', 'devpts', 'tmpfs', 'cgroup', 'cgroup2', 'securityfs', 
           'pstore', 'debugfs', 'tracefs', 'fusectl', 'mqueue', 'hugetlbfs',
           'autofs', 'devtmpfs', 'configfs', 'bpf'].includes(fsType)) {
        continue;
      }
      
      // Get metadata for this volume
      const volumeMeta = metadata.volumes[mountPath] || {};
      
      // Determine what defaults this volume is assigned to
      const isDefaultFor: string[] = [];
      if (metadata.defaults.installers === mountPath) isDefaultFor.push('installers');
      if (metadata.defaults.downloads === mountPath) isDefaultFor.push('downloads');
      if (metadata.defaults.installed === mountPath) isDefaultFor.push('installed');
      if (metadata.defaults.roms === mountPath) isDefaultFor.push('roms');
      
      detectedVolumes.push({
        mountPath,
        device,
        fsType,
        isSystem: mountPath === '/data', // Only /data (dillinger_root) is the system volume
        friendlyName: volumeMeta.friendlyName,
        storageType: volumeMeta.storageType,
        isDefaultFor,
      });
    }
    
    // Sort: /data first, then alphabetically
    detectedVolumes.sort((a, b) => {
      if (a.mountPath === '/data') return -1;
      if (b.mountPath === '/data') return 1;
      return a.mountPath.localeCompare(b.mountPath);
    });
    
    return NextResponse.json({
      success: true,
      data: {
        volumes: detectedVolumes,
        defaults: metadata.defaults,
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
