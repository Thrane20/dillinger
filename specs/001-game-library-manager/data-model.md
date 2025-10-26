# Data Model: Game Library Manager

**Feature**: Game Library Manager  
**Date**: 2025-10-26  
**Storage**: JSON files with GUID linking in Docker volume

## JSON File Structure Overview

All entities are stored as individual JSON files linked by GUIDs, with index files for performance optimization.

```text
/data/
├── games/
│   ├── {uuid}.json          # Individual game files
│   └── index.json           # Search and filter optimization
├── platforms/
│   ├── {uuid}.json          # Platform configuration files
│   └── index.json           # Platform lookup optimization
├── sessions/
│   ├── {uuid}.json          # Active/historical game sessions
│   └── index.json           # Session management optimization
├── collections/
│   ├── {uuid}.json          # User-defined game collections
│   └── index.json           # Collection browsing optimization
└── metadata/
    ├── {game-uuid}-igdb.json # Cached external metadata
    └── index.json            # Metadata cache optimization
```

## Entity Relationship Overview

```text
Game ──┐
       ├── belongsTo ──> Platform (platformId)
       ├── belongsToMany ──> Collection (via collectionIds)
       └── hasMany ──> GameSession (via gameId)
       └── hasOne ──> MetadataCache (via gameId)

Platform ──> hasMany ──> Game (via platformId)

Collection ──> hasMany ──> Game (via gameIds)

GameSession ──┐
             ├── belongsTo ──> Game (gameId)
             └── belongsTo ──> Platform (platformId)
```

All relationships are maintained through GUID references stored in JSON files.

## Core Entities

### Game Entity

**File**: `/data/games/{uuid}.json`

```typescript
interface Game {
  id: string;                    // UUID v4
  title: string;                 // Display name
  filePath: string;              // Absolute path to executable/ROM
  platformId: string;            // Reference to Platform entity
  collectionIds: string[];       // Array of Collection UUIDs
  tags: string[];                // User-defined tags
  metadata?: {
    igdbId?: number;             // IGDB API ID for metadata linking
    description?: string;        // Game description
    genre?: string[];            // Game genres
    developer?: string;          // Developer name
    publisher?: string;          // Publisher name
    releaseDate?: string;        // ISO date string
    rating?: number;             // User rating 1-10
    playTime?: number;           // Hours played
    lastPlayed?: string;         // ISO timestamp
    coverArt?: string;           // Local file path to cover image
    screenshots?: string[];      // Array of local screenshot paths
  };
  fileInfo: {
    size: number;                // File size in bytes
    lastModified: string;        // ISO timestamp
    checksum?: string;           // File integrity hash
  };
  settings?: {
    wine?: {
      version?: string;          // Wine version for Windows games
      prefix?: string;           // Wine prefix configuration
      dlls?: Record<string, string>; // DLL overrides
    };
    emulator?: {
      core?: string;             // RetroArch core name
      settings?: Record<string, any>; // Emulator-specific settings
    };
    launch?: {
      arguments?: string[];      // Launch arguments
      environment?: Record<string, string>; // Environment variables
    };
  };
  created: string;               // ISO timestamp
  updated: string;               // ISO timestamp
}
```

**Validation Rules**:
- `id` must be valid UUID v4 format
- `title` required, max 255 characters
- `filePath` must be valid absolute path
- `platformId` must reference existing Platform
- `collectionIds` must reference existing Collections
- `fileInfo.size` must be positive integer
- Timestamps must be valid ISO 8601 format

### Platform Entity

**File**: `/data/platforms/{uuid}.json`

