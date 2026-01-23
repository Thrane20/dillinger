import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs-extra';
import { JSONStorageService } from '@/lib/services/storage';
import type { Game } from '@dillinger/shared';

const storage = JSONStorageService.getInstance();

/**
 * Resolve the actual path for a volume default
 */
async function resolveDefaultVolumePath(purpose: 'downloads' | 'installers'): Promise<string | null> {
  try {
    // Read volume defaults from storage
    const volumeDefaults = await storage.readEntity<any>('settings', 'volume-defaults');
    const volumeId = volumeDefaults?.[purpose];
    if (!volumeId) return null;
    
    // Get all volumes
    const volumes = await storage.listEntities<any>('volumes');
    const volume = volumes.find((v: any) => v.id === volumeId);
    
    return volume?.hostPath || null;
  } catch (err) {
    return null;
  }
}

/**
 * GET /api/gog/cache/[gameId]/files
 * 
 * Returns the list of cached installer files for a GOG game.
 * Looks in the downloads cache directory for files associated with the game.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    
    if (!gameId) {
      return NextResponse.json(
        { success: false, error: 'Game ID is required' },
        { status: 400 }
      );
    }

    // Load the game to get its metadata
    const game = await storage.readEntity<Game>('games', gameId);
    if (!game) {
      return NextResponse.json(
        { success: false, error: 'Game not found' },
        { status: 404 }
      );
    }

    // Check if this is a GOG game
    if (!game.tags?.includes('gog')) {
      return NextResponse.json({
        success: true,
        files: [],
        message: 'Not a GOG game',
      });
    }

    const files: Array<{ filename: string; path: string; size: number }> = [];
    
    // Capture game properties for use in helper function
    const gameSlug = game.slug?.toLowerCase() || '';
    const gameTitle = game.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Helper to scan a directory for installer files
    async function scanForInstallers(basePath: string, searchPattern?: string) {
      if (!await fs.pathExists(basePath)) return;
      
      try {
        const entries = await fs.readdir(basePath);
        
        for (const entry of entries) {
          const entryPath = path.join(basePath, entry);
          const stat = await fs.stat(entryPath);
          
          if (stat.isDirectory()) {
            // Check if directory matches our game
            const matchesGame = 
              entry.toLowerCase().includes(gameId.toLowerCase()) ||
              entry.toLowerCase().includes(gameSlug) ||
              entry.toLowerCase().includes(gameTitle);
            
            // Also check for GOG ID in directory name
            const gameIdParts = gameId.match(/gog-(.+)-(\d+)$/);
            const gogId = gameIdParts?.[2];
            const matchesGogId = gogId && entry.includes(gogId);
            
            if (matchesGame || matchesGogId) {
              // Scan this subdirectory for installer files
              const subFiles = await fs.readdir(entryPath);
              for (const file of subFiles) {
                const filePath = path.join(entryPath, file);
                const fileStat = await fs.stat(filePath);
                
                if (fileStat.isFile()) {
                  const ext = path.extname(file).toLowerCase();
                  // Include exe, msi, bin (multi-part), sh (linux installers)
                  if (['.exe', '.msi', '.bin', '.sh'].includes(ext) || 
                      file.toLowerCase().includes('setup') || 
                      file.toLowerCase().includes('installer')) {
                    // Avoid duplicates
                    if (!files.some(f => f.path === filePath)) {
                      files.push({
                        filename: file,
                        path: filePath,
                        size: fileStat.size,
                      });
                    }
                  }
                }
              }
            }
          } else if (stat.isFile() && searchPattern) {
            // Check if file matches search pattern
            const matchesPattern = 
              entry.toLowerCase().includes(searchPattern.toLowerCase());
            
            if (matchesPattern) {
              const ext = path.extname(entry).toLowerCase();
              if (['.exe', '.msi', '.bin', '.sh'].includes(ext)) {
                if (!files.some(f => f.path === entryPath)) {
                  files.push({
                    filename: entry,
                    path: entryPath,
                    size: stat.size,
                  });
                }
              }
            }
          }
        }
      } catch (err) {
        console.error(`Error scanning ${basePath}:`, err);
      }
    }

    // Check the default downloads path first (this is where GOG downloads go)
    const defaultDownloadsPath = '/data/storage/downloads';
    await scanForInstallers(defaultDownloadsPath);
    
    // Check the "with_game" location - installers stored alongside game metadata
    const dillingerRoot = process.env.DILLINGER_ROOT || '/data';
    const gameInstallerPath = path.join(dillingerRoot, 'storage', 'games', gameId, 'installers');
    await scanForInstallers(gameInstallerPath);
    
    // Also check the legacy installer_cache path
    const installerCachePath = path.join(dillingerRoot, 'storage', 'installer_cache');
    await scanForInstallers(installerCachePath);
    
    // Also check any configured downloads volume
    const volumeDownloadsPath = await resolveDefaultVolumePath('downloads');
    if (volumeDownloadsPath && volumeDownloadsPath !== defaultDownloadsPath) {
      await scanForInstallers(volumeDownloadsPath);
    }
    
    // Check the installers volume
    const volumeInstallersPath = await resolveDefaultVolumePath('installers');
    if (volumeInstallersPath) {
      const searchPattern = game.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      await scanForInstallers(volumeInstallersPath, searchPattern);
    }
    
    // Check the legacy gog-cache path
    await scanForInstallers('/data/gog-cache');

    // Sort by filename
    files.sort((a, b) => a.filename.localeCompare(b.filename));

    return NextResponse.json({
      success: true,
      files,
      gameId,
      gameTitle: game.title,
    });
    
  } catch (error) {
    console.error('Error fetching GOG cache files:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch cache files' },
      { status: 500 }
    );
  }
}
