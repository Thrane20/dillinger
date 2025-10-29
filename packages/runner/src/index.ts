import express from 'express';
import type { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { GameSessionManager } from './services/session-manager';
import { DockerService } from './services/docker-service';

const app: Express = express();
const PORT = process.env.PORT || 3002;

// Initialize services
const dockerService = new DockerService();
const sessionManager = new GameSessionManager(dockerService);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.BACKEND_URL || 'http://localhost:3001',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'dillinger-runner',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: process.uptime(),
  });
});

// Session management endpoints
app.post('/sessions', async (req, res) => {
  try {
    const { gameId, userId, gameConfig } = req.body;
    
    if (!gameId) {
      res.status(400).json({ error: 'gameId is required' });
      return;
    }

    const session = await sessionManager.createSession({
      gameId,
      userId: userId || 'dev-user',
      gameConfig: gameConfig || { type: 'example' }
    });

    res.json(session);
  } catch (error) {
    console.error('Failed to create session:', error);
    res.status(500).json({ 
      error: 'Failed to create session',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/sessions', async (_req, res) => {
  try {
    const sessions = await sessionManager.listSessions();
    res.json(sessions);
  } catch (error) {
    console.error('Failed to list sessions:', error);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

app.get('/sessions/:sessionId', async (req, res) => {
  try {
    const session = await sessionManager.getSession(req.params.sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.json(session);
  } catch (error) {
    console.error('Failed to get session:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

app.delete('/sessions/:sessionId', async (req, res) => {
  try {
    await sessionManager.stopSession(req.params.sessionId);
    res.json({ message: 'Session stopped' });
  } catch (error) {
    console.error('Failed to stop session:', error);
    res.status(500).json({ error: 'Failed to stop session' });
  }
});

// Container management
app.get('/containers', async (_req, res) => {
  try {
    const containers = await dockerService.listGameContainers();
    res.json(containers);
  } catch (error) {
    console.error('Failed to list containers:', error);
    res.status(500).json({ error: 'Failed to list containers' });
  }
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'internal_server_error',
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
  });
});

// Start server
async function startServer() {
  try {
    // Initialize Docker connection
    await dockerService.initialize();
    console.log('🐳 Docker service initialized');

    app.listen(PORT, () => {
      console.log(`🚀 Dillinger Runner service running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🎮 Session management: http://localhost:${PORT}/sessions`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start runner service:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  await sessionManager.cleanup();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  await sessionManager.cleanup();
  process.exit(0);
});

startServer().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

export default app;