import express, { Request, Response, Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const router: Router = express.Router();

interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
  permissions?: string;
}

interface DirectoryListing {
  currentPath: string;
  parentPath: string | null;
  items: FileItem[];
}

/**
 * GET /api/filesystem/browse
 * Browse the file system starting from a given path
 */
router.get('/browse', async (req: Request, res: Response): Promise<void> => {
  try {
    const requestedPath = (req.query.path as string) || os.homedir();
    
    // Resolve and normalize the path
    const absolutePath = path.resolve(requestedPath);
    
    // Security check - ensure path exists and is accessible
    try {
      const stats = await fs.stat(absolutePath);
      if (!stats.isDirectory()) {
        res.status(400).json({
          success: false,
          error: 'Path is not a directory',
        });
        return;
      }
    } catch (err) {
      res.status(404).json({
        success: false,
        error: 'Path not found or not accessible',
      });
      return;
    }

    // Read directory contents
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
          // If we can't stat the file, return basic info
          return {
            name: entry.name,
            path: itemPath,
            type: entry.isDirectory() ? 'directory' as const : 'file' as const,
          };
        }
      })
    );

    // Sort: directories first, then files, both alphabetically
    items.sort((a, b) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name);
      }
      return a.type === 'directory' ? -1 : 1;
    });

    const parentPath = absolutePath !== path.parse(absolutePath).root
      ? path.dirname(absolutePath)
      : null;

    const listing: DirectoryListing = {
      currentPath: absolutePath,
      parentPath,
      items,
    };

    res.json({
      success: true,
      data: listing,
    });
  } catch (error) {
    console.error('Error browsing filesystem:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to browse filesystem',
    });
  }
});

/**
 * GET /api/filesystem/home
 * Get the user's home directory path
 */
router.get('/home', async (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: {
        path: os.homedir(),
      },
    });
  } catch (error) {
    console.error('Error getting home directory:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get home directory',
    });
  }
});

/**
 * GET /api/filesystem/roots
 * Get filesystem roots (useful for Windows with multiple drives)
 */
router.get('/roots', async (req: Request, res: Response) => {
  try {
    const platform = os.platform();
    let roots: string[];

    if (platform === 'win32') {
      // On Windows, list all drive letters
      roots = [];
      for (let i = 65; i <= 90; i++) {
        const drive = String.fromCharCode(i) + ':\\';
        try {
          await fs.access(drive);
          roots.push(drive);
        } catch {
          // Drive doesn't exist or not accessible
        }
      }
    } else {
      // On Unix-like systems, just return root
      roots = ['/'];
    }

    res.json({
      success: true,
      data: { roots },
    });
  } catch (error) {
    console.error('Error getting filesystem roots:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get filesystem roots',
    });
  }
});

export default router;
