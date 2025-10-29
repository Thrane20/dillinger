import axios from 'axios';

export interface RunnerSession {
  id: string;
  gameId: string;
  userId: string;
  status: string;
  streamUrl?: string;
  created: string;
}

export class RunnerService {
  private runnerUrl: string;

  constructor() {
    this.runnerUrl = process.env.RUNNER_URL || 'http://localhost:3002';
  }

  async createSession(gameId: string, userId: string = 'dev-user', gameConfig: any = { type: 'example' }): Promise<RunnerSession> {
    try {
      const response = await axios.post(`${this.runnerUrl}/sessions`, {
        gameId,
        userId,
        gameConfig
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Runner service error: ${error.message}`);
      }
      throw new Error('Failed to create runner session');
    }
  }

  async getSession(sessionId: string): Promise<RunnerSession | null> {
    try {
      const response = await axios.get(`${this.runnerUrl}/sessions/${sessionId}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw new Error('Failed to get runner session');
    }
  }

  async listSessions(): Promise<RunnerSession[]> {
    try {
      const response = await axios.get(`${this.runnerUrl}/sessions`);
      return response.data;
    } catch (error) {
      throw new Error('Failed to list runner sessions');
    }
  }

  async stopSession(sessionId: string): Promise<void> {
    try {
      await axios.delete(`${this.runnerUrl}/sessions/${sessionId}`);
    } catch (error) {
      throw new Error('Failed to stop runner session');
    }
  }

  async isRunnerHealthy(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.runnerUrl}/health`, { timeout: 3000 });
      return response.data.status === 'healthy';
    } catch (error) {
      return false;
    }
  }
}