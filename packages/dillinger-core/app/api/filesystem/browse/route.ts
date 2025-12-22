import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
  permissions?: string;
}

// Browse a path inside the dillinger_installed Docker volume (mounted at /installed)
async function browseInstalledVolume(containerPath: string): Promise<{ items: FileItem[]; parentPath: string | null }> {
  const clean = containerPath.startsWith('/installed') ? containerPath : `/installed${containerPath}`;
  const parentPath = clean !== '/installed' ? path.posix.dirname(clean) : null;

  const cmd = `docker run --rm -v dillinger_installed:/installed:ro alpine:latest sh -c 'ls -la "${clean}" 2>/dev/null | tail -n +2'`;

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
      const itemPath = path.posix.join(clean, name);

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
    console.error('Installed volume browse failed:', err);
    throw new Error(`Cannot access installed volume path: ${clean}`);
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
    const { stdout } = await execAsync(cmd, { timeout: 10000 });
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
    throw new Error(`Cannot access path: ${absolutePath}`);
  }
}

// GET /api/filesystem/browse - Browse the file system
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedPath = searchParams.get('path') || os.homedir();

    // Canonical installed volume paths
    if (requestedPath === '/installed' || requestedPath.startsWith('/installed/')) {
      try {
        const { items, parentPath } = await browseInstalledVolume(requestedPath);
        return NextResponse.json({
          success: true,
          data: {
            currentPath: requestedPath,
            parentPath,
            items,
            viaDocker: true,
            volume: 'dillinger_installed',
          },
        });
      } catch (err) {
        return NextResponse.json(
          { success: false, error: err instanceof Error ? err.message : 'Path not found or not accessible' },
          { status: 404 }
        );
      }
    }
    
    const absolutePath = path.resolve(requestedPath);
    
    // First, try to access the path locally (inside container)
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
      // Browse host path via Docker
      try {
        const { items, parentPath } = await browseViaDocker(absolutePath);
        return NextResponse.json({
          success: true,
          data: {
            currentPath: absolutePath,
            parentPath,
            items,
            viaDocker: true, // Flag to indicate this was browsed via Docker
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
