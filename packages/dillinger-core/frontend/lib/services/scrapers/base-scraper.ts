// Base scraper interface for game metadata fetching

import type {
  ScraperType,
  GameSearchResult,
  GameDetailData,
  ScraperSettings,
} from '@dillinger/shared';

export interface IGameScraper {
  readonly type: ScraperType;
  readonly name: string;
  readonly requiresAuth: boolean;

  /**
   * Initialize the scraper with credentials
   */
  initialize(settings: ScraperSettings): Promise<void>;

  /**
   * Check if the scraper is properly configured
   */
  isConfigured(): boolean;

  /**
   * Search for games by title
   */
  search(query: string, limit?: number): Promise<GameSearchResult[]>;

  /**
   * Get detailed information for a specific game
   */
  getGameDetail(scraperId: string): Promise<GameDetailData>;

  /**
   * Download an image from a URL and return the buffer
   */
  downloadImage(url: string): Promise<Buffer>;
}

export abstract class BaseScraper implements IGameScraper {
  abstract readonly type: ScraperType;
  abstract readonly name: string;
  abstract readonly requiresAuth: boolean;

  protected settings?: ScraperSettings;

  async initialize(settings: ScraperSettings): Promise<void> {
    this.settings = settings;
  }

  abstract isConfigured(): boolean;
  abstract search(query: string, limit?: number): Promise<GameSearchResult[]>;
  abstract getGameDetail(scraperId: string): Promise<GameDetailData>;

  async downloadImage(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
