export interface Game {
  id: string; // UUID v4
  slug?: string; // URL-friendly identifier (auto-generated from title or manually set)
  title: string; // Display name
  filePath: string; // Absolute path to executable/ROM
  platformId: string; // Reference to Platform entity
  collectionIds: string[]; // Array of Collection UUIDs
  tags: string[]; // User-defined tags
  metadata?: {
    igdbId?: number; // IGDB API ID for metadata linking
    metadataId?: string; // Reference to SavedGameMetadata ID
    description?: string; // Game description
    genre?: string[]; // Game genres
    developer?: string; // Developer name
    publisher?: string; // Publisher name
    releaseDate?: string; // ISO date string
    rating?: number; // User rating 1-10
    playTime?: number; // Total hours played (calculated from session durations)
    playCount?: number; // Number of times the game has been launched
    lastPlayed?: string; // ISO timestamp of last launch
    coverArt?: string; // Local file path to cover image
    screenshots?: string[]; // Array of local screenshot paths
    primaryImage?: string; // Primary display image (from scraped metadata or coverArt)
    backdropImage?: string; // Background image for hover effects
    similarGames?: Array<{
      title: string;
      slug?: string;
      gameId?: string;
      scraperId?: string;
      scraperType?: string;
    }>;
  };
  fileInfo: {
    size: number; // File size in bytes
    lastModified: string; // ISO timestamp
    checksum?: string; // File integrity hash
  };
  settings?: {
    wine?: {
      version?: string; // Wine version for Windows games
      prefix?: string; // Wine prefix configuration
      dlls?: Record<string, string>; // DLL overrides
    };
    emulator?: {
      core?: string; // RetroArch core name
      settings?: Record<string, any>; // Emulator-specific settings
    };
    launch?: {
      command?: string; // Launch command relative to game directory (e.g., "./start.sh")
      arguments?: string[]; // Launch arguments
      environment?: Record<string, string>; // Environment variables
      workingDirectory?: string; // Working directory relative to game directory
    };
  };
  installation?: {
    status?: 'not_installed' | 'installing' | 'installed' | 'failed'; // Installation state
    installPath?: string; // Path where game is installed
    installerPath?: string; // Path to installer file (exe, msi, etc.)
    installedAt?: string; // ISO timestamp when installation completed
    installMethod?: 'manual' | 'automated'; // How the game was installed
    containerId?: string; // Active installation container ID
    error?: string; // Error message if installation failed
  };
  created: string; // ISO timestamp
  updated: string; // ISO timestamp
}

export type PlatformType = 'native' | 'wine' | 'emulator';
export type StreamingMethod = 'games-on-whales' | 'wolf' | 'x11';

export interface Platform {
  id: string; // UUID v4
  name: string; // Display name
  type: PlatformType; // Platform execution type
  description?: string; // Platform description
  configuration: {
    containerImage?: string; // Docker image for game execution
    requiredFiles?: string[]; // Required system files/dependencies
    supportedExtensions: string[]; // File extensions supported
    defaultSettings?: {
      wine?: {
        version: string; // Default Wine version
        defaultDlls?: Record<string, string>; // Default DLL overrides
      };
      emulator?: {
        core: string; // Default RetroArch core
        biosFiles?: string[]; // Required BIOS files
      };
      environment?: Record<string, string>; // Default environment variables
    };
  };
  validation: {
    fileValidation: string[]; // File extension patterns
    pathValidation?: string; // RegEx pattern for valid paths
    requiresBios?: boolean; // Whether platform requires BIOS files
    biosPath?: string; // Path to BIOS directory
  };
  displayStreaming: {
    method: StreamingMethod; // Streaming method
    configuration?: Record<string, any>; // Streaming-specific config
  };
  isActive: boolean; // Whether platform is available
  created: string; // ISO timestamp
  updated: string; // ISO timestamp
}

export type SessionStatus = 'starting' | 'running' | 'paused' | 'stopped' | 'error';

