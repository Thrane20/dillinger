import Docker from 'dockerode';
import type { Container, ContainerInfo } from 'dockerode';

export interface GameContainer {
  id: string;
  name: string;
  image: string;
  status: string;
  created: number;
  ports: Record<string, any>;
  labels: Record<string, string>;
}

export class DockerService {
  private docker: Docker;

  constructor() {
    this.docker = new Docker({
      socketPath: '/var/run/docker.sock'
    });
  }

  async initialize(): Promise<void> {
    try {
      // Test Docker connection
      await this.docker.ping();
      console.log('Docker connection established');
    } catch (error) {
      throw new Error(`Failed to connect to Docker: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async ensureImage(imageName: string): Promise<void> {
    try {
      // Check if image exists locally
      const images = await this.docker.listImages();
      const imageExists = images.some(img => 
        img.RepoTags && img.RepoTags.includes(imageName)
      );
      
      if (!imageExists) {
        console.log(`Pulling image: ${imageName}`);
        
        // Pull the image
        const stream = await this.docker.pull(imageName);
        
        // Wait for pull to complete
        await new Promise((resolve, reject) => {
          this.docker.modem.followProgress(stream, (err, res) => {
            if (err) {
              reject(err);
            } else {
              console.log(`Image ${imageName} pulled successfully`);
              resolve(res);
            }
          });
        });
      } else {
        console.log(`Image ${imageName} already exists locally`);
      }
    } catch (error) {
      throw new Error(`Failed to ensure image ${imageName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createGameContainer(options: {
    gameId: string;
    sessionId: string;
    userId: string;
    image?: string;
    command?: string[];
    env?: string[];
  }): Promise<GameContainer> {
    const {
      gameId,
      sessionId,
      userId,
      image = 'alpine:latest', // Default to simple alpine for demo
      command = ['sleep', '300'], // Keep container alive for 5 minutes
      env = []
    } = options;

    try {
      // Ensure the image exists locally, pull if needed
      await this.ensureImage(image);
      
      const container = await this.docker.createContainer({
        Image: image,
        Cmd: command,
        Env: [
          `GAME_ID=${gameId}`,
          `SESSION_ID=${sessionId}`,
          `USER_ID=${userId}`,
          ...env
        ],
        Labels: {
          'dillinger.type': 'game-session',
          'dillinger.game-id': gameId,
          'dillinger.session-id': sessionId,
          'dillinger.user-id': userId,
          'dillinger.created': new Date().toISOString()
        },
        name: `dillinger-game-${sessionId}`,
        AttachStdout: true,
        AttachStderr: true,
        // Add some basic resource limits
        HostConfig: {
          Memory: 512 * 1024 * 1024, // 512MB
          CpuShares: 512, // Half CPU priority
          AutoRemove: true // Clean up when container stops
        }
      });

      await container.start();

      const info = await container.inspect();
      
      return {
        id: info.Id,
        name: info.Name,
        image: info.Config.Image,
        status: info.State.Status,
        created: new Date(info.Created).getTime(),
        ports: info.NetworkSettings.Ports || {},
        labels: info.Config.Labels || {}
      };
    } catch (error) {
      throw new Error(`Failed to create game container: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async stopGameContainer(sessionId: string): Promise<void> {
    try {
      const containerName = `dillinger-game-${sessionId}`;
      const container = this.docker.getContainer(containerName);
      
      const info = await container.inspect().catch(() => null);
      if (!info) {
        console.log(`Container ${containerName} not found, may already be stopped`);
        return;
      }

      if (info.State.Running) {
        await container.stop({ t: 10 }); // 10 second grace period
        console.log(`Stopped container ${containerName}`);
      }
    } catch (error) {
      throw new Error(`Failed to stop game container: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getContainerLogs(sessionId: string): Promise<string> {
    try {
      const containerName = `dillinger-game-${sessionId}`;
      const container = this.docker.getContainer(containerName);
      
      const stream = await container.logs({
        stdout: true,
        stderr: true,
        timestamps: true,
        tail: 100
      });
      
      return stream.toString();
    } catch (error) {
      throw new Error(`Failed to get container logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async listGameContainers(): Promise<GameContainer[]> {
    try {
      const containers = await this.docker.listContainers({
        all: true,
        filters: {
          label: ['dillinger.type=game-session']
        }
      });

      return containers.map((container: ContainerInfo) => ({
        id: container.Id,
        name: container.Names[0]?.replace(/^\//, '') || 'unknown',
        image: container.Image,
        state: container.State,
        status: container.Status,
        created: container.Created,
        ports: container.Ports.reduce((acc: Record<string, number>, port: any) => {
          if (port.PublicPort && port.PrivatePort) {
            acc[`${port.PrivatePort}/${port.Type}`] = port.PublicPort;
          }
          return acc;
        }, {}),
        labels: container.Labels || {},
      }));
    } catch (error) {
      throw new Error(`Failed to list game containers: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async cleanupOldContainers(maxAgeMinutes: number = 60): Promise<void> {
    try {
      const cutoff = Date.now() - (maxAgeMinutes * 60 * 1000);
      const containers = await this.listGameContainers();
      
      for (const container of containers) {
        if (container.created < cutoff && container.status !== 'running') {
          try {
            const dockerContainer = this.docker.getContainer(container.id);
            await dockerContainer.remove({ force: true });
            console.log(`Cleaned up old container: ${container.name}`);
          } catch (error) {
            console.warn(`Failed to cleanup container ${container.name}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old containers:', error);
    }
  }
}