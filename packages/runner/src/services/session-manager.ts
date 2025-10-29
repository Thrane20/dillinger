import { v4 as uuidv4 } from 'uuid';
import type { DockerService, GameContainer } from './docker-service';

export interface GameSession {
  id: string;
  gameId: string;
  userId: string;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  created: string;
  started?: string;
  stopped?: string;
  container?: GameContainer;
  gameConfig: any;
  streamUrl?: string;
  error?: string;
}

export interface CreateSessionOptions {
  gameId: string;
  userId: string;
  gameConfig: any;
}

export class GameSessionManager {
  private sessions = new Map<string, GameSession>();
  private dockerService: DockerService;

  constructor(dockerService: DockerService) {
    this.dockerService = dockerService;
  }

  async createSession(options: CreateSessionOptions): Promise<GameSession> {
    const sessionId = uuidv4();
    const session: GameSession = {
      id: sessionId,
      gameId: options.gameId,
      userId: options.userId,
      status: 'starting',
      created: new Date().toISOString(),
      gameConfig: options.gameConfig
    };

    this.sessions.set(sessionId, session);

    try {
      console.log(`Creating session ${sessionId} for game ${options.gameId}`);
      
      // Determine container image and configuration based on game type
      const containerConfig = this.getContainerConfig(options.gameConfig);
      
      // Create and start the game container
      const container = await this.dockerService.createGameContainer({
        gameId: options.gameId,
        sessionId: sessionId,
        userId: options.userId,
        ...containerConfig
      });

      session.container = container;
      session.status = 'running';
      session.started = new Date().toISOString();
      
      // For demo purposes, create a mock stream URL
      session.streamUrl = `ws://localhost:3002/stream/${sessionId}`;

      console.log(`Session ${sessionId} started successfully`);
      
      // Schedule automatic cleanup after 10 minutes for demo
      setTimeout(() => {
        this.stopSession(sessionId).catch(console.error);
      }, 10 * 60 * 1000);

      return session;
    } catch (error) {
      session.status = 'error';
      session.error = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to create session ${sessionId}:`, error);
      throw error;
    }
  }

  async stopSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.status === 'stopping' || session.status === 'stopped') {
      return;
    }

    try {
      session.status = 'stopping';
      console.log(`Stopping session ${sessionId}`);

      if (session.container) {
        await this.dockerService.stopGameContainer(sessionId);
      }

      session.status = 'stopped';
      session.stopped = new Date().toISOString();
      
      console.log(`Session ${sessionId} stopped successfully`);
    } catch (error) {
      session.status = 'error';
      session.error = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to stop session ${sessionId}:`, error);
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<GameSession | null> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    // Update session status by checking container status
    if (session.container && (session.status === 'running' || session.status === 'starting')) {
      try {
        const containers = await this.dockerService.listGameContainers();
        const container = containers.find(c => c.labels['dillinger.session-id'] === sessionId);
        
        if (!container) {
          session.status = 'stopped';
          session.stopped = new Date().toISOString();
        } else if (container.status.includes('Exited')) {
          session.status = 'stopped';
          session.stopped = new Date().toISOString();
        }
      } catch (error) {
        console.error(`Failed to check container status for session ${sessionId}:`, error);
      }
    }

    return session;
  }

  async listSessions(): Promise<GameSession[]> {
    const sessions = Array.from(this.sessions.values());
    
    // Update statuses in parallel
    await Promise.all(sessions.map(session => this.getSession(session.id)));
    
    return sessions.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
  }

  async getSessionLogs(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.container) {
      throw new Error(`Session ${sessionId} not found or has no container`);
    }

    return await this.dockerService.getContainerLogs(sessionId);
  }

  async cleanup(): Promise<void> {
    console.log('Cleaning up sessions...');
    
    const runningSessionIds = Array.from(this.sessions.keys()).filter(id => {
      const session = this.sessions.get(id);
      return session && (session.status === 'running' || session.status === 'starting');
    });

    await Promise.all(runningSessionIds.map(id => 
      this.stopSession(id).catch(error => 
        console.error(`Failed to stop session ${id} during cleanup:`, error)
      )
    ));

    // Clean up old containers
    await this.dockerService.cleanupOldContainers(60);
  }

  private getContainerConfig(gameConfig: any): {
    image: string;
    command: string[];
    env: string[];
  } {
    // Default configuration for different game types
    const configs = {
      'example': {
        image: 'alpine:latest',
        command: ['sh', '-c', 'echo "🎮 Dillinger Example Game Session Started!" && echo "Game ID: $GAME_ID" && echo "Session ID: $SESSION_ID" && echo "User ID: $USER_ID" && echo "Sleeping for 5 minutes..." && sleep 300'],
        env: []
      },
      'retro': {
        image: 'alpine:latest',
        command: ['sh', '-c', 'echo "🕹️  Retro Game Emulator Started" && echo "Loading ROM..." && sleep 10 && echo "Game ready! (simulated)" && sleep 600'],
        env: ['GAME_TYPE=retro']
      },
      'steam': {
        image: 'alpine:latest',
        command: ['sh', '-c', 'echo "🚂 Steam Game Launcher" && echo "Initializing Steam client..." && sleep 5 && echo "Launching game..." && sleep 1800'],
        env: ['GAME_TYPE=steam', 'STEAM_COMPAT=1']
      }
    };

    const gameType = gameConfig?.type || 'example';
    return configs[gameType as keyof typeof configs] || configs['example'];
  }
}