import fs from 'fs-extra';
import path from 'path';
import type {
  Game,
  GameSession,
  GamesIndex,
  SessionsIndex,
} from '@dillinger/shared';

const DATA_PATH = process.env.DATA_PATH || '/data';

export interface EntityCounts {
  games: number;
  platforms: number;
  sessions: number;
  collections: number;
}

export class JSONStorageService {
  private static instance: JSONStorageService;

  static getInstance(): JSONStorageService {
    if (!JSONStorageService.instance) {
      JSONStorageService.instance = new JSONStorageService();
    }
    return JSONStorageService.instance;
  }

  /**
   * Ensure all required data directories exist
   */
  async ensureDirectories(): Promise<void> {
    const dirs = ['games', 'platforms', 'sessions', 'collections', 'metadata'];
    await Promise.all(
      dirs.map((dir) => fs.ensureDir(path.join(DATA_PATH, dir)))
    );
  }

  /**
   * Write an entity to a JSON file
   */
  async writeEntity<T>(type: string, id: string, data: T): Promise<void> {
    const filePath = path.join(DATA_PATH, type, `${id}.json`);
    await fs.writeJson(filePath, data, { spaces: 2 });
    await this.updateIndex(type);
  }

  /**
   * Read an entity from a JSON file
   */
  async readEntity<T>(type: string, id: string): Promise<T | null> {
    const filePath = path.join(DATA_PATH, type, `${id}.json`);
    try {
      return await fs.readJson(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Delete an entity JSON file
   */
  async deleteEntity(type: string, id: string): Promise<boolean> {
    const filePath = path.join(DATA_PATH, type, `${id}.json`);
    try {
      await fs.remove(filePath);
      await this.updateIndex(type);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  /**
   * List all entities of a given type
   */
  async listEntities<T>(type: string): Promise<T[]> {
    const dirPath = path.join(DATA_PATH, type);
    try {
      const files = await fs.readdir(dirPath);
      const jsonFiles = files.filter(
        (file) => file.endsWith('.json') && file !== 'index.json'
      );

      const entities = await Promise.all(
        jsonFiles.map(async (file) => {
          const filePath = path.join(dirPath, file);
          return fs.readJson(filePath);
        })
      );

      return entities;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Get entity counts for statistics
   */
  async getEntityCounts(): Promise<EntityCounts> {
    const [games, platforms, sessions, collections] = await Promise.all([
      this.listEntities('games'),
      this.listEntities('platforms'),
      this.listEntities('sessions'),
      this.listEntities('collections'),
    ]);

    return {
      games: games.length,
      platforms: platforms.length,
      sessions: sessions.length,
      collections: collections.length,
    };
  }

  /**
   * Search entities by text query
   */
  async searchEntities<T>(
    type: string,
    query: string,
    searchFields: string[]
  ): Promise<T[]> {
    const entities = await this.listEntities<any>(type);
    const lowerQuery = query.toLowerCase();

    return entities.filter((entity) =>
      searchFields.some((field) => {
        const value = this.getNestedValue(entity, field);
        if (typeof value === 'string') {
          return value.toLowerCase().includes(lowerQuery);
        }
        if (Array.isArray(value)) {
          return value.some((item) =>
            typeof item === 'string' && item.toLowerCase().includes(lowerQuery)
          );
        }
        return false;
      })
    );
  }

  /**
   * Filter entities by field values
   */
  async filterEntities<T>(
    type: string,
    filters: Record<string, any>
  ): Promise<T[]> {
    const entities = await this.listEntities<any>(type);

    return entities.filter((entity) =>
      Object.entries(filters).every(([field, expectedValue]) => {
        const actualValue = this.getNestedValue(entity, field);

        if (Array.isArray(expectedValue)) {
          // Filter by array inclusion
          return expectedValue.includes(actualValue);
        }

        if (Array.isArray(actualValue)) {
          // Check if array contains the expected value
          return actualValue.includes(expectedValue);
        }

        return actualValue === expectedValue;
      })
    );
  }

  /**
   * Get paginated entities with optional sorting
   */
  async getPaginatedEntities<T>(
    type: string,
    limit: number = 20,
    offset: number = 0,
    sortField?: string,
    sortDirection: 'asc' | 'desc' = 'desc'
  ): Promise<{ entities: T[]; total: number }> {
    const allEntities = await this.listEntities<any>(type);

    // Sort if requested
    if (sortField) {
      allEntities.sort((a, b) => {
        const aValue = this.getNestedValue(a, sortField);
        const bValue = this.getNestedValue(b, sortField);

        let comparison = 0;
        if (aValue < bValue) comparison = -1;
        if (aValue > bValue) comparison = 1;

        return sortDirection === 'desc' ? -comparison : comparison;
      });
    }

    const entities = allEntities.slice(offset, offset + limit);
    return { entities, total: allEntities.length };
  }

  /**
   * Update index file for performance optimization
   */
  private async updateIndex(type: string): Promise<void> {
    const entities = await this.listEntities(type);
    const indexPath = path.join(DATA_PATH, type, 'index.json');

    if (type === 'games') {
      const gamesIndex = this.buildGamesIndex(entities as Game[]);
      await fs.writeJson(indexPath, gamesIndex, { spaces: 2 });
    } else if (type === 'sessions') {
      const sessionsIndex = this.buildSessionsIndex(entities as GameSession[]);
      await fs.writeJson(indexPath, sessionsIndex, { spaces: 2 });
    } else {
      // Basic index for other entity types
      const basicIndex = {
        count: entities.length,
        lastUpdated: new Date().toISOString(),
        ids: entities.map((entity: any) => entity.id),
      };
      await fs.writeJson(indexPath, basicIndex, { spaces: 2 });
    }
  }

  /**
   * Build optimized games index
   */
  private buildGamesIndex(games: Game[]): GamesIndex {
    const byPlatform: Record<string, string[]> = {};
    const byCollection: Record<string, string[]> = {};
    const byGenre: Record<string, string[]> = {};
    const byTag: Record<string, string[]> = {};
    const titleWords: Record<string, string[]> = {};

    games.forEach((game) => {
      // Platform index
      if (!byPlatform[game.platformId]) {
        byPlatform[game.platformId] = [];
      }
      byPlatform[game.platformId]!.push(game.id);

      // Collection index
      game.collectionIds.forEach((collectionId) => {
        if (!byCollection[collectionId]) {
          byCollection[collectionId] = [];
        }
        byCollection[collectionId]!.push(game.id);
      });

      // Genre index
      game.metadata?.genre?.forEach((genre) => {
        const genreKey = genre.toLowerCase();
        if (!byGenre[genreKey]) {
          byGenre[genreKey] = [];
        }
        byGenre[genreKey]!.push(game.id);
      });

      // Tag index
      game.tags.forEach((tag) => {
        const tagKey = tag.toLowerCase();
        if (!byTag[tagKey]) {
          byTag[tagKey] = [];
        }
        byTag[tagKey]!.push(game.id);
      });

      // Title search index
      const words = game.title.toLowerCase().split(/\s+/);
      words.forEach((word) => {
        if (word.length > 2) {
          if (!titleWords[word]) {
            titleWords[word] = [];
          }
          titleWords[word]!.push(game.id);
        }
      });
    });

    // Sort by play time for popular games
    const gamesWithPlayTime = games
      .filter((game) => game.metadata?.playTime)
      .sort((a, b) => (b.metadata?.playTime || 0) - (a.metadata?.playTime || 0));

    // Recent games (last 50)
    const recentGames = games
      .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
      .slice(0, 50);

    return {
      count: games.length,
      lastUpdated: new Date().toISOString(),
      byPlatform,
      byCollection,
      byGenre,
      byTag,
      search: {
        titles: titleWords,
        fuzzy: titleWords, // Simple implementation, can be enhanced
      },
      recent: recentGames.map((game) => game.id),
      popular: gamesWithPlayTime.slice(0, 20).map((game) => game.id),
    };
  }

  /**
   * Build optimized sessions index
   */
  private buildSessionsIndex(sessions: GameSession[]): SessionsIndex {
    const byGame: Record<string, string[]> = {};
    const byDate: Record<string, string[]> = {};
    const active: string[] = [];

    let totalHours = 0;
    let totalSessions = 0;
    const gamePlayTime: Record<string, number> = {};

    sessions.forEach((session) => {
      // Game index
      if (!byGame[session.gameId]) {
        byGame[session.gameId] = [];
      }
      byGame[session.gameId]!.push(session.id);

      // Date index
      const dateKey = session.performance.startTime.split('T')[0]; // YYYY-MM-DD
      if (dateKey && !byDate[dateKey]) {
        byDate[dateKey] = [];
      }
      if (dateKey) {
        byDate[dateKey]!.push(session.id);
      }

      // Active sessions
      if (session.status === 'running' || session.status === 'starting') {
        active.push(session.id);
      }

      // Performance tracking
      if (session.performance.duration) {
        const hours = session.performance.duration / 3600;
        totalHours += hours;
        totalSessions++;

        if (!gamePlayTime[session.gameId]) {
          gamePlayTime[session.gameId] = 0;
        }
        gamePlayTime[session.gameId]! += hours;
      }
    });

    // Top games by play time
    const topGames = Object.entries(gamePlayTime)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([gameId, totalHours]) => ({ gameId, totalHours }));

    return {
      count: sessions.length,
      lastUpdated: new Date().toISOString(),
      active,
      byGame,
      byDate,
      performance: {
        totalHours,
        averageSession: totalSessions > 0 ? (totalHours * 60) / totalSessions : 0,
        topGames,
      },
    };
  }

  /**
   * Get nested object value by dot notation path
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Check if storage is healthy
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    dataPath: string;
    writable: boolean;
    counts: EntityCounts;
  }> {
    try {
      await this.ensureDirectories();

      // Test write access
      const testPath = path.join(DATA_PATH, '.health-check');
      await fs.writeFile(testPath, 'test');
      await fs.remove(testPath);

      const counts = await this.getEntityCounts();

      return {
        healthy: true,
        dataPath: DATA_PATH,
        writable: true,
        counts,
      };
    } catch (error) {
      return {
        healthy: false,
        dataPath: DATA_PATH,
        writable: false,
        counts: { games: 0, platforms: 0, sessions: 0, collections: 0 },
      };
    }
  }
}