# Quickstart: Game Library Manager

**Feature**: Game Library Manager  
**Date**: 2025-10-26  
**Purpose**: Development setup and validation guide  
**Prerequisites**: Docker, Node.js 18+, pnpm, Git

## Development Environment Setup

### 1. Repository and Workspace Initialization

```bash
# Ensure you're on the feature branch
git checkout 001-game-library-manager

# Create the monorepo workspace structure
mkdir -p packages/{shared,backend,frontend}
mkdir -p docker/{backend,game-runners}

# Initialize root package.json for workspace
cat > package.json << 'EOF'
{
  "name": "dillinger",
  "version": "1.0.0",
  "description": "Game library management platform with cross-platform execution",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "pnpm --parallel --filter=!shared run dev",
    "build": "pnpm --recursive run build",
    "test": "pnpm --recursive run test",
    "type-check": "pnpm --recursive run type-check",
    "lint": "pnpm --recursive run lint",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md}\"",
    "clean": "pnpm --recursive run clean && rm -rf node_modules"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "prettier": "^3.0.0",
    "eslint": "^8.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0"
  }
}
EOF

# Create pnpm workspace configuration
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'packages/*'
EOF
```

### 2. Shared Package Setup

```bash
cd packages/shared

# Initialize shared package
cat > package.json << 'EOF'
{
  "name": "@dillinger/shared",
  "version": "1.0.0",
  "description": "Shared types and utilities for Dillinger",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/uuid": "^9.0.0",
    "typescript": "^5.0.0"
  }
}
EOF

# Create TypeScript configuration
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

# Create basic shared types
mkdir -p src/types src/utils

cat > src/types/game.ts << 'EOF'
export interface Game {
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

export interface Platform {
  id: string;                    // UUID v4
  name: string;                  // Display name
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

export interface GameSession {
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

export interface Collection {
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
EOF

cat > src/types/api.ts << 'EOF'
import { Game, Platform, GameSession, Collection } from './game.js';

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

export interface GameListResponse {
  games: Game[];
  pagination: PaginationInfo;
}

export interface SessionListResponse {
  sessions: GameSession[];
}

export interface PlatformListResponse {
  platforms: Platform[];
}

export interface CollectionListResponse {
  collections: Collection[];
}
EOF

cat > src/utils/validation.ts << 'EOF'
import { v4 as uuidv4, validate as validateUuid } from 'uuid';

export function isValidUUID(id: string): boolean {
  return validateUuid(id);
}

export function generateUUID(): string {
  return uuidv4();
}

export function validateGame(data: unknown): Game {
  if (typeof data !== 'object' || !data) {
    throw new Error('Invalid game data: must be an object');
  }
  
  const game = data as Record<string, unknown>;
  
  if (typeof game.id !== 'string' || !isValidUUID(game.id)) {
    throw new Error('Invalid game ID: must be a valid UUID');
  }
  
  if (typeof game.title !== 'string' || game.title.length === 0 || game.title.length > 255) {
    throw new Error('Invalid game title: must be a non-empty string (max 255 characters)');
  }
  
  if (typeof game.filePath !== 'string' || game.filePath.length === 0) {
    throw new Error('Invalid file path: must be a non-empty string');
  }
  
  if (typeof game.platformId !== 'string' || !isValidUUID(game.platformId)) {
    throw new Error('Invalid platform ID: must be a valid UUID');
  }
  
  if (!Array.isArray(game.collectionIds)) {
    throw new Error('Invalid collection IDs: must be an array');
  }
  
  for (const id of game.collectionIds) {
    if (typeof id !== 'string' || !isValidUUID(id)) {
      throw new Error('Invalid collection ID: all collection IDs must be valid UUIDs');
    }
  }
  
  return game as Game;
}

export function validatePlatform(data: unknown): Platform {
  if (typeof data !== 'object' || !data) {
    throw new Error('Invalid platform data: must be an object');
  }
  
  const platform = data as Record<string, unknown>;
  
  if (typeof platform.id !== 'string' || !isValidUUID(platform.id)) {
    throw new Error('Invalid platform ID: must be a valid UUID');
  }
  
  if (typeof platform.name !== 'string' || platform.name.length === 0 || platform.name.length > 100) {
    throw new Error('Invalid platform name: must be a non-empty string (max 100 characters)');
  }
  
  if (!['native', 'wine', 'emulator'].includes(platform.type as string)) {
    throw new Error('Invalid platform type: must be native, wine, or emulator');
  }
  
  return platform as Platform;
}
EOF

cat > src/index.ts << 'EOF'
// Export all types
export * from './types/game.js';
export * from './types/api.js';

// Export utilities
export * from './utils/validation.js';
EOF

cd ../..
```

