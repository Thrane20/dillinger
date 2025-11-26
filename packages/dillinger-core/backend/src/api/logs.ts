import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { logger } from '../services/logger.js';

const router = Router();

// Helper to read last N lines from a file
async function getLastLines(filePath: string, lineCount: number): Promise<string[]> {
  if (!fs.existsSync(filePath)) return [];

  try {
    const stat = await fs.promises.stat(filePath);
    const fileSize = stat.size;
    
    // Read last 50KB (should be enough for ~100 lines)
    const readSize = Math.min(50 * 1024, fileSize);
    const start = fileSize - readSize;
    const buffer = Buffer.alloc(readSize);
    
    const fd = await fs.promises.open(filePath, 'r');
    try {
      await fd.read(buffer, 0, readSize, start);
    } finally {
      await fd.close();
    }
    
    const content = buffer.toString('utf8');
    const allLines = content.split('\n');
    
    // If we didn't read the whole file, discard the first line as it might be partial
    if (start > 0) {
      allLines.shift();
    }
    
    // Return last N lines, filtering empty ones
    return allLines.filter(l => l.trim().length > 0).slice(-lineCount);
  } catch (error) {
    console.error('Error reading log file:', error);
    return [];
  }
}

/**
 * GET /api/logs/core/stream
 * Stream core application logs via Server-Sent Events (SSE)
 */
router.get('/core/stream', async (req: Request, res: Response) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send recent logs first
  try {
    const logDir = logger.getLogDirectory();
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const logFile = path.join(logDir, `dillinger-${date}.log`);
    
    const recentLogs = await getLastLines(logFile, 100);
    
    for (const line of recentLogs) {
      res.write(`data: ${line}\n\n`);
    }
    // Flush if possible (Node 15+)
    if (typeof (res as any).flush === 'function') {
      (res as any).flush();
    }
  } catch (error) {
    console.error('Error reading recent logs:', error);
  }

  // Define log listener for new logs
  const onLog = (info: any) => {
    // Format the log message
    // info object contains timestamp, level, message, and potentially other meta
    const timestamp = info.timestamp || new Date().toISOString();
    const level = (info.level || 'info').toUpperCase();
    const message = info.message || '';
    
    // Check for meta properties (excluding standard winston props)
    const { timestamp: _, level: __, message: ___, ...meta } = info;
    const metaString = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    
    const logLine = `${timestamp} [${level}]: ${message}${metaString}`;
    
    // Send to client
    res.write(`data: ${logLine}\n\n`);
    
    // Flush if possible
    if (typeof (res as any).flush === 'function') {
      (res as any).flush();
    }
  };

  // Subscribe to logger events
  logger.on('log', onLog);

  // Handle client disconnect
  req.on('close', () => {
    logger.off('log', onLog);
    res.end();
  });
});

export default router;
