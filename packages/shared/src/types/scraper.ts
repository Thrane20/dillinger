// Scraper system types for game metadata fetching

export type ScraperType = 'igdb' | 'steamgriddb' | 'giantbomb';

export interface ScraperConfig {
  type: ScraperType;
  name: string;
  enabled: boolean;
  requiresAuth: boolean;
}

export interface ScraperSettings {
  igdb?: {
    clientId: string;
    clientSecret: string;
  };
  steamgriddb?: {
    apiKey: string;
  };
  giantbomb?: {
    apiKey: string;
  };
}

export interface GameSearchResult {
  scraperId: string; // Unique ID from the scraper (e.g., IGDB game ID)
  scraperType: ScraperType;
  title: string;
  alternativeTitles?: string[];
  releaseDate?: string; // ISO date string
  platforms?: string[]; // Platform names
  coverUrl?: string; // Thumbnail URL
  summary?: string; // Brief description
}

export interface GameDetailData {
  scraperId: string;
  scraperType: ScraperType;
  title: string;
  slug?: string;
  alternativeTitles?: string[];
  summary?: string;
  storyline?: string;
  releaseDate?: string;
  platforms?: GamePlatformInfo[];
  genres?: string[];
  themes?: string[];
  gameModes?: string[];
  developers?: string[];
  publishers?: string[];
  rating?: number; // Aggregated rating
  ratingCount?: number;
  userRating?: number;
  websites?: GameWebsite[];
  videos?: GameVideo[];
  screenshots?: GameImage[];
  artworks?: GameImage[];
  cover?: GameImage;
  ageRatings?: AgeRating[];
  franchises?: string[];
  collections?: string[];
  dlcs?: string[];
  expansions?: string[];
  standaloneExpansions?: string[];
  remakes?: string[];
  remasters?: string[];
  similarGames?: string[] | SimilarGameInfo[]; // Support both legacy string array and new rich format
}

export interface GamePlatformInfo {
  id: string;
  name: string;
  abbreviation?: string;
  category?: string; // e.g., "console", "pc", "handheld"
}

export interface GameWebsite {
  category: string; // e.g., "official", "steam", "gog"
  url: string;
}

export interface GameVideo {
  name?: string;
  videoId: string; // YouTube video ID
  url: string;
}

export interface GameImage {
  id: string;
  url: string; // Original URL from scraper
  localPath?: string; // Local file path after download
  width?: number;
  height?: number;
  imageType?: 'screenshot' | 'artwork' | 'cover' | 'logo';
}

export interface AgeRating {
  category: string; // e.g., "ESRB", "PEGI"
  rating: string; // e.g., "M", "18+"
}

export interface SimilarGameInfo {
  title: string; // Game title
  slug?: string; // Slug for local game lookup
  gameId?: string; // Local game ID if already in library
  scraperId?: string; // ID from the scraper source
  scraperType?: ScraperType; // Where this similar game came from
}

export interface SavedGameMetadata {
  id: string; // Local UUID
  slug: string; // Human-readable identifier (e.g., "the-legend-of-zelda-breath-of-the-wild")
  scraperData: GameDetailData;
  localImages: {
    cover?: string;
    screenshots: string[];
    artworks: string[];
  };
  savedAt: string; // ISO timestamp
  lastUpdated: string; // ISO timestamp
}

// API Request/Response types
export interface SearchGamesRequest {
  query: string;
  scraperType: ScraperType;
  limit?: number;
}

export interface SearchGamesResponse {
  results: GameSearchResult[];
  total: number;
}

export interface GetGameDetailRequest {
  scraperId: string;
  scraperType: ScraperType;
}

export interface GetGameDetailResponse {
  game: GameDetailData;
}

export interface SaveGameMetadataRequest {
  scraperId: string;
  scraperType: ScraperType;
  downloadImages: boolean;
}

export interface SaveGameMetadataResponse {
  success: boolean;
  gameId: string; // Local UUID
  message?: string;
}

export interface GetScraperSettingsResponse {
  settings: Partial<ScraperSettings>;
  availableScrapers: ScraperConfig[];
}

export interface UpdateScraperSettingsRequest {
  scraperType: ScraperType;
  credentials: Record<string, string>;
}

export interface UpdateScraperSettingsResponse {
  success: boolean;
  message?: string;
}