### 3. Backend Package Setup

```bash
cd packages/backend

# Initialize backend package
cat > package.json << 'EOF'
{
  "name": "@dillinger/backend",
  "version": "1.0.0",
  "description": "Dillinger backend API server",
  "type": "module",
  "main": "./dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "type-check": "tsc --noEmit",
    "lint": "eslint src/**/*.ts",
    "clean": "rm -rf dist",
    "data:init": "tsx src/scripts/init-data.ts",
    "data:seed": "tsx src/scripts/seed-platforms.ts"
  },
  "dependencies": {
    "@dillinger/shared": "workspace:*",
    "express": "^4.18.0",
    "cors": "^2.8.0",
    "helmet": "^7.0.0",
    "compression": "^1.7.0",
    "express-rate-limit": "^7.0.0",
    "uuid": "^9.0.0",
    "axios": "^1.6.0",
    "dockerode": "^4.0.0",
    "ws": "^8.14.0",
    "fs-extra": "^11.1.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/cors": "^2.8.0",
    "@types/compression": "^1.7.0",
    "@types/uuid": "^9.0.0",
    "@types/ws": "^8.5.0",
    "@types/jest": "^29.5.0",
    "@types/fs-extra": "^11.0.0",
    "jest": "^29.7.0",
    "supertest": "^6.3.0",
    "@types/supertest": "^6.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
EOF

# Create TypeScript configuration
cat > tsconfig.json << 'EOF'
{
  "extends": "../shared/tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["node", "jest"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
EOF

# Create basic Express server
mkdir -p src/{controllers,services,models,middleware,utils,scripts}

cat > src/index.ts << 'EOF'
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api', limiter);

// Common middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    storage: 'JSON files',
    dataPath: process.env.DATA_PATH || '/data'
  });
});

// Basic 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'not_found',
    message: 'API endpoint not found',
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'internal_server_error',
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Dillinger API server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`💾 Data storage: JSON files in ${process.env.DATA_PATH || '/data'}`);
});
EOF

# Create JSON storage service
cat > src/services/storage.ts << 'EOF'
import fs from 'fs-extra';
import path from 'path';
import { Game, Platform, GameSession, Collection, generateUUID } from '@dillinger/shared';

const DATA_PATH = process.env.DATA_PATH || '/data';

export class JSONStorageService {
  private static instance: JSONStorageService;
  
  static getInstance(): JSONStorageService {
    if (!JSONStorageService.instance) {
      JSONStorageService.instance = new JSONStorageService();
    }
    return JSONStorageService.instance;
  }

  async ensureDirectories(): Promise<void> {
    const dirs = ['games', 'platforms', 'sessions', 'collections', 'metadata'];
    await Promise.all(dirs.map(dir => 
      fs.ensureDir(path.join(DATA_PATH, dir))
    ));
  }

  async writeEntity<T>(type: string, id: string, data: T): Promise<void> {
    const filePath = path.join(DATA_PATH, type, `${id}.json`);
    await fs.writeJson(filePath, data, { spaces: 2 });
    await this.updateIndex(type);
  }

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

  async listEntities<T>(type: string): Promise<T[]> {
    const dirPath = path.join(DATA_PATH, type);
    try {
      const files = await fs.readdir(dirPath);
      const jsonFiles = files.filter(file => file.endsWith('.json') && file !== 'index.json');
      
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

  private async updateIndex(type: string): Promise<void> {
    const entities = await this.listEntities(type);
    const indexPath = path.join(DATA_PATH, type, 'index.json');
    
    const index = {
      count: entities.length,
      lastUpdated: new Date().toISOString(),
      ids: entities.map((entity: any) => entity.id)
    };
    
    await fs.writeJson(indexPath, index, { spaces: 2 });
  }
}
EOF

cd ../..
```

### 4. Frontend Package Setup

