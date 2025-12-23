import type { Game, Platform, GameSession, Collection, SortField, SortDirection } from './game.js';

// API Request types
export interface CreateGameRequest {
  title: string;
  filePath: string;
  platformId: string;
  description?: string;
  genre?: string[];
  developer?: string;
  publisher?: string;
  tags?: string[];
  autoScrapeMetadata?: boolean;
}

export interface UpdateGameRequest {
  title?: string;
  description?: string;
  genre?: string[];
  developer?: string;
  publisher?: string;
  tags?: string[];
  rating?: number;
  notes?: string;
}

export interface LaunchGameRequest {
  gameId: string;
  platformOverrides?: {
    wine?: {
      version?: string;
      dlls?: Record<string, string>;
    };
    emulator?: {
      core?: string;
      settings?: Record<string, any>;
    };
    launch?: {
      arguments?: string[];
      environment?: Record<string, string>;
    };
  };
}

export interface InstallGameRequest {
  installerPath: string; // Path to installer file (exe, msi, etc.)
  installPath: string; // Target installation directory
  platformId: string; // Platform to use for installation
  installerArgs?: string; // Optional installer arguments (e.g. /S, /VERYSILENT)
  debugMode?: boolean; // If true, keep container after exit for debugging
}

export interface InstallGameResponse {
  success: boolean;
  containerId?: string;
  containerName?: string; // Container name for debugging (e.g., dillinger-install-debug-xxx)
  debugMode?: boolean; // True if debug mode was enabled
  message?: string;
  error?: string;
}

export interface CreateCollectionRequest {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface UpdateCollectionRequest {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface AddGamesToCollectionRequest {
  gameIds: string[];
}

export interface RemoveGamesFromCollectionRequest {
  gameIds: string[];
}

// API Query Parameters
export interface GameListQuery {
  search?: string;
  platform?: string;
  genre?: string;
  tags?: string;
  favorite?: boolean;
  collection?: string;
  sort?: SortField;
  order?: SortDirection;
  limit?: number;
  offset?: number;
}

export interface SessionListQuery {
  gameId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface PlatformListQuery {
  type?: string;
  active?: boolean;
}

export interface CollectionListQuery {
  search?: string;
  limit?: number;
  offset?: number;
}

// API Response types
export interface PaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface ErrorResponse {
  error: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  timestamp: string;
}

export interface GameResponse {
  game: Game;
}

export interface GameListResponse {
  games: Game[];
  pagination: PaginationInfo;
}

export interface SessionResponse {
  session: GameSession;
}

export interface SessionListResponse {
  sessions: GameSession[];
  pagination?: PaginationInfo;
}

export interface PlatformResponse {
  platform: Platform;
}

export interface PlatformListResponse {
  platforms: Platform[];
}

export interface CollectionResponse {
  collection: Collection;
}

export interface CollectionListResponse {
  collections: Collection[];
  pagination: PaginationInfo;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  storage: string;
  dataPath: string;
  uptime?: number;
  checks?: {
    storage: boolean;
    docker: boolean;
    metadata: boolean;
  };
}

// Statistics and Analytics types
export interface LibraryStats {
  totalGames: number;
  totalSessions: number;
  totalPlayTime: number; // in hours
  averageSessionLength: number; // in minutes
  topGenres: Array<{ genre: string; count: number }>;
  topPlatforms: Array<{ platform: string; count: number }>;
  recentActivity: Array<{
    type: 'game_added' | 'session_started' | 'session_ended';
    timestamp: string;
    gameId?: string;
    sessionId?: string;
  }>;
}

export interface MetadataSearchRequest {
  query: string;
  platform?: string;
  limit?: number;
}

export interface MetadataSearchResponse {
  results: Array<{
    id: number;
    title: string;
    description?: string;
    coverUrl?: string;
    releaseDate?: string;
    genres?: string[];
    platforms?: string[];
    score?: number;
  }>;
}

// WebSocket types for real-time updates
export interface WSMessage {
  type: string;
  payload: any;
  timestamp: string;
}

export interface SessionUpdateMessage extends WSMessage {
  type: 'session_update';
  payload: {
    sessionId: string;
    status: string;
    performance?: {
      memoryUsage?: number;
      cpuUsage?: number;
    };
  };
}

export interface GameUpdateMessage extends WSMessage {
  type: 'game_update';
  payload: {
    gameId: string;
    action: 'added' | 'updated' | 'deleted';
    game?: Game;
  };
}

// File upload types
export interface FileUploadResponse {
  success: boolean;
  filePath: string;
  size: number;
  mimeType: string;
  checksum: string;
}

// Bulk operations
export interface BulkGameUpdateRequest {
  gameIds: string[];
  updates: UpdateGameRequest;
}

export interface BulkGameDeleteRequest {
  gameIds: string[];
  removeFiles?: boolean;
}

export interface BulkOperationResponse {
  success: number;
  failed: number;
  errors: Array<{
    gameId: string;
    error: string;
  }>;
}