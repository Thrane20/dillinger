import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { JSONStorageService } from '@/lib/services/storage';
import type { Volume } from '@dillinger/shared';

const execAsync = promisify(exec);
const storage = JSONStorageService.getInstance();

interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
  permissions?: string;
}

// Find a configured volume that contains the given path
async function findVolumeForPath(hostPath: string): Promise<{ volume: Volume; relativePath: string } | null> {
  try {
    const volumes = await storage.listEntities<Volume>('volumes');
    
    // Sort by hostPath length descending to match the most specific volume first
    const sortedVolumes = [...volumes].sort((a, b) => b.hostPath.length - a.hostPath.length);
    
    for (const volume of sortedVolumes) {
      if (hostPath === volume.hostPath || hostPath.startsWith(volume.hostPath + '/')) {
        const relativePath = hostPath === volume.hostPath ? '' : hostPath.substring(volume.hostPath.length);
        return { volume, relativePath };
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

// Browse a path inside a Docker volume
async function browseVolume(
  dockerVolumeName: string, 
  relativePath: string,
  originalHostPath: string
): Promise<{ items: FileItem[]; parentPath: string | null }> {
  const containerPath = `/mnt/vol${relativePath || ''}`;
  const parentPath = originalHostPath !== '/' ? path.dirname(originalHostPath) : null;

  const cmd = `docker run --rm -v "${dockerVolumeName}:/mnt/vol:ro" alpine:latest sh -c 'ls -la "${containerPath}" 2>/dev/null | tail -n +2'`;

  try {
    const { stdout } = await execAsync(cmd, { timeout: 15000 });
    const lines = stdout.trim().split('\n').filter(Boolean);

    const items: FileItem[] = [];
    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length < 9) continue;

      const permissions = parts[0];
      const size = parseInt(parts[4], 10);
      const name = parts.slice(8).join(' ');

      if (name === '.' || name === '..') continue;

      const isDirectory = permissions.startsWith('d');
      // Return the host path, not container path
      const itemPath = path.posix.join(originalHostPath, name);

      items.push({
        name,
        path: itemPath,
        type: isDirectory ? 'directory' : 'file',
        size: isDirectory ? undefined : Number.isFinite(size) ? size : undefined,
        permissions: permissions.slice(1, 10),
      });
    }

    items.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'directory' ? -1 : 1;
    });

    return { items, parentPath };
  } catch (err) {
    console.error('Volume browse failed:', err);
    throw new Error(`Cannot access path: ${originalHostPath}`);
  }
}

// Browse a path on the host using a temporary Docker container
async function browseViaDocker(hostPath: string): Promise<{ items: FileItem[]; parentPath: string | null }> {
  const absolutePath = path.resolve(hostPath);
  const parentPath = absolutePath !== '/' ? path.dirname(absolutePath) : null;
  
  // Use a minimal Alpine container to list the directory
  // The path is mounted read-only for safety
  const cmd = `docker run --rm -v "${absolutePath}":"${absolutePath}":ro alpine:latest sh -c 'ls -la "${absolutePath}" 2>/dev/null | tail -n +2'`;
  
  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: 15000 });
    
    // Check if mount failed
    if (stderr && stderr.includes('no such file or directory')) {
      throw new Error('Path not accessible. You can only traverse Docker volumes already created. Full access to the file system is not possible without adding a volume mount first.');
    }
    
    const lines = stdout.trim().split('\n').filter(Boolean);
    
    const items: FileItem[] = [];
    for (const line of lines) {
      // Parse ls -la output: drwxr-xr-x 2 root root 4096 Jan  1 00:00 dirname
      const parts = line.split(/\s+/);
      if (parts.length < 9) continue;
      
      const permissions = parts[0];
      const size = parseInt(parts[4], 10);
      const name = parts.slice(8).join(' ');
      
      // Skip . and ..
      if (name === '.' || name === '..') continue;
      
      const isDirectory = permissions.startsWith('d');
      const itemPath = path.join(absolutePath, name);
      
      items.push({
        name,
        path: itemPath,
        type: isDirectory ? 'directory' : 'file',
        size: isDirectory ? undefined : size,
        permissions: permissions.slice(1, 10),
      });
    }
    
    // Sort: directories first, then alphabetically
    items.sort((a, b) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name);
      }
      return a.type === 'directory' ? -1 : 1;
    });
    
    return { items, parentPath };
  } catch (err) {
    console.error('Docker browse failed:', err);
    const errorMsg = err instanceof Error ? err.message : 'Cannot access path';
    throw new Error(errorMsg.includes('volume mount') ? errorMsg : `Cannot access path: ${absolutePath}. You can only traverse Docker volumes already created. Full access to the file system is not possible without adding a volume mount first.`);
  }
}

