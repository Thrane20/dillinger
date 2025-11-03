import express from 'express';
import type { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { JSONStorageService } from './services/storage.js';
import { SettingsService } from './services/settings.js';
import { VolumeVerificationService } from './services/volume-verification.js';
import { getScraperManager } from './services/scrapers/index.js';
import gamesLauncherRouter from './api/games-launcher.js';
import gamesRouter from './api/games.js';
import settingsRouter from './api/settings.js';
import scrapersRouter from './api/scrapers.js';
import imagesRouter from './api/images.js';
import filesystemRouter from './api/filesystem.js';
import volumesRouter from './api/volumes.js';

const app: Express = express();
const PORT = process.env.PORT || 3001;

// Trust proxy - required for rate limiting behind reverse proxies
// In production behind a reverse proxy, set to 1
// In development, we don't use rate limiting on a per-IP basis
const trustProxyValue = process.env.NODE_ENV === 'production' ? 1 : false;
app.set('trust proxy', trustProxyValue);

// Initialize storage service
const storage = JSONStorageService.getInstance();
const settingsService = SettingsService.getInstance();
const scraperManager = getScraperManager();

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'img-src': ["'self'", 'data:', 'https:', 'http://localhost:3001'],
      },
    },
  })
);
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  skip: () => process.env.NODE_ENV === 'development', // Skip rate limiting in development
  message: {
    error: 'rate_limit_exceeded',
    message: 'Too many requests from this IP, please try again later.',
    timestamp: new Date().toISOString(),
  },
});
app.use('/api', limiter);

// Common middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging in development
if (process.env.NODE_ENV === 'development') {
  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
  });
}

// Health check endpoint
app.get('/api/health', async (_req, res) => {
  try {
    const healthCheck = await storage.healthCheck();
    const uptime = process.uptime();

    res.json({
      status: healthCheck.healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      storage: 'JSON files',
      dataPath: healthCheck.dataPath,
      uptime: uptime,
      checks: {
        storage: healthCheck.healthy,
        docker: false, // TODO: Implement Docker health check
        metadata: false, // TODO: Implement metadata service health check
      },
      counts: healthCheck.counts,
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// API routes will be added here as we implement them
// TODO: Add platforms routes
// TODO: Add sessions routes
// TODO: Add collections routes

// Game CRUD routes
app.use('/api/games', gamesRouter);

// Game launcher routes (separate from /api/games to avoid route conflicts)
app.use('/api/launch', gamesLauncherRouter);

// Settings routes
app.use('/api/settings', settingsRouter);

// Scraper routes
app.use('/api/scrapers', scrapersRouter);

// Image serving routes
app.use('/api/images', imagesRouter);

// Filesystem browsing routes
app.use('/api/filesystem', filesystemRouter);

// Volume management routes
app.use('/api/volumes', volumesRouter);

// Basic 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'not_found',
    message: `API endpoint ${req.method} ${req.url} not found`,
    timestamp: new Date().toISOString(),
  });
});

// Global error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
      error: 'internal_server_error',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  }
);

// Initialize storage directories and start server
async function startServer() {
  try {
    // STEP 1: Verify required Docker volumes exist
    // The dillinger_root volume is the foundation - all JSON data sits on it
    console.log('🔍 Checking required Docker volumes...');
    
    // In development, auto-create the volume if it doesn't exist
    if (process.env.NODE_ENV === 'development') {
      try {
        await VolumeVerificationService.verifyRequiredVolumes();
      } catch (error) {
        if (error instanceof Error && error.message.includes('You must have a volume mounted')) {
          console.log('🏗️  Development mode: Auto-creating dillinger_root volume...');
          
          // Auto-create bind mount to current data directory
          const currentDataPath = process.env.DILLINGER_ROOT || 
            `${process.cwd()}/packages/dillinger-core/backend/data`;
          
          await VolumeVerificationService.createDillingerRootVolume(currentDataPath);
          
          // Verify it was created successfully
          await VolumeVerificationService.verifyRequiredVolumes();
        } else {
          throw error;
        }
      }
    } else {
      // In production, volume MUST exist - fail hard if not
      await VolumeVerificationService.verifyRequiredVolumes();
    }

    // STEP 2: Initialize storage directories
    await storage.ensureDirectories();
    console.log('📁 Storage directories initialized');

    // STEP 3: Initialize settings and scrapers
    await settingsService.initialize();
    const scraperSettings = await settingsService.getScraperSettings();
    await scraperManager.initialize(scraperSettings);
    console.log('⚙️  Settings and scrapers initialized');

    // STEP 4: Start the server
    app.listen(PORT, () => {
      console.log(`🚀 Dillinger API server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`💾 Data storage: JSON files in dillinger_root volume`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    
    if (error instanceof Error && error.message.includes('You must have a volume mounted')) {
      console.error('');
      console.error('🛑 STARTUP FAILED: Missing required Docker volume');
      console.error('   This is the foundational volume where all Dillinger JSON data is stored.');
      console.error('   See the error message above for instructions on how to create it.');
    }
    
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

export default app;