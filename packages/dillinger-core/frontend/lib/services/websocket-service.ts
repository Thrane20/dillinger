import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HTTPServer } from 'http';
import type { DillingerWebSocketMessage } from '@dillinger/shared';
import { DockerService } from './docker-service';
import { JSONStorageService } from './storage';
import { logger } from './logger';

/**
 * WebSocket service for real-time container log streaming
 */
export class WebSocketService {
  private static instance: WebSocketService;
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private docker: DockerService;
  private storage: JSONStorageService;
  private logStreamIntervals: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {
    this.docker = DockerService.getInstance();
    this.storage = JSONStorageService.getInstance();
  }

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  /**
   * Initialize WebSocket server
   */
  initialize(server: HTTPServer): void {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/logs'
    });

    // Subscribe to system logs
    logger.on('log', (log) => {
      this.broadcast({
        type: 'logentry',
        body: {
          containerId: 'system',
          containerType: 'system',
          gameName: 'Dillinger Core',
          gameId: 'system',
          message: `[${log.level.toUpperCase()}] ${log.message}`,
          timestamp: log.timestamp || new Date().toISOString(),
        }
      });
    });

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('📡 WebSocket client connected');
      this.clients.add(ws);

      ws.on('close', () => {
        console.log('📡 WebSocket client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });

      // Send initial connection confirmation
      this.sendToClient(ws, {
        type: 'connected',
        body: { message: 'Connected to Dillinger log stream' }
      });
    });

    // Start streaming logs from active containers
    this.startLogStreaming();
    
    console.log('📡 WebSocket server initialized at /ws/logs');
  }

  /**
   * Start streaming logs from all active containers
   */
  private async startLogStreaming(): Promise<void> {
    // Poll for active containers and stream their logs
    const streamLogs = async () => {
      try {
        const games = await this.storage.listEntities<any>('games');
        const sessions = await this.storage.listEntities<any>('sessions');
        
        const activeContainers: Array<{
          containerId: string;
          type: 'install' | 'launch';
          gameName: string;
          gameId: string;
        }> = [];

        // Collect installation containers
        for (const game of games) {
          if (game.installation?.containerId && game.installation?.status === 'installing') {
            const exists = await this.docker.containerExists(game.installation.containerId);
            if (exists) {
              activeContainers.push({
                containerId: game.installation.containerId,
                type: 'install',
                gameName: game.title || game.slug || game.id,
                gameId: game.id,
              });
            }
          }
        }

        // Collect running game sessions
        for (const session of sessions) {
          if (session.containerId && (session.status === 'running' || session.status === 'starting')) {
            const exists = await this.docker.containerExists(session.containerId);
            if (exists) {
              const game = games.find(g => g.id === session.gameId);
              activeContainers.push({
                containerId: session.containerId,
                type: 'launch',
                gameName: game ? (game.title || game.slug || game.id) : session.gameId,
                gameId: session.gameId,
              });
            }
          }
        }

        // Stream logs from each active container
        for (const container of activeContainers) {
          if (!this.logStreamIntervals.has(container.containerId)) {
            this.streamContainerLogs(container);
          }
        }

        // Clean up streams for stopped containers
        for (const [containerId, interval] of this.logStreamIntervals.entries()) {
          const stillActive = activeContainers.some(c => c.containerId === containerId);
          if (!stillActive) {
            clearInterval(interval);
            this.logStreamIntervals.delete(containerId);
          }
        }
      } catch (error) {
        console.error('Error streaming logs:', error);
      }
    };

    // Check for new containers every 2 seconds
    setInterval(streamLogs, 2000);
    streamLogs(); // Initial check
  }

  /**
   * Stream logs from a specific container
   */
  private streamContainerLogs(container: { containerId: string; type: 'install' | 'launch'; gameName: string; gameId: string }): void {
    let lastLogCount = 0;
    const seenLines = new Set<string>(); // Track unique log lines to avoid duplicates

    const interval = setInterval(async () => {
      try {
        // Check if container still exists
        const exists = await this.docker.containerExists(container.containerId);
        if (!exists) {
          clearInterval(interval);
          this.logStreamIntervals.delete(container.containerId);
          
          // Send container stopped message
          this.broadcast({
            type: 'container-stopped',
            body: {
              containerId: container.containerId,
              containerType: container.type,
              gameName: container.gameName,
              gameId: container.gameId,
              exitCode: -1,
            }
          });
          return;
        }

        // Get recent logs (tail 100 lines)
        const logs = await this.docker.getContainerLogs(container.containerId, 100);
        const logLines = logs.split('\n').filter(line => line.trim());
        
        // Only send new log lines
        if (logLines.length > lastLogCount) {
          const newLines = logLines.slice(lastLogCount);
          for (const line of newLines) {
            const trimmedLine = line.trim();
            // Skip duplicate lines (Docker returns both stdout and stderr)
            // Use trimmed version for deduplication but send original for formatting
            if (trimmedLine && !seenLines.has(trimmedLine)) {
              seenLines.add(trimmedLine);
              this.broadcast({
                type: 'logentry',
                body: {
                  containerId: container.containerId,
                  containerType: container.type,
                  gameName: container.gameName,
                  gameId: container.gameId,
                  message: line,
                  timestamp: new Date().toISOString(),
                }
              });
            }
          }
          lastLogCount = logLines.length;
        }
      } catch (error) {
        // Container likely stopped
        clearInterval(interval);
        this.logStreamIntervals.delete(container.containerId);
      }
    }, 1000); // Stream every second

    this.logStreamIntervals.set(container.containerId, interval);
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message: DillingerWebSocketMessage): void {
    const payload = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  /**
   * Send message to specific client
   */
  private sendToClient(client: WebSocket, message: any): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }

  /**
   * Shutdown WebSocket server
   */
  shutdown(): void {
    // Clear all intervals
    for (const interval of this.logStreamIntervals.values()) {
      clearInterval(interval);
    }
    this.logStreamIntervals.clear();

    // Close all client connections
    this.clients.forEach(client => {
      client.close();
    });
    this.clients.clear();

    // Close server
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    
    console.log('📡 WebSocket server shut down');
  }
}
