import type { VersionedData } from './schema-version.js';

// Platform-specific configuration for a game
export interface GamePlatformConfig {
  platformId: string; // Reference to Platform entity
  filePath?: string; // Absolute path to executable/ROM (platform-specific)
  settings?: {
    wine?: {
      version?: string; // Wine version for Windows games
      prefix?: string; // Wine prefix configuration
      dlls?: Record<string, string>; // DLL overrides (e.g., {"ddraw": "native", "d3d9": "native,builtin"})
      arch?: 'win32' | 'win64'; // Wine architecture (WINEARCH)
      useDxvk?: boolean; // Install DXVK (DirectX to Vulkan translation layer) for better performance and MangoHUD compatibility
      compatibilityMode?: 'none' | 'legacy' | 'win98' | 'winxp' | 'win7' | 'win10'; // Windows compatibility mode preset
      debug?: {
        // Wine debug channels - controls WINEDEBUG environment variable
        // Each channel can be enabled individually for debugging
        relay?: boolean;      // Function call relay (very verbose)
        seh?: boolean;        // Structured exception handling
        tid?: boolean;        // Thread IDs in messages
        timestamp?: boolean;  // Timestamps in messages
        heap?: boolean;       // Heap operations
        file?: boolean;       // File operations
        module?: boolean;     // Module loading
        win?: boolean;        // Window messages
        d3d?: boolean;        // Direct3D operations
        opengl?: boolean;     // OpenGL operations
        all?: boolean;        // Enable all debug output (very verbose!)
      };
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
      fullscreen?: boolean; // Request fullscreen mode (uses Wine virtual desktop)
      resolution?: string; // Window/desktop resolution (e.g., "1920x1080")
      useXrandr?: boolean; // Set display resolution via xrandr before launch
      xrandrMode?: string; // Custom xrandr mode string (e.g., "1920x1080")
      useGamescope?: boolean; // Launch via gamescope for better resolution handling
      gamescopeWidth?: number; // Gamescope internal width
      gamescopeHeight?: number; // Gamescope internal height
      gamescopeOutputWidth?: number; // Gamescope output width (host resolution)
      gamescopeOutputHeight?: number; // Gamescope output height (host resolution)
    };
    gamescope?: {
      enabled?: boolean; // Use gamescope compositor for this game
      width?: number; // Output width (default: 1920)
      height?: number; // Output height (default: 1080)
      refreshRate?: number; // Refresh rate in Hz (default: 60)
      fullscreen?: boolean; // Launch in fullscreen mode
      upscaler?: 'auto' | 'fsr' | 'nis' | 'linear' | 'nearest'; // Upscaling filter
      inputWidth?: number; // Input resolution width for upscaling
      inputHeight?: number; // Input resolution height for upscaling
      borderless?: boolean; // Borderless window mode
      limitFps?: number; // Frame rate limit
    };
    mangohud?: {
      enabled?: boolean; // Enable MangoHUD performance overlay
    };
    moonlight?: {
      enabled?: boolean; // Enable Moonlight streaming for this game
      quality?: 'low' | 'medium' | 'high' | 'ultra'; // Streaming quality preset
      bitrate?: number; // Custom bitrate in Mbps (overrides quality preset)
      framerate?: 30 | 60 | 120; // Target framerate for streaming
      resolution?: string; // Streaming resolution (e.g., "1920x1080")
      codec?: 'h264' | 'h265' | 'av1'; // Video codec
      audioCodec?: 'opus' | 'aac'; // Audio codec
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
}

export interface Game extends VersionedData {
  id: string; // UUID v4
  slug?: string; // URL-friendly identifier (auto-generated from title or manually set)
  title: string; // Display name
  
  // Multi-platform support
  platforms: GamePlatformConfig[]; // Platform-specific configurations
  defaultPlatformId?: string; // Default platform for quick launch
  
  // Deprecated fields (kept for backward compatibility during migration)
  /** @deprecated Use platforms array instead */
  platformId?: string; // Reference to Platform entity
  /** @deprecated Use platforms[].filePath instead */
  filePath?: string; // Absolute path to executable/ROM
  /** @deprecated Use platforms[].settings instead */
  settings?: GamePlatformConfig['settings'];
  /** @deprecated Use platforms[].installation instead */
  installation?: GamePlatformConfig['installation'];
  
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
  created: string; // ISO timestamp
  updated: string; // ISO timestamp
}

export type PlatformType = 'native' | 'wine' | 'emulator';
export type StreamingMethod = 'games-on-whales' | 'wolf' | 'moonlight' | 'x11';
export type GamescopeUpscaler = 'auto' | 'fsr' | 'nis' | 'linear' | 'nearest';
export type MoonlightQuality = 'low' | 'medium' | 'high' | 'ultra';
export type VideoCodec = 'h264' | 'h265' | 'av1';
export type AudioCodec = 'opus' | 'aac';

export interface Platform extends VersionedData {
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
      gamescope?: {
        enabled?: boolean; // Enable gamescope by default for this platform
        width?: number; // Default output width
        height?: number; // Default output height
        refreshRate?: number; // Default refresh rate
        upscaler?: GamescopeUpscaler; // Default upscaling filter
      };
      moonlight?: {
        enabled?: boolean; // Enable moonlight by default for this platform
        quality?: MoonlightQuality; // Default streaming quality
        framerate?: 30 | 60 | 120; // Default target framerate
      };
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

export interface GameSession extends VersionedData {
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

export interface Collection extends VersionedData {
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

export interface MetadataCache extends VersionedData {
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
export interface GamesIndex extends VersionedData {
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

export interface SessionsIndex extends VersionedData {
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

// Utility functions for multi-platform support

/**
 * Migrates a legacy game (single platform) to the new multi-platform format
 */
export function migrateGameToMultiPlatform(game: Game): Game {
  // If already migrated (has platforms array), return as-is
  if (game.platforms && game.platforms.length > 0) {
    return game;
  }

  // Migrate from legacy format
  const platforms: GamePlatformConfig[] = [];
  
  if (game.platformId) {
    const platformConfig: GamePlatformConfig = {
      platformId: game.platformId,
    };
    if (game.filePath !== undefined) platformConfig.filePath = game.filePath;
    if (game.settings !== undefined) platformConfig.settings = game.settings;
    if (game.installation !== undefined) platformConfig.installation = game.installation;
    
    platforms.push(platformConfig);
  }

  const migratedGame: Game = {
    ...game,
    platforms,
  };
  
  // Only set defaultPlatformId if we have a platformId
  if (game.platformId) {
    migratedGame.defaultPlatformId = game.platformId;
  }

  return migratedGame;
}

/**
 * Gets platform configuration for a specific platform ID
 */
export function getPlatformConfig(game: Game, platformId: string): GamePlatformConfig | undefined {
  const migratedGame = migrateGameToMultiPlatform(game);
  return migratedGame.platforms.find(p => p.platformId === platformId);
}

/**
 * Gets the default platform configuration
 */
export function getDefaultPlatformConfig(game: Game): GamePlatformConfig | undefined {
  const migratedGame = migrateGameToMultiPlatform(game);
  
  if (migratedGame.defaultPlatformId) {
    const config = migratedGame.platforms.find(p => p.platformId === migratedGame.defaultPlatformId);
    if (config) return config;
  }
  
  // Fall back to first platform if no default set
  return migratedGame.platforms[0];
}

/**
 * Gets all configured platform IDs for a game
 */
export function getConfiguredPlatforms(game: Game): string[] {
  const migratedGame = migrateGameToMultiPlatform(game);
  return migratedGame.platforms
    .filter(p => {
      // A platform is configured if it has a filePath or launch command
      return p.filePath || p.settings?.launch?.command;
    })
    .map(p => p.platformId);
}

/**
 * Checks if a game has a platform configured
 */
export function hasPlatformConfigured(game: Game, platformId: string): boolean {
  return getConfiguredPlatforms(game).includes(platformId);
}

/**
 * Adds or updates a platform configuration
 */
export function setPlatformConfig(
  game: Game,
  platformId: string,
  config: Partial<GamePlatformConfig>
): Game {
  const migratedGame = migrateGameToMultiPlatform(game);
  
  const existingIndex = migratedGame.platforms.findIndex(p => p.platformId === platformId);
  
  if (existingIndex >= 0) {
    // Update existing platform
    migratedGame.platforms[existingIndex] = {
      ...migratedGame.platforms[existingIndex],
      ...config,
      platformId, // Ensure platformId doesn't change
    };
  } else {
    // Add new platform
    migratedGame.platforms.push({
      platformId,
      ...config,
    });
  }
  
  // Set as default if it's the first platform
  if (!migratedGame.defaultPlatformId && migratedGame.platforms.length === 1) {
    migratedGame.defaultPlatformId = platformId;
  }
  
  migratedGame.updated = new Date().toISOString();
  return migratedGame;
}

/**
 * Removes a platform configuration
 */
export function removePlatformConfig(game: Game, platformId: string): Game {
  const migratedGame = migrateGameToMultiPlatform(game);
  
  migratedGame.platforms = migratedGame.platforms.filter(p => p.platformId !== platformId);
  
  // If we removed the default platform, set a new default
  if (migratedGame.defaultPlatformId === platformId) {
    if (migratedGame.platforms.length > 0 && migratedGame.platforms[0]) {
      migratedGame.defaultPlatformId = migratedGame.platforms[0].platformId;
    } else {
      delete migratedGame.defaultPlatformId;
    }
  }
  
  migratedGame.updated = new Date().toISOString();
  return migratedGame;
}