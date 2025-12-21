import { NextRequest, NextResponse } from 'next/server';
import { DownloadManager } from '@/lib/services/download-manager';
import fs from 'fs-extra';
import path from 'path';
import { JSONStorageService } from '@/lib/services/storage';
import type { Game } from '@dillinger/shared';

// Disable caching for this dynamic route
export const dynamic = 'force-dynamic';

const storage = JSONStorageService.getInstance();

/**
 * Extract GOG ID from a game ID string
 * Handles both old format "gog-{gogId}" and new format "gog-{slug}-{gogId}"
 */
function extractGogIdFromGameId(gameId: string): string | null {
  if (!gameId.startsWith('gog-')) return null;
  
  // New format: gog-{slug}-{gogId} - gogId is the last part (numbers only)
  const parts = gameId.split('-');
  const lastPart = parts[parts.length - 1];
  if (/^\d+$/.test(lastPart)) {
    return lastPart;
  }
  
  // Old format: gog-{gogId}
  return gameId.replace('gog-', '');
}

/**
 * Find cache directory for a GOG game
 * Searches for directories starting with the gogId
 */
async function findCacheDirectory(gogId: string): Promise<string | null> {
  const dillingerRoot = storage.getDillingerRoot();
  const cacheBasePath = path.join(dillingerRoot, 'storage', 'installer_cache');
  
  if (!await fs.pathExists(cacheBasePath)) return null;
  
  const dirs = await fs.readdir(cacheBasePath);
  
  // Look for directory that starts with the gogId (handles both old and new formats)
  // Old format: just gogId (e.g., "2083200433")
  // New format: gogId-slug (e.g., "2083200433-dragons-lair-trilogy")
  for (const dir of dirs) {
    if (dir === gogId || dir.startsWith(`${gogId}-`)) {
      return path.join(cacheBasePath, dir);
    }
  }
  
  return null;
}

/**
 * GET /api/online-sources/gog/downloads/[gameId]/cache
 * Check if cache files exist for a download
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    
    // Check if there's an active download for this game
    const downloadManager = await DownloadManager.getInitializedInstance();
    const download = downloadManager.getDownloadStatus(gameId);
    
    // Also check for cache files on disk
    let cacheExists = false;
    let cacheSize = 0;
    let fileCount = 0;
    let gogId = '';
    let cachePath: string | null = null;
    
    // Get the gogId from the download or from the game id
    if (download) {
      // download.gogId contains the cache directory name
      cachePath = download.downloadPath;
      gogId = download.gogId;
    } else {
      // Try to extract gogId from game ID
      const game = await storage.readEntity<Game>('games', gameId);
      const sourceId = game?.id || gameId;
      gogId = extractGogIdFromGameId(sourceId) || '';
      
      if (gogId) {
        cachePath = await findCacheDirectory(gogId);
      }
    }
    
    if (cachePath && await fs.pathExists(cachePath)) {
      const files = await fs.readdir(cachePath);
      fileCount = files.length;
      cacheExists = fileCount > 0;
      
      // Calculate total size
      for (const file of files) {
        const stat = await fs.stat(path.join(cachePath, file));
        cacheSize += stat.size;
      }
    }
    
    return NextResponse.json({
      success: true,
      hasActiveDownload: download !== null && download.status !== 'completed' && download.status !== 'failed',
      downloadStatus: download?.status || null,
      downloadProgress: download?.totalProgress || 0,
      cacheExists,
      cacheSize,
      fileCount,
      gogId,
    });
  } catch (error) {
    console.error('Error checking download cache:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check download cache' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/online-sources/gog/downloads/[gameId]/cache
 * Delete cache files for a download
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    
    let cachePath: string | null = null;
    let gogId = '';
    
    // First check active downloads
    const downloadManager = await DownloadManager.getInitializedInstance();
    const download = downloadManager.getDownloadStatus(gameId);
    
    if (download) {
      cachePath = download.downloadPath;
      gogId = download.gogId;
      // Cancel any active download
      await downloadManager.cancelDownload(gameId);
    } else {
      // Try to extract gogId from game ID
      const game = await storage.readEntity<Game>('games', gameId);
      const sourceId = game?.id || gameId;
      gogId = extractGogIdFromGameId(sourceId) || '';
      
      if (gogId) {
        cachePath = await findCacheDirectory(gogId);
      }
    }
    
    if (!cachePath) {
      return NextResponse.json(
        { success: false, error: 'Could not find cache directory for game' },
        { status: 404 }
      );
    }
    
    if (await fs.pathExists(cachePath)) {
      await fs.remove(cachePath);
      console.log(`[Download Cache] Deleted cache at ${cachePath}`);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Cache deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting download cache:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete download cache' },
      { status: 500 }
    );
  }
}