// GET /api/filesystem/browse - Browse the file system
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedPath = searchParams.get('path') || os.homedir();
    
    const absolutePath = path.resolve(requestedPath);
    
    // First, check if this path is on a configured volume
    const volumeMatch = await findVolumeForPath(absolutePath);
    if (volumeMatch) {
      try {
        const { items, parentPath } = await browseVolume(
          volumeMatch.volume.dockerVolumeName,
          volumeMatch.relativePath,
          absolutePath
        );
        return NextResponse.json({
          success: true,
          data: {
            currentPath: absolutePath,
            parentPath,
            items,
            viaDocker: true,
            volume: volumeMatch.volume.name,
          },
        });
      } catch (err) {
        return NextResponse.json(
          { success: false, error: err instanceof Error ? err.message : 'Path not found or not accessible' },
          { status: 404 }
        );
      }
    }
    
    // Try to access the path locally (inside container)
    let useDocker = false;
    try {
      const stats = await fs.stat(absolutePath);
      if (!stats.isDirectory()) {
        return NextResponse.json(
          { success: false, error: 'Path is not a directory' },
          { status: 400 }
        );
      }
    } catch {
      // Path not accessible locally - try via Docker (for host paths)
      useDocker = true;
    }

    if (useDocker) {
      // Browse host path via Docker (direct bind mount)
      try {
        const { items, parentPath } = await browseViaDocker(absolutePath);
        return NextResponse.json({
          success: true,
          data: {
            currentPath: absolutePath,
            parentPath,
            items,
            viaDocker: true,
          },
        });
      } catch (dockerErr) {
        return NextResponse.json(
          { success: false, error: dockerErr instanceof Error ? dockerErr.message : 'Path not found or not accessible' },
          { status: 404 }
        );
      }
    }

    // Local filesystem browse
    const entries = await fs.readdir(absolutePath, { withFileTypes: true });
    
    const items: FileItem[] = await Promise.all(
      entries.map(async (entry) => {
        const itemPath = path.join(absolutePath, entry.name);
        try {
          const stats = await fs.stat(itemPath);
          return {
            name: entry.name,
            path: itemPath,
            type: entry.isDirectory() ? 'directory' as const : 'file' as const,
            size: entry.isFile() ? stats.size : undefined,
            modified: stats.mtime.toISOString(),
            permissions: stats.mode.toString(8).slice(-3),
          };
        } catch {
          return {
            name: entry.name,
            path: itemPath,
            type: entry.isDirectory() ? 'directory' as const : 'file' as const,
          };
        }
      })
    );

    items.sort((a, b) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name);
      }
      return a.type === 'directory' ? -1 : 1;
    });

    const parentPath = absolutePath !== path.parse(absolutePath).root
      ? path.dirname(absolutePath)
      : null;

    return NextResponse.json({
      success: true,
      data: {
        currentPath: absolutePath,
        parentPath,
        items,
      },
    });
  } catch (error) {
    console.error('Error browsing filesystem:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Failed to browse filesystem' },
      { status: 500 }
    );
  }
}
