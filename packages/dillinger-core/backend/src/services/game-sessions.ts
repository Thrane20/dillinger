// Game sessions service - tracks play sessions for each game

import fs from 'fs-extra';
import path from 'path';
import { DILLINGER_ROOT } from './settings.js';

export interface GameSessionEntry {
  id: string; // UUID of the session
  startTime: string; // ISO timestamp
  endTime?: string; // ISO timestamp when session ended
  duration?: number; // Duration in seconds
  exitCode?: number; // Container exit code
  status: 'starting' | 'running' | 'stopped' | 'error';
  containerId?: string; // Docker container ID
  platformId: string; // Which platform was used
}

export interface GameSessions {
  gameId: string;
  sessions: GameSessionEntry[];
  totalPlayTime: number; // Total seconds played
  lastPlayed?: string; // ISO timestamp of most recent session
}

export class GameSessionsService {
  private static instance: GameSessionsService;

  private constructor() {}

  static getInstance(): GameSessionsService {
    if (!GameSessionsService.instance) {
      GameSessionsService.instance = new GameSessionsService();
    }
    return GameSessionsService.instance;
  }

  /**
   * Get the path to a game's sessions.json file
   */
  private getSessionsPath(gameId: string): string {
    return path.join(DILLINGER_ROOT, 'storage', 'metadata', gameId, 'sessions.json');
  }

  /**
   * Load sessions for a game
   */
  async loadSessions(gameId: string): Promise<GameSessions> {
    const sessionsPath = this.getSessionsPath(gameId);

    if (await fs.pathExists(sessionsPath)) {
      const data = await fs.readJSON(sessionsPath);
      return data;
    }

    // Return empty sessions object if file doesn't exist
    return {
      gameId,
      sessions: [],
      totalPlayTime: 0,
    };
  }

  /**
   * Save sessions for a game
   */
  private async saveSessions(sessions: GameSessions): Promise<void> {
    const sessionsPath = this.getSessionsPath(sessions.gameId);
    await fs.ensureDir(path.dirname(sessionsPath));
    await fs.writeJSON(sessionsPath, sessions, { spaces: 2 });
  }

  /**
   * Add a new session
   */
  async addSession(
    gameId: string,
    sessionId: string,
    platformId: string,
    containerId?: string
  ): Promise<void> {
    const sessions = await this.loadSessions(gameId);

    const newSession: GameSessionEntry = {
      id: sessionId,
      startTime: new Date().toISOString(),
      status: 'starting',
      platformId,
      containerId,
    };

    sessions.sessions.push(newSession);
    sessions.lastPlayed = newSession.startTime;

    await this.saveSessions(sessions);
  }

  /**
   * Update session status
   */
  async updateSessionStatus(
    gameId: string,
    sessionId: string,
    status: GameSessionEntry['status'],
    containerId?: string
  ): Promise<void> {
    const sessions = await this.loadSessions(gameId);
    const session = sessions.sessions.find((s) => s.id === sessionId);

    if (!session) {
      console.warn(`Session ${sessionId} not found for game ${gameId}`);
      return;
    }

    session.status = status;
    if (containerId) {
      session.containerId = containerId;
    }

    await this.saveSessions(sessions);
  }

  /**
   * End a session and calculate duration
   */
  async endSession(gameId: string, sessionId: string, exitCode?: number): Promise<void> {
    const sessions = await this.loadSessions(gameId);
    const session = sessions.sessions.find((s) => s.id === sessionId);

    if (!session) {
      console.warn(`Session ${sessionId} not found for game ${gameId}`);
      return;
    }

    const endTime = new Date().toISOString();
    const duration = Math.floor(
      (new Date(endTime).getTime() - new Date(session.startTime).getTime()) / 1000
    );

    session.endTime = endTime;
    session.duration = duration;
    session.exitCode = exitCode;
    session.status = exitCode === 0 ? 'stopped' : 'error';

    // Update total play time
    sessions.totalPlayTime = sessions.sessions.reduce((total, s) => {
      return total + (s.duration || 0);
    }, 0);

    await this.saveSessions(sessions);
  }

  /**
   * Get all sessions for a game
   */
  async getSessions(gameId: string): Promise<GameSessionEntry[]> {
    const sessions = await this.loadSessions(gameId);
    return sessions.sessions;
  }

  /**
   * Get session statistics for a game
   */
  async getStats(gameId: string): Promise<{
    totalSessions: number;
    totalPlayTime: number;
    lastPlayed?: string;
    averageSessionLength: number;
  }> {
    const sessions = await this.loadSessions(gameId);
    const completedSessions = sessions.sessions.filter((s) => s.duration !== undefined);

    return {
      totalSessions: sessions.sessions.length,
      totalPlayTime: sessions.totalPlayTime,
      lastPlayed: sessions.lastPlayed,
      averageSessionLength:
        completedSessions.length > 0
          ? sessions.totalPlayTime / completedSessions.length
          : 0,
    };
  }
}