```bash
cd packages/frontend

# Initialize Next.js project
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"

# Update package.json to add shared dependency
cat > package.json << 'EOF'
{
  "name": "@dillinger/frontend",
  "version": "1.0.0",
  "description": "Dillinger web frontend",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@dillinger/shared": "workspace:*",
    "react": "^18",
    "react-dom": "^18",
    "next": "14.0.0",
    "tailwindcss": "^3.3.0",
    "autoprefixer": "^10.0.1",
    "postcss": "^8",
    "@heroicons/react": "^2.0.0",
    "clsx": "^2.0.0",
    "swr": "^2.2.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "eslint": "^8",
    "eslint-config-next": "14.0.0"
  }
}
EOF

# Create basic layout
cat > app/layout.tsx << 'EOF'
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Dillinger - Game Library Manager',
  description: 'Manage and play games across multiple platforms',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50">
          <header className="bg-white shadow-sm border-b">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center py-6">
                <h1 className="text-3xl font-bold text-gray-900">Dillinger</h1>
                <nav className="flex space-x-8">
                  <a href="/" className="text-gray-500 hover:text-gray-900">Library</a>
                  <a href="/sessions" className="text-gray-500 hover:text-gray-900">Sessions</a>
                  <a href="/platforms" className="text-gray-500 hover:text-gray-900">Platforms</a>
                </nav>
              </div>
            </div>
          </header>
          <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
EOF

cat > app/page.tsx << 'EOF'
export default function HomePage() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Welcome to Dillinger</h2>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Your game library is empty. Add some games to get started!
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Add Games</h3>
          <p className="text-gray-600 text-sm mb-4">
            Add games from your file system and automatically fetch metadata.
          </p>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
            Add Game
          </button>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Platforms</h3>
          <p className="text-gray-600 text-sm mb-4">
            Configure gaming platforms and emulators for different game types.
          </p>
          <button className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">
            View Platforms
          </button>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Collections</h3>
          <p className="text-gray-600 text-sm mb-4">
            Organize your games into collections for better management.
          </p>
          <button className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700">
            Create Collection
          </button>
        </div>
      </div>
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">Development Mode</h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>This is the frontend development server. Backend functionality requires the API server to be running.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
EOF

cd ../..
```

### 5. Docker Development Environment

```bash
# Create Docker Compose for development
cat > docker-compose.dev.yml << 'EOF'
version: '3.8'

services:
  backend-dev:
    build:
      context: ./docker/backend
      dockerfile: Dockerfile.dev
    container_name: dillinger-backend-dev
    ports:
      - "3001:3001"
    volumes:
      - ./packages/backend:/app
      - ./packages/shared:/shared
      - /var/run/docker.sock:/var/run/docker.sock
      - game-library:/opt/games
      - json-data:/data
    environment:
      - NODE_ENV=development
      - DATA_PATH=/data
      - GAME_LIBRARY_PATH=/opt/games
      - FRONTEND_URL=http://localhost:3000
    restart: unless-stopped

  frontend-dev:
    build:
      context: ./docker/frontend
      dockerfile: Dockerfile.dev
    container_name: dillinger-frontend-dev
    ports:
      - "3000:3000"
    volumes:
      - ./packages/frontend:/app
      - ./packages/shared:/shared
    environment:
      - NODE_ENV=development
      - NEXT_PUBLIC_API_URL=http://localhost:3001
    restart: unless-stopped

volumes:
  game-library:
    driver: local
  json-data:
    driver: local
EOF

# Create backend development Dockerfile
mkdir -p docker/backend
cat > docker/backend/Dockerfile.dev << 'EOF'
FROM node:18-alpine

# Install pnpm
RUN npm install -g pnpm

# Create app directory
WORKDIR /app

# Copy package files
COPY ../../package.json ../../pnpm-workspace.yaml /root/
COPY ../../packages/shared/package.json /shared/package.json
COPY package.json ./

# Install dependencies
RUN cd /root && pnpm install

# Copy source code
COPY . .

# Create data directory
RUN mkdir -p /data

# Expose port
EXPOSE 3001

# Start development server
CMD ["pnpm", "run", "dev"]
EOF

# Create frontend development Dockerfile
mkdir -p docker/frontend
cat > docker/frontend/Dockerfile.dev << 'EOF'
FROM node:18-alpine

# Install pnpm
RUN npm install -g pnpm

# Create app directory
WORKDIR /app

# Copy package files
COPY ../../package.json ../../pnpm-workspace.yaml /root/
COPY ../../packages/shared/package.json /shared/package.json
COPY package.json ./

# Install dependencies
RUN cd /root && pnpm install

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start development server
CMD ["pnpm", "run", "dev"]
EOF
```

### 6. Install Dependencies and Build