export interface GameSession {
  id: string; // UUID v4
  gameId: string; // Reference to Game entity
  platformId: string; // Reference to Platform entity
  status: SessionStatus; // Session state
  containerId?: string; // Docker container ID when active
  display: {
    method: string; // Display streaming method
    port?: number; // VNC/streaming port
    windowId?: string; // X11 window identifier
  };
  performance: {
    startTime: string; // ISO timestamp
    endTime?: string; // ISO timestamp when stopped
    duration?: number; // Session duration in seconds
    memoryUsage?: number; // Peak memory usage in MB
    cpuUsage?: number; // Average CPU usage percentage
  };
  errors?: {
    timestamp: string; // ISO timestamp
    message: string; // Error description
    code?: string; // Error code
  }[];
  settings: {
    gameSettings?: Record<string, any>; // Game-specific launch settings
    platformSettings?: Record<string, any>; // Platform-specific overrides
  };
  created: string; // ISO timestamp
  updated: string; // ISO timestamp
}

export type SortField = 'title' | 'lastPlayed' | 'rating' | 'created';
export type SortDirection = 'asc' | 'desc';

export interface Collection {
  id: string; // UUID v4
  name: string; // Collection display name
  description?: string; // Collection description
  gameIds: string[]; // Array of Game UUIDs
  metadata: {
    coverArt?: string; // Collection cover image path
    color?: string; // Theme color for UI display
    icon?: string; // Collection icon identifier
  };
  filters?: {
    platforms?: string[]; // Auto-include games from platforms
    tags?: string[]; // Auto-include games with tags
    genres?: string[]; // Auto-include games with genres
  };
  sorting: {
    field: SortField; // Sort field
    direction: SortDirection; // Sort direction
  };
  isSystem: boolean; // Whether collection is system-generated
  isPublic: boolean; // Whether collection is shareable
  created: string; // ISO timestamp
  updated: string; // ISO timestamp
}

export type MetadataSource = 'igdb' | 'manual' | 'file';
export type CacheStatus = 'fetching' | 'complete' | 'error' | 'stale';

export interface MetadataCache {
  gameId: string; // Reference to Game entity
  source: MetadataSource; // Metadata source
  data: {
    title?: string; // Game title from source
    description?: string; // Game description
    genres?: string[]; // Game genres
    platforms?: string[]; // Supported platforms
    developer?: string; // Developer name
    publisher?: string; // Publisher name
    releaseDate?: string; // Release date
    screenshots?: string[]; // Screenshot URLs
    videos?: string[]; // Video URLs
    rating?: number; // External rating
    externalIds?: {
      igdb?: number; // IGDB ID
      steam?: string; // Steam App ID
      gog?: string; // GOG Game ID
    };
  };
  assets: {
    coverArt?: {
      url: string; // Original URL
      localPath?: string; // Local cached file path
      size?: number; // File size in bytes
    };
    screenshots?: Array<{
      url: string; // Original URL
      localPath?: string; // Local cached file path
      size?: number; // File size in bytes
    }>;
  };
  status: CacheStatus; // Cache status
  lastFetched: string; // ISO timestamp
  expiresAt?: string; // ISO timestamp for cache expiration
}

// Index file types for performance optimization
export interface GamesIndex {
  count: number; // Total number of games
  lastUpdated: string; // ISO timestamp
  byPlatform: Record<string, string[]>; // Platform ID -> Game IDs
  byCollection: Record<string, string[]>; // Collection ID -> Game IDs
  byGenre: Record<string, string[]>; // Genre -> Game IDs
  byTag: Record<string, string[]>; // Tag -> Game IDs
  search: {
    titles: Record<string, string[]>; // Lowercase title words -> Game IDs
    fuzzy: Record<string, string[]>; // Fuzzy search terms -> Game IDs
  };
  recent: string[]; // Recently added Game IDs (last 50)
  popular: string[]; // Most played Game IDs (by play time)
}

export interface SessionsIndex {
  count: number; // Total number of sessions
  lastUpdated: string; // ISO timestamp
  active: string[]; // Currently running session IDs
  byGame: Record<string, string[]>; // Game ID -> Session IDs
  byDate: Record<string, string[]>; // Date (YYYY-MM-DD) -> Session IDs
  performance: {
    totalHours: number; // Total gaming hours across all sessions
    averageSession: number; // Average session duration in minutes
    topGames: Array<{
      gameId: string;
      totalHours: number;
    }>;
  };
}