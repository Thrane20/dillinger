import fs from 'fs-extra';
import * as path from 'path';
import { JSONStorageService } from './storage';

interface GOGGameCache {
  id: string;
  title: string;
  image: string | null;
  url: string;
}

interface GOGCacheData {
  games: GOGGameCache[];
  totalPages: number;
  count: number;
  lastFetched: string;
  expiresAt: string;
}

export class GOGCacheService {
  private static instance: GOGCacheService;
  private storage: JSONStorageService;
  private cacheFile: string;

  private constructor() {
    this.storage = JSONStorageService.getInstance();
    const dillingerRoot = this.storage.getDillingerRoot();
    this.cacheFile = path.join(dillingerRoot, 'storage', 'cache', 'gog-games.json');
  }

  static getInstance(): GOGCacheService {
    if (!GOGCacheService.instance) {
      GOGCacheService.instance = new GOGCacheService();
    }
    return GOGCacheService.instance;
  }

  /**
   * Get cached games if available and not expired
   */
  async getCachedGames(): Promise<GOGCacheData | null> {
    try {
      if (!(await fs.pathExists(this.cacheFile))) {
        return null;
      }

      const cacheData: GOGCacheData = await fs.readJson(this.cacheFile);
      
      // Check if cache is expired
      const now = new Date();
      const expiresAt = new Date(cacheData.expiresAt);
      
      if (now > expiresAt) {
        console.log('[GOGCache] Cache expired');
        return null;
      }

      console.log(`[GOGCache] Using cached games (${cacheData.count} games)`);
      return cacheData;
    } catch (error) {
      console.error('[GOGCache] Error reading cache:', error);
      return null;
    }
  }

  /**
   * Save games to cache
   */
  async cacheGames(games: GOGGameCache[], totalPages: number): Promise<void> {
    try {
      await fs.ensureDir(path.dirname(this.cacheFile));

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

      const cacheData: GOGCacheData = {
        games,
        totalPages,
        count: games.length,
        lastFetched: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };

      await fs.writeJson(this.cacheFile, cacheData, { spaces: 2 });
      console.log(`[GOGCache] Cached ${games.length} games (expires at ${expiresAt.toISOString()})`);
    } catch (error) {
      console.error('[GOGCache] Error writing cache:', error);
    }
  }

  /**
   * Clear the cache
   */
  async clearCache(): Promise<void> {
    try {
      if (await fs.pathExists(this.cacheFile)) {
        await fs.remove(this.cacheFile);
        console.log('[GOGCache] Cache cleared');
      }
    } catch (error) {
      console.error('[GOGCache] Error clearing cache:', error);
    }
  }

  /**
   * Check if cache exists and is valid
   */
  async isCacheValid(): Promise<boolean> {
    const cache = await this.getCachedGames();
    return cache !== null;
  }
}