```bash
# Install all dependencies
pnpm install

# Build shared package first
cd packages/shared
pnpm run build
cd ../..

# Verify everything compiles
pnpm run type-check

# Start development servers
pnpm run dev
```

## Feature Validation Checklist

### 1. Basic Infrastructure ✅

```bash
# Verify workspace structure
ls -la packages/
# Should show: shared, backend, frontend

# Check TypeScript compilation
pnpm run type-check
# Should complete without errors

# Check shared package build
ls -la packages/shared/dist/
# Should show compiled .js and .d.ts files
```

### 2. Backend API Validation ✅

```bash
# Start backend in development mode
cd packages/backend
pnpm run dev

# In another terminal, test health endpoint
curl http://localhost:3001/api/health
# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2025-10-26T...",
#   "version": "1.0.0",
#   "storage": "JSON files",
#   "dataPath": "/data"
# }

# Test 404 handling
curl http://localhost:3001/api/nonexistent
# Expected: 404 with JSON error response
```

### 3. Frontend Development Server ✅

```bash
# Start frontend in development mode
cd packages/frontend
pnpm run dev

# Open browser to http://localhost:3000
# Should display Dillinger homepage with:
# - Header with navigation
# - Welcome message
# - Three action cards (Add Games, Platforms, Collections)
# - Development mode warning
```

### 4. Type Safety Validation ✅

```bash
# Verify shared types are accessible in backend
grep -r "@dillinger/shared" packages/backend/src/
# Should find import statements

# Verify shared types are accessible in frontend
grep -r "@dillinger/shared" packages/frontend/
# Should find import statements

# Test type checking across packages
pnpm run type-check
# Should complete without TypeScript errors
```

### 5. Docker Development Environment ✅

```bash
# Build and start development containers
docker-compose -f docker-compose.dev.yml up --build

# Verify services are running
docker-compose -f docker-compose.dev.yml ps
# Should show all services as "Up"

# Test containerized backend health
curl http://localhost:3001/api/health
# Should return healthy status

# Test containerized frontend
open http://localhost:3000
# Should display the same homepage as local development
```

## Next Development Steps

### 1. JSON Storage Implementation (Week 1)

```bash
# Implement JSON file CRUD operations based on data-model.md
# Add JSON schema validation using custom TypeScript validators
# Create index file management for performance optimization
```

### 2. API Implementation (Week 2-3)

```bash
# Implement REST endpoints per openapi.yaml specification
# Add input validation using shared TypeScript interfaces
# Add error handling and logging middleware
```

### 3. Frontend Implementation (Week 4-5)

```bash
# Build game library grid view with TailwindCSS
# Implement game addition and editing forms
# Add SWR for API data fetching and caching
# Create responsive layout for mobile and desktop
```

### 4. Container Integration (Week 6-8)

```bash
# Implement Docker container management for game execution
# Add Games on Whales/Wolf display streaming to desktop
# Create platform-specific game runners (Linux, Wine, emulators)
```

## Performance Targets

- ✅ **Development Server Start**: < 30 seconds for all services
- ✅ **Type Checking**: < 10 seconds across all packages  
- ✅ **Hot Reload**: < 2 seconds for frontend changes
- ✅ **API Response**: < 100ms for health check endpoints
- 🎯 **Game Addition**: < 5 minutes (target for full implementation)
- 🎯 **Game Launch**: < 30 seconds (target for full implementation)

## Troubleshooting Common Issues

### Port Conflicts
```bash
# Check what's using ports 3000/3001
sudo netstat -tulpn | grep :3000
sudo netstat -tulpn | grep :3001

# Kill conflicting processes
sudo fuser -k 3000/tcp
sudo fuser -k 3001/tcp
```

### pnpm Workspace Issues
```bash
# Clear all node_modules and reinstall
pnpm run clean
pnpm install

# Rebuild shared package
cd packages/shared
pnpm run build
```

### Docker Issues
```bash
# Reset Docker environment
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up --build --force-recreate

# Check Docker logs
docker-compose -f docker-compose.dev.yml logs backend-dev
docker-compose -f docker-compose.dev.yml logs frontend-dev
```

### TypeScript Compilation Errors
```bash
# Check individual package compilation
cd packages/shared && pnpm run type-check
cd packages/backend && pnpm run type-check  
cd packages/frontend && pnpm run type-check

# Verify shared package is built
ls -la packages/shared/dist/
```

**✅ Development environment is ready when all validation checks pass and both frontend/backend servers are accessible.**