```typescript
interface Platform {
  id: string;                    // UUID v4
  name: string;                  // Display name (e.g., "Linux Native", "Windows (Wine)")
  type: 'native' | 'wine' | 'emulator'; // Platform execution type
  description?: string;          // Platform description
  configuration: {
    containerImage?: string;     // Docker image for game execution
    requiredFiles?: string[];    // Required system files/dependencies
    supportedExtensions: string[]; // File extensions supported
    defaultSettings?: {
      wine?: {
        version: string;         // Default Wine version
        defaultDlls?: Record<string, string>; // Default DLL overrides
      };
      emulator?: {
        core: string;            // Default RetroArch core
        biosFiles?: string[];    // Required BIOS files
      };
      environment?: Record<string, string>; // Default environment variables
    };
  };
  validation: {
    fileValidation: string[];    // File extension patterns
    pathValidation?: string;     // RegEx pattern for valid paths
    requiresBios?: boolean;      // Whether platform requires BIOS files
    biosPath?: string;           // Path to BIOS directory
  };
  displayStreaming: {
    method: 'games-on-whales' | 'wolf' | 'x11'; // Streaming method
    configuration?: Record<string, any>; // Streaming-specific config
  };
  isActive: boolean;             // Whether platform is available
  created: string;               // ISO timestamp
  updated: string;               // ISO timestamp
}
```

**Validation Rules**:
- `id` must be valid UUID v4 format
- `name` required, max 100 characters
- `type` must be one of defined enum values
- `supportedExtensions` array must not be empty
- `isActive` boolean required

### Game Session Entity

**File**: `/data/sessions/{uuid}.json`

```typescript
interface GameSession {
  id: string;                    // UUID v4
  gameId: string;                // Reference to Game entity
  platformId: string;            // Reference to Platform entity
  status: 'starting' | 'running' | 'paused' | 'stopped' | 'error'; // Session state
  containerId?: string;          // Docker container ID when active
  display: {
    method: string;              // Display streaming method
    port?: number;               // VNC/streaming port
    windowId?: string;           // X11 window identifier
  };
  performance: {
    startTime: string;           // ISO timestamp
    endTime?: string;            // ISO timestamp when stopped
    duration?: number;           // Session duration in seconds
    memoryUsage?: number;        // Peak memory usage in MB
    cpuUsage?: number;           // Average CPU usage percentage
  };
  errors?: {
    timestamp: string;           // ISO timestamp
    message: string;             // Error description
    code?: string;               // Error code
  }[];
  settings: {
    gameSettings?: Record<string, any>; // Game-specific launch settings
    platformSettings?: Record<string, any>; // Platform-specific overrides
  };
  created: string;               // ISO timestamp
  updated: string;               // ISO timestamp
}
```

**Validation Rules**:
- `id` must be valid UUID v4 format
- `gameId` must reference existing Game
- `platformId` must reference existing Platform
- `status` must be one of defined enum values
- `startTime` required, must be valid ISO timestamp
- `endTime` must be after `startTime` if present

### Collection Entity

**File**: `/data/collections/{uuid}.json`

```typescript
interface Collection {
  id: string;                    // UUID v4
  name: string;                  // Collection display name
  description?: string;          // Collection description
  gameIds: string[];             // Array of Game UUIDs
  metadata: {
    coverArt?: string;           // Collection cover image path
    color?: string;              // Theme color for UI display
    icon?: string;               // Collection icon identifier
  };
  filters?: {
    platforms?: string[];        // Auto-include games from platforms
    tags?: string[];             // Auto-include games with tags
    genres?: string[];           // Auto-include games with genres
  };
  sorting: {
    field: 'title' | 'lastPlayed' | 'rating' | 'created'; // Sort field
    direction: 'asc' | 'desc';   // Sort direction
  };
  isSystem: boolean;             // Whether collection is system-generated
  isPublic: boolean;             // Whether collection is shareable
  created: string;               // ISO timestamp
  updated: string;               // ISO timestamp
}
```

**Validation Rules**:
- `id` must be valid UUID v4 format
- `name` required, max 100 characters
- `gameIds` must reference existing Games
- `sorting.field` must be one of defined enum values
- `sorting.direction` must be 'asc' or 'desc'

### Metadata Cache Entity

**File**: `/data/metadata/{game-uuid}-{source}.json`

```typescript
interface MetadataCache {
  gameId: string;                // Reference to Game entity
  source: 'igdb' | 'manual' | 'file'; // Metadata source
  data: {
    title?: string;              // Game title from source
    description?: string;        // Game description
    genres?: string[];           // Game genres
    platforms?: string[];        // Supported platforms
    developer?: string;          // Developer name
    publisher?: string;          // Publisher name
    releaseDate?: string;        // Release date
    screenshots?: string[];      // Screenshot URLs
    videos?: string[];           // Video URLs
    rating?: number;             // External rating
    externalIds?: {
      igdb?: number;             // IGDB ID
      steam?: string;            // Steam App ID
      gog?: string;              // GOG Game ID
    };
  };
  assets: {
    coverArt?: {
      url: string;               // Original URL
      localPath?: string;        // Local cached file path
      size?: number;             // File size in bytes
    };
    screenshots?: Array<{
      url: string;               // Original URL
      localPath?: string;        // Local cached file path
      size?: number;             // File size in bytes
    }>;
  };
  status: 'fetching' | 'complete' | 'error' | 'stale'; // Cache status
  lastFetched: string;           // ISO timestamp
  expiresAt?: string;            // ISO timestamp for cache expiration
}
```

## Index File Structures

### Games Index

**File**: `/data/games/index.json`

```typescript
interface GamesIndex {
  count: number;                 // Total number of games
  lastUpdated: string;           // ISO timestamp
  byPlatform: Record<string, string[]>; // Platform ID -> Game IDs
  byCollection: Record<string, string[]>; // Collection ID -> Game IDs
  byGenre: Record<string, string[]>; // Genre -> Game IDs
  byTag: Record<string, string[]>; // Tag -> Game IDs
  search: {
    titles: Record<string, string[]>; // Lowercase title words -> Game IDs
    fuzzy: Record<string, string[]>; // Fuzzy search terms -> Game IDs
  };
  recent: string[];              // Recently added Game IDs (last 50)
  popular: string[];             // Most played Game IDs (by play time)
}
```

### Sessions Index

**File**: `/data/sessions/index.json`

```typescript
interface SessionsIndex {
  count: number;                 // Total number of sessions
  lastUpdated: string;           // ISO timestamp
  active: string[];              // Currently running session IDs
  byGame: Record<string, string[]>; // Game ID -> Session IDs
  byDate: Record<string, string[]>; // Date (YYYY-MM-DD) -> Session IDs
  performance: {
    totalHours: number;          // Total gaming hours across all sessions
    averageSession: number;      // Average session duration in minutes
    topGames: Array<{
      gameId: string;
      totalHours: number;
    }>;
  };
}
```

## Data Relationships

### Referential Integrity

- All GUID references are validated at read/write time
- Orphaned references are flagged and can be auto-cleaned
- Index files are rebuilt when reference integrity issues are detected
- Cascade deletes maintain consistency (e.g., deleting Game removes from Collections)

## Performance Optimizations

### Index-Based Queries

- **Search**: Pre-indexed title and fuzzy search terms
- **Filtering**: Platform, genre, tag indexes for O(1) lookups
- **Sorting**: Pre-sorted arrays by common sort fields
- **Pagination**: Index files support offset/limit operations

### Caching Strategy

- **In-Memory**: Recently accessed entities cached for 5 minutes
- **File System**: All index files cached until entity modifications
- **Asset Cache**: Metadata images and data cached with expiration
- **Lazy Loading**: Large collections loaded on-demand

### File I/O Optimization

- **Batch Operations**: Multiple entity updates batched into single index rebuild
- **Atomic Writes**: JSON files written atomically to prevent corruption
- **Concurrent Reads**: Multiple readers supported with file locking
- **Background Indexing**: Index rebuilds happen asynchronously

This data model provides a robust foundation for the JSON-based storage system while maintaining human readability and performance through strategic indexing.