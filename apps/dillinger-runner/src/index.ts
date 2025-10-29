// Dillinger Runner - Game execution service
import { config } from 'dotenv';
import { resolve } from 'path';
import express from 'express';

// Load environment variables from project root
config({ path: resolve(process.cwd(), '../../.env') });
import cors from 'cors';
import helmet from 'helmet';
import { getRequiredEnv, getOptionalEnv, validateApiKeyFromHeaders, GameLaunchRequestSchema } from '@dillinger/validation';
import type { GameLaunchRequest, LaunchResponse, SessionStatus, RunnerSession } from '@dillinger/runner-types';

// Simple in-memory session store (TODO: replace with persistent storage)
const sessions = new Map<string, RunnerSession>();

const app = express();
const PORT = parseInt(getOptionalEnv('RUNNER_API_PORT', '3003'));
const REQUIRED_API_KEY = getRequiredEnv('API_KEY');

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// API Key validation middleware
app.use('/api', (req, res, next) => {
  const result = validateApiKeyFromHeaders(req.headers, req.query, REQUIRED_API_KEY);
  
  if (!result.isValid) {
    return res.status(401).json({
      error: result.error,
      message: 'Provide API key in X-API-Key header, Authorization bearer token, or apiKey query parameter'
    });
  }
  
  return next();
});

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'dillinger-runner',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Game launch endpoint
app.post('/api/launch', async (req, res) => {
  try {
    // Validate request body using Zod schema
    const validationResult = GameLaunchRequestSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        sessionId: '',
        error: 'Invalid request format',
        details: validationResult.error.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message
        }))
      });
    }
    
    const launchRequest = validationResult.data;
    
    // TODO: Check if game exists in library
    // TODO: Generate unique session ID
    // TODO: Create Docker container for game execution
    // TODO: Set up display forwarding
    // TODO: Return session information
    
    // For now, return a placeholder response
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create default configuration if none provided  
    const config = launchRequest.configuration || {
      display: { 
        width: 1920, 
        height: 1080, 
        method: 'x11' as const
      },
      resources: { cpu: 2.0, memory: '4g' }
    };
    
    // Create session in memory store
    const session: RunnerSession = {
      id: sessionId,
      gameId: launchRequest.gameId,
      status: 'starting',
      configuration: config,
      startTime: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      resources: {
        cpu: 0,
        memory: 0,
        network: { bytesIn: 0, bytesOut: 0 }
      },
      metadata: {
        streamingMethod: 'webrtc',
        displayServer: 'x11'
      }
    };
    
    sessions.set(sessionId, session);
    
    const response: LaunchResponse = {
      success: true,
      sessionId
    };
    
    console.log(`🚀 Launch request received for game: ${launchRequest.gameId}`);
    console.log(`📝 Session created: ${sessionId}`);
    
    return res.status(201).json(response);
  } catch (error) {
    console.error('Launch endpoint error:', error);
    return res.status(500).json({
      success: false,
      sessionId: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get session status endpoint
app.get('/api/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({
        error: 'Session ID is required'
      });
    }
    
    const session = sessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        sessionId
      });
    }
    
    const sessionStatus: SessionStatus = {
      sessionId: session.id,
      status: session.status === 'running' ? 'running' : 'stopped',
      startTime: session.startTime,
      lastActivity: session.lastActivity,
      resources: session.resources
    };
    
    // Add optional fields only if they exist
    if (session.containerId) {
      sessionStatus.containerId = session.containerId;
    }
    
    return res.json(sessionStatus);
  } catch (error) {
    console.error('Session status error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Stop session endpoint
app.post('/api/sessions/:sessionId/stop', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
      });
    }
    
    const session = sessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    // Update session status
    session.status = 'stopping';
    session.lastActivity = new Date().toISOString();
    
    // TODO: Stop Docker container
    // TODO: Clean up resources
    
    // Simulate stopping
    setTimeout(() => {
      session.status = 'stopped';
      session.endTime = new Date().toISOString();
    }, 1000);
    
    console.log(`🛑 Stop requested for session: ${sessionId}`);
    
    return res.json({
      success: true,
      message: 'Session stop requested',
      sessionId
    });
  } catch (error) {
    console.error('Stop session error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// List active sessions
app.get('/api/sessions', async (req, res) => {
  try {
    const sessionList = Array.from(sessions.values()).map(session => ({
      sessionId: session.id,
      gameId: session.gameId,
      status: session.status,
      startTime: session.startTime,
      lastActivity: session.lastActivity,
      ...(session.containerId && { containerId: session.containerId })
    }));
    
    return res.json({
      sessions: sessionList,
      total: sessionList.length
    });
  } catch (error) {
    console.error('List sessions error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.originalUrl} not found`
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎮 Dillinger Runner API listening on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔒 API endpoints require authentication`);
  console.log(`🐳 Container runtime: ${getOptionalEnv('DOCKER_HOST', 'unix:///var/run/docker.sock')}`);
});