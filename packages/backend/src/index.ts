import express from 'express';
import type { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { JSONStorageService } from './services/storage.js';

const app: Express = express();
const PORT = process.env.PORT || 3001;

// Initialize storage service
const storage = JSONStorageService.getInstance();

// Security middleware
app.use(helmet());
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
// TODO: Add games routes
// TODO: Add platforms routes
// TODO: Add sessions routes
// TODO: Add collections routes

// Runner integration routes
import runnerRoutes from './routes/runner.js';
app.use('/api/runner', runnerRoutes);

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
    await storage.ensureDirectories();
    console.log('📁 Storage directories initialized');

    app.listen(PORT, () => {
      console.log(`🚀 Dillinger API server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`💾 Data storage: JSON files in ${process.env.DATA_PATH || '/data'}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
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