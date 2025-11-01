// Scraper manager - coordinates multiple scraper implementations

import type {
  ScraperType,
  ScraperConfig,
  ScraperSettings,
  GameSearchResult,
  GameDetailData,
} from '@dillinger/shared';
import { IGameScraper } from './base-scraper.js';
import { IGDBScraper } from './igdb-scraper.js';

export class ScraperManager {
  private scrapers: Map<ScraperType, IGameScraper> = new Map();
  private settings?: ScraperSettings;

  constructor() {
    // Register available scrapers
    this.registerScraper(new IGDBScraper());
    // Future scrapers can be registered here:
    // this.registerScraper(new SteamGridDBScraper());
    // this.registerScraper(new GiantBombScraper());
  }

  private registerScraper(scraper: IGameScraper): void {
    this.scrapers.set(scraper.type, scraper);
  }

  async initialize(settings: ScraperSettings): Promise<void> {
    this.settings = settings;

    // Initialize all scrapers with their respective settings
    const initPromises = Array.from(this.scrapers.values()).map((scraper) =>
      scraper.initialize(settings)
    );

    await Promise.all(initPromises);
  }

  getAvailableScrapers(): ScraperConfig[] {
    return Array.from(this.scrapers.values()).map((scraper) => ({
      type: scraper.type,
      name: scraper.name,
      enabled: scraper.isConfigured(),
      requiresAuth: scraper.requiresAuth,
    }));
  }

  getScraper(type: ScraperType): IGameScraper {
    const scraper = this.scrapers.get(type);
    if (!scraper) {
      throw new Error(`Scraper not found: ${type}`);
    }
    if (!scraper.isConfigured()) {
      throw new Error(`Scraper not configured: ${type}`);
    }
    return scraper;
  }

  async search(
    type: ScraperType,
    query: string,
    limit?: number
  ): Promise<GameSearchResult[]> {
    const scraper = this.getScraper(type);
    return scraper.search(query, limit);
  }

  async getGameDetail(type: ScraperType, scraperId: string): Promise<GameDetailData> {
    const scraper = this.getScraper(type);
    return scraper.getGameDetail(scraperId);
  }

  async downloadImage(type: ScraperType, url: string): Promise<Buffer> {
    const scraper = this.getScraper(type);
    return scraper.downloadImage(url);
  }
}

// Singleton instance
let scraperManagerInstance: ScraperManager | null = null;

export function getScraperManager(): ScraperManager {
  if (!scraperManagerInstance) {
    scraperManagerInstance = new ScraperManager();
  }
  return scraperManagerInstance;
}
