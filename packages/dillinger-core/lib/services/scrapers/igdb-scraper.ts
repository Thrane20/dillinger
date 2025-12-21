// IGDB (Internet Game Database) scraper implementation
// API docs: https://api-docs.igdb.com/

import type {
  ScraperType,
  GameSearchResult,
  GameDetailData,
  GamePlatformInfo,
  GameWebsite,
  GameVideo,
  GameImage,
  AgeRating,
  ScraperSettings,
} from '@dillinger/shared';
import { BaseScraper } from './base-scraper';

interface IGDBAuthResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export class IGDBScraper extends BaseScraper {
  readonly type: ScraperType = 'igdb';
  readonly name = 'IGDB';
  readonly requiresAuth = true;

  private accessToken?: string;
  private tokenExpiry?: number;
  private clientId?: string;
  private clientSecret?: string;

  async initialize(settings: ScraperSettings): Promise<void> {
    await super.initialize(settings);
    this.clientId = settings.igdb?.clientId;
    this.clientSecret = settings.igdb?.clientSecret;

    if (this.clientId && this.clientSecret) {
      await this.authenticate();
    }
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret && this.accessToken);
  }

  private async authenticate(): Promise<void> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('IGDB credentials not configured');
    }

    const url = `https://id.twitch.tv/oauth2/token?client_id=${this.clientId}&client_secret=${this.clientSecret}&grant_type=client_credentials`;

    const response = await fetch(url, { method: 'POST' });
    if (!response.ok) {
      throw new Error(`IGDB authentication failed: ${response.statusText}`);
    }

    const data = (await response.json()) as IGDBAuthResponse;
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000;
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.accessToken || (this.tokenExpiry && Date.now() >= this.tokenExpiry)) {
      await this.authenticate();
    }
  }

  private async makeIGDBRequest(endpoint: string, body: string): Promise<any> {
    await this.ensureAuthenticated();

    if (!this.clientId || !this.accessToken) {
      throw new Error('IGDB not authenticated');
    }

    const response = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
      method: 'POST',
      headers: {
        'Client-ID': this.clientId,
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'text/plain',
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`IGDB API request failed: ${response.statusText}`);
    }

    return response.json();
  }

  async search(query: string, limit: number = 10): Promise<GameSearchResult[]> {
    const body = `
      search "${query}";
      fields name, alternative_names.name, first_release_date, platforms.name, cover.url, summary;
      limit ${limit};
    `;

    const results = await this.makeIGDBRequest('games', body);

    return results.map((game: any) => ({
      scraperId: String(game.id),
      scraperType: this.type,
      title: game.name,
      alternativeTitles: game.alternative_names?.map((alt: any) => alt.name) || [],
      releaseDate: game.first_release_date
        ? new Date(game.first_release_date * 1000).toISOString()
        : undefined,
      platforms: game.platforms?.map((p: any) => p.name) || [],
      coverUrl: game.cover?.url
        ? `https:${game.cover.url.replace('t_thumb', 't_cover_big')}`
        : undefined,
      summary: game.summary,
    }));
  }

  async getGameDetail(scraperId: string): Promise<GameDetailData> {
    const body = `
      fields name, slug, alternative_names.name, summary, storyline, first_release_date,
             platforms.name, platforms.abbreviation, platforms.category,
             genres.name, themes.name, game_modes.name,
             involved_companies.company.name, involved_companies.developer, involved_companies.publisher,
             aggregated_rating, aggregated_rating_count, rating,
             websites.category, websites.url,
             videos.video_id, videos.name,
             screenshots.url, screenshots.width, screenshots.height,
             artworks.url, artworks.width, artworks.height,
             cover.url, cover.width, cover.height,
             age_ratings.category, age_ratings.rating,
             franchises.name, collection.name,
             dlcs.name, expansions.name, standalone_expansions.name,
             remakes.name, remasters.name, similar_games.name;
      where id = ${scraperId};
    `;

    const results = await this.makeIGDBRequest('games', body);

    if (!results || results.length === 0) {
      throw new Error(`Game not found: ${scraperId}`);
    }

    const game = results[0];

    // Extract developers and publishers
    const developers: string[] = [];
    const publishers: string[] = [];
    game.involved_companies?.forEach((ic: any) => {
      const companyName = ic.company?.name;
      if (companyName) {
        if (ic.developer) developers.push(companyName);
        if (ic.publisher) publishers.push(companyName);
      }
    });

    // Process images
    const screenshots: GameImage[] =
      game.screenshots?.map((s: any) => ({
        id: String(s.id || Math.random()),
        url: `https:${s.url?.replace('t_thumb', 't_screenshot_big') || s.url}`,
        width: s.width,
        height: s.height,
        imageType: 'screenshot' as const,
      })) || [];

    const artworks: GameImage[] =
      game.artworks?.map((a: any) => ({
        id: String(a.id || Math.random()),
        url: `https:${a.url?.replace('t_thumb', 't_1080p') || a.url}`,
        width: a.width,
        height: a.height,
        imageType: 'artwork' as const,
      })) || [];

    const cover: GameImage | undefined = game.cover
      ? {
          id: String(game.cover.id),
          url: `https:${game.cover.url?.replace('t_thumb', 't_cover_big') || game.cover.url}`,
          width: game.cover.width,
          height: game.cover.height,
          imageType: 'cover' as const,
        }
      : undefined;

    // Process videos
    const videos: GameVideo[] =
      game.videos?.map((v: any) => ({
        name: v.name,
        videoId: v.video_id,
        url: `https://www.youtube.com/watch?v=${v.video_id}`,
      })) || [];

    // Process websites
    const websiteCategories: Record<number, string> = {
      1: 'official',
      2: 'wikia',
      3: 'wikipedia',
      4: 'facebook',
      5: 'twitter',
      6: 'twitch',
      8: 'instagram',
      9: 'youtube',
      10: 'iphone',
      11: 'ipad',
      12: 'android',
      13: 'steam',
      14: 'reddit',
      15: 'itch',
      16: 'epicgames',
      17: 'gog',
      18: 'discord',
    };

    const websites: GameWebsite[] =
      game.websites?.map((w: any) => ({
        category: websiteCategories[w.category] || 'other',
        url: w.url,
      })) || [];

    // Process age ratings
    const ageRatingCategories: Record<number, string> = {
      1: 'ESRB',
      2: 'PEGI',
    };

    const ageRatingValues: Record<number, Record<number, string>> = {
      1: {
        // ESRB
        6: 'RP',
        7: 'EC',
        8: 'E',
        9: 'E10+',
        10: 'T',
        11: 'M',
        12: 'AO',
      },
      2: {
        // PEGI
        1: '3',
        2: '7',
        3: '12',
        4: '16',
        5: '18',
      },
    };

    const ageRatings: AgeRating[] =
      game.age_ratings
        ?.map((ar: any) => ({
          category: ageRatingCategories[ar.category] || 'Unknown',
          rating: ageRatingValues[ar.category]?.[ar.rating] || 'Unknown',
        }))
        .filter((ar: AgeRating) => ar.category !== 'Unknown') || [];

    // Process platforms
    const platforms: GamePlatformInfo[] =
      game.platforms?.map((p: any) => ({
        id: String(p.id),
        name: p.name,
        abbreviation: p.abbreviation,
        category: this.getPlatformCategory(p.category),
      })) || [];

    return {
      scraperId: String(game.id),
      scraperType: this.type,
      title: game.name,
      slug: game.slug,
      alternativeTitles: game.alternative_names?.map((alt: any) => alt.name) || [],
      summary: game.summary,
      storyline: game.storyline,
      releaseDate: game.first_release_date
        ? new Date(game.first_release_date * 1000).toISOString()
        : undefined,
      platforms,
      genres: game.genres?.map((g: any) => g.name) || [],
      themes: game.themes?.map((t: any) => t.name) || [],
      gameModes: game.game_modes?.map((gm: any) => gm.name) || [],
      developers,
      publishers,
      rating: game.aggregated_rating,
      ratingCount: game.aggregated_rating_count,
      userRating: game.rating,
      websites,
      videos,
      screenshots,
      artworks,
      cover,
      ageRatings,
      franchises: game.franchises?.map((f: any) => f.name) || [],
      collections: game.collection ? [game.collection.name] : [],
      dlcs: game.dlcs?.map((d: any) => d.name) || [],
      expansions: game.expansions?.map((e: any) => e.name) || [],
      standaloneExpansions: game.standalone_expansions?.map((se: any) => se.name) || [],
      remakes: game.remakes?.map((r: any) => r.name) || [],
      remasters: game.remasters?.map((r: any) => r.name) || [],
      similarGames: game.similar_games?.map((sg: any) => sg.name) || [],
    };
  }

  private getPlatformCategory(categoryId: number): string {
    const categories: Record<number, string> = {
      1: 'console',
      2: 'arcade',
      3: 'platform',
      4: 'operating_system',
      5: 'portable_console',
      6: 'computer',
    };
    return categories[categoryId] || 'unknown';
  }
}
