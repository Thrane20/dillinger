import express from 'express';
import { RunnerService } from '../services/runner-service.js';

const router = express.Router();
const runnerService = new RunnerService();

// Health check for runner service
router.get('/health', async (_req, res) => {
  try {
    const isHealthy = await runnerService.isRunnerHealthy();
    res.json({
      runner: {
        healthy: isHealthy,
        url: process.env.RUNNER_URL || 'http://localhost:3002'
      }
    });
  } catch (error) {
    res.status(503).json({
      runner: {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

// Launch a game session
router.post('/launch', async (req, res) => {
  try {
    const { gameId, userId, gameConfig } = req.body;
    
    if (!gameId) {
      return res.status(400).json({ 
        error: 'gameId is required',
        timestamp: new Date().toISOString()
      });
    }

    const session = await runnerService.createSession(gameId, userId, gameConfig);
    
    res.json({
      success: true,
      session,
      message: 'Game session created successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to launch game session:', error);
    res.status(500).json({
      error: 'Failed to launch game session',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Get all active sessions
router.get('/sessions', async (_req, res) => {
  try {
    const sessions = await runnerService.listSessions();
    res.json({
      sessions,
      count: sessions.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to list sessions:', error);
    res.status(500).json({
      error: 'Failed to list sessions',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Get specific session
router.get('/sessions/:sessionId', async (req, res) => {
  try {
    const session = await runnerService.getSession(req.params.sessionId);
    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        sessionId: req.params.sessionId,
        timestamp: new Date().toISOString()
      });
    }
    res.json(session);
  } catch (error) {
    console.error('Failed to get session:', error);
    res.status(500).json({
      error: 'Failed to get session',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Stop a session
router.delete('/sessions/:sessionId', async (req, res) => {
  try {
    await runnerService.stopSession(req.params.sessionId);
    res.json({
      success: true,
      message: 'Session stopped successfully',
      sessionId: req.params.sessionId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to stop session:', error);
    res.status(500).json({
      error: 'Failed to stop session',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;