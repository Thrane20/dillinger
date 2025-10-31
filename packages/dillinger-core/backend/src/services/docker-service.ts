import Docker from 'dockerode';
import path from 'path';
import { existsSync } from 'fs';
import type { Game, Platform } from '@dillinger/shared';
import { JSONStorageService } from './storage.js';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

export interface GameLaunchOptions {
  game: Game;
  platform: Platform;
  sessionId: string;
}

export interface ContainerInfo {
  containerId: string;
  status: string;
  createdAt: string;
}

export class DockerService {
  private static instance: DockerService;
  private storage: JSONStorageService;
  
  // Volume name for the current game session
  private readonly SESSION_VOLUME = 'dillinger_current_session';
  
  // Host path mapping for devcontainer
  // When running in a devcontainer, /workspaces/dillinger maps to a host path
  // We need to detect this and use the host path for Docker volumes
  private workspaceHostPath: string | null = null;

  private constructor() {
    this.storage = JSONStorageService.getInstance();
    // detectHostPath will be called lazily on first use
  }
  
  static getInstance(): DockerService {
    if (!DockerService.instance) {
      DockerService.instance = new DockerService();
    }
    return DockerService.instance;
  }

  /**
   * Detect the host path for the workspace by inspecting the current container
   * This is called lazily on first volume operation
   */
  private async detectHostPath(): Promise<void> {
    if (this.workspaceHostPath !== null) {
      return; // Already detected
    }
    
    // First, try environment variable override
    if (process.env.HOST_WORKSPACE_PATH) {
      this.workspaceHostPath = process.env.HOST_WORKSPACE_PATH;
      console.log(`✓ Using HOST_WORKSPACE_PATH from env: ${this.workspaceHostPath}`);
      return;
    }
    
    try {
      // Get the hostname (container ID)
      const os = await import('os');
      const hostname = os.hostname();
      
      console.log(`Detecting host path for container: ${hostname}`);
      
      // Inspect the current container to find the workspace mount
      const container = docker.getContainer(hostname);
      const info = await container.inspect();
      
      console.log(`Found ${info.Mounts?.length || 0} mounts in container`);
      
      // Find the mount for /workspaces/dillinger
      const workspaceMount = info.Mounts?.find((mount: any) => 
        mount.Destination === '/workspaces/dillinger'
      );
      
      if (workspaceMount) {
        this.workspaceHostPath = workspaceMount.Source;
        console.log(`✓ Detected host workspace path: ${this.workspaceHostPath}`);
      } else {
        this.workspaceHostPath = ''; // Mark as checked but not found
        console.log('⚠ Not running in devcontainer, using container paths directly');
        console.log('Available mounts:', info.Mounts?.map((m: any) => m.Destination).join(', '));
      }
    } catch (error: any) {
      // Not running in a container or can't detect - use paths as-is
      this.workspaceHostPath = ''; // Mark as checked but not found
      console.log('⚠ Could not detect host path, using container paths');
      console.log('Error details:', error.message);
      console.log('💡 Tip: Set HOST_WORKSPACE_PATH environment variable to override');
    }
  }
  
  /**
   * Convert container path to host path for Docker volume binding
   */
  private getHostPath(containerPath: string): string {
    if (this.workspaceHostPath && this.workspaceHostPath !== '' && containerPath.startsWith('/workspaces/dillinger')) {
      // Replace the container workspace path with the host workspace path
      const relativePath = containerPath.substring('/workspaces/dillinger'.length);
      const hostPath = this.workspaceHostPath + relativePath;
      console.log(`  Path translation: ${containerPath} -> ${hostPath}`);
      return hostPath;
    }
    return containerPath;
  }

  /**
   * Create or update the dillinger_current_session volume to point to a specific game directory
   */
  async setCurrentSessionVolume(gamePath: string): Promise<void> {
    // Ensure host path is detected first
    await this.detectHostPath();
    const dillingerRoot = this.storage.getDillingerRoot();
    const absoluteGamePath = path.join(dillingerRoot, gamePath);
    
    // Convert to host path if running in devcontainer
    const hostGamePath = this.getHostPath(absoluteGamePath);

    console.log(`Setting session volume to: ${absoluteGamePath}`);
    if (hostGamePath !== absoluteGamePath) {
      console.log(`  Host path: ${hostGamePath}`);
    }

    try {
      // Check if volume exists
      const volume = docker.getVolume(this.SESSION_VOLUME);
      try {
        await volume.inspect();
        // Volume exists, remove it first
        console.log(`Removing existing ${this.SESSION_VOLUME} volume`);
        
        try {
          await volume.remove();
        } catch (removeErr: any) {
          if (removeErr.statusCode === 409) {
            // Volume is in use, find and remove containers using it
            console.log(`Volume in use, cleaning up containers...`);
            await this.cleanupVolumeContainers();
            
            // Try removing volume again
            await volume.remove();
          } else {
            throw removeErr;
          }
        }
      } catch (err: any) {
        if (err.statusCode !== 404) {
          throw err;
        }
        // Volume doesn't exist, which is fine
      }

      // Create new volume with bind mount to game directory
      console.log(`Creating ${this.SESSION_VOLUME} volume bound to ${hostGamePath}`);
      await docker.createVolume({
        Name: this.SESSION_VOLUME,
        Driver: 'local',
        DriverOpts: {
          type: 'none',
          device: hostGamePath,
          o: 'bind'
        }
      });

      console.log(`✓ Session volume configured for ${gamePath}`);
    } catch (error) {
      console.error('Error setting session volume:', error);
      throw new Error(`Failed to configure session volume: ${error}`);
    }
  }

  /**
   * Launch a game in a Docker container
   */
  async launchGame(options: GameLaunchOptions): Promise<ContainerInfo> {
    const { game, platform, sessionId } = options;

    // Set up the session volume to point to the game directory
    await this.setCurrentSessionVolume(game.filePath);

    // Get launch configuration
    const launchCommand = game.settings?.launch?.command || './start.sh';
    const launchArgs = game.settings?.launch?.arguments || [];
    const environment = game.settings?.launch?.environment || {};

    // Construct the full executable path inside the container
    const workingDir = game.settings?.launch?.workingDirectory || '.';
    const gameExecutable = path.posix.join('/game', workingDir, launchCommand);

    console.log(`Launching game: ${game.title}`);
    console.log(`  Container Image: ${platform.configuration.containerImage}`);
    console.log(`  Executable: ${gameExecutable}`);
    console.log(`  Arguments: ${launchArgs.join(' ')}`);

    // Prepare environment variables
    const env = [
      `GAME_EXECUTABLE=${gameExecutable}`,
      `GAME_ARGS=${launchArgs.join(' ')}`,
      ...Object.entries(environment).map(([key, value]) => `${key}=${value}`)
    ];

    // Get display forwarding configuration
    const displayConfig = this.getDisplayConfiguration();
    env.push(...displayConfig.env);
    
    console.log(`  Display mode: ${displayConfig.mode}`);

    try {
      // Create and start the container
      const container = await docker.createContainer({
        Image: platform.configuration.containerImage || 'dillinger/runner-linux-native:latest',
        name: `dillinger-session-${sessionId}`,
        Env: env,
        HostConfig: {
          AutoRemove: false, // Keep container after exit for debugging
          Binds: [
            `${this.SESSION_VOLUME}:/game:ro`, // Mount game directory as read-only
            `dillinger_saves_${sessionId}:/saves:rw`, // Mount saves directory as read-write
            ...displayConfig.volumes
          ],
          Devices: displayConfig.devices,
          IpcMode: displayConfig.ipcMode,
          SecurityOpt: displayConfig.securityOpt,
        },
        // For interactive testing, attach TTY
        Tty: true,
        OpenStdin: true,
        AttachStdout: true,
        AttachStderr: true,
      });

      await container.start();
      
      const info = await container.inspect();

      console.log(`✓ Game container started: ${container.id}`);
      console.log(`  Container ID: ${info.Id}`);
      console.log(`  Status: ${info.State.Status}`);

      return {
        containerId: info.Id,
        status: info.State.Status,
        createdAt: info.Created,
      };
    } catch (error) {
      console.error('Error launching game container:', error);
      throw new Error(`Failed to launch game: ${error}`);
    }
  }

  /**
   * Stop a running game container
   */
  async stopGame(containerId: string): Promise<void> {
    try {
      const container = docker.getContainer(containerId);
      await container.stop();
      console.log(`✓ Game container stopped: ${containerId}`);
    } catch (error: any) {
      // 304 means container is already stopped - this is fine
      if (error.statusCode === 304) {
        console.log(`ℹ Game container already stopped: ${containerId}`);
        return;
      }
      
      // 404 means container doesn't exist - also not really an error
      if (error.statusCode === 404) {
        console.log(`ℹ Game container not found (may have been removed): ${containerId}`);
        return;
      }
      
      console.error('Error stopping game container:', error);
      throw new Error(`Failed to stop game: ${error}`);
    }
  }

  /**
   * Clean up any containers using the session volume
   */
  private async cleanupVolumeContainers(): Promise<void> {
    try {
      // List all containers (including stopped ones) that might be using the volume
      const allContainers = await docker.listContainers({
        all: true,
        filters: {
          volume: [this.SESSION_VOLUME]
        }
      });

      console.log(`Found ${allContainers.length} containers using ${this.SESSION_VOLUME}`);

      for (const containerInfo of allContainers) {
        const container = docker.getContainer(containerInfo.Id);
        console.log(`Cleaning up container: ${containerInfo.Names[0]} (${containerInfo.Id.substring(0, 12)})`);
        
        try {
          // Stop if running
          if (containerInfo.State === 'running') {
            await container.stop({ t: 2 }); // 2 second timeout
            console.log(`  Stopped container`);
          }
          
          // Remove the container
          await container.remove({ force: true });
          console.log(`  Removed container`);
        } catch (err: any) {
          console.error(`  Failed to cleanup container ${containerInfo.Id}: ${err.message}`);
          // Continue with other containers even if one fails
        }
      }
    } catch (error: any) {
      console.error('Error cleaning up volume containers:', error.message);
      // Don't throw - we'll try to proceed anyway
    }
  }

  /**
   * Get container status
   */
  async getContainerStatus(containerId: string): Promise<string> {
    try {
      const container = docker.getContainer(containerId);
      const info = await container.inspect();
      return info.State.Status;
    } catch (error: any) {
      if (error.statusCode === 404) {
        return 'not-found';
      }
      throw error;
    }
  }

  /**
   * List all running Dillinger game containers
   */
  async listGameContainers(): Promise<ContainerInfo[]> {
    try {
      const containers = await docker.listContainers({
        filters: {
          name: ['dillinger-session-']
        }
      });

      return containers.map((container: Docker.ContainerInfo) => ({
        containerId: container.Id,
        status: container.State,
        createdAt: new Date(container.Created * 1000).toISOString(),
      }));
    } catch (error) {
      console.error('Error listing game containers:', error);
      throw new Error(`Failed to list game containers: ${error}`);
    }
  }

  /**
   * Get container logs
   */
  async getContainerLogs(containerId: string, tail: number = 100): Promise<string> {
    try {
      const container = docker.getContainer(containerId);
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        tail,
        timestamps: true,
      });
      return logs.toString('utf8');
    } catch (error) {
      console.error('Error getting container logs:', error);
      throw new Error(`Failed to get container logs: ${error}`);
    }
  }

  /**
   * Get display forwarding configuration based on host environment
   * Supports X11 and Wayland display protocols
   * Prefers X11 when both are available (more compatible with games)
   */
  private getDisplayConfiguration(): {
    mode: 'x11' | 'wayland' | 'none';
    env: string[];
    volumes: string[];
    devices: Array<{ PathOnHost: string; PathInContainer: string; CgroupPermissions: string }>;
    ipcMode?: string;
    securityOpt?: string[];
  } {
    const display = process.env.DISPLAY;
    const waylandDisplay = process.env.WAYLAND_DISPLAY;
    const xdgRuntimeDir = process.env.XDG_RUNTIME_DIR;
    
    // Prefer X11 first (more compatible with legacy games and tools like xterm)
    if (display) {
      const xauthority = process.env.XAUTHORITY || `${process.env.HOME}/.Xauthority`;
      console.log(`Using X11 display: ${display}`);
      
      // Check if Xauthority file exists
      const xauthorityExists = existsSync(xauthority);
      
      const volumes = ['/tmp/.X11-unix:/tmp/.X11-unix:rw'];
      if (xauthorityExists) {
        volumes.push(`${xauthority}:/home/gameuser/.Xauthority:ro`);
        console.log(`  Xauthority: ${xauthority}`);
      } else {
        console.log(`  ⚠ No Xauthority file found, X11 may require xhost +local:docker`);
      }
      
      // Check if GPU device exists
      const devices = [];
      if (existsSync('/dev/dri')) {
        devices.push({ PathOnHost: '/dev/dri', PathInContainer: '/dev/dri', CgroupPermissions: 'rwm' });
        console.log(`  ✓ GPU device available`);
      } else {
        console.log(`  ⚠ No GPU device (/dev/dri not found), software rendering only`);
      }
      
      return {
        mode: 'x11',
        env: [
          `DISPLAY=${display}`,
          'XAUTHORITY='  // Disable Xauthority requirement
        ],
        volumes,
        devices,
        ipcMode: 'host', // Required for X11 shared memory
        securityOpt: ['seccomp=unconfined'] // Some X11 apps need this
      };
    }
    
    // Fall back to Wayland if X11 is not available
    if (waylandDisplay && xdgRuntimeDir) {
      const waylandSocket = `${xdgRuntimeDir}/${waylandDisplay}`;
      console.log(`Using Wayland display: ${waylandDisplay}`);
      
      // Check if GPU device exists
      const devices = [];
      if (existsSync('/dev/dri')) {
        devices.push({ PathOnHost: '/dev/dri', PathInContainer: '/dev/dri', CgroupPermissions: 'rwm' });
        console.log(`  ✓ GPU device available`);
      } else {
        console.log(`  ⚠ No GPU device (/dev/dri not found), software rendering only`);
      }
      
      return {
        mode: 'wayland',
        env: [
          `WAYLAND_DISPLAY=${waylandDisplay}`,
          `XDG_RUNTIME_DIR=/run/user/1000`,
          'QT_QPA_PLATFORM=wayland',
          'GDK_BACKEND=wayland',
          'SDL_VIDEODRIVER=wayland'
        ],
        volumes: [
          `${waylandSocket}:/run/user/1000/${waylandDisplay}:rw`
        ],
        devices,
        securityOpt: []
      };
    }
    
    // No display available - headless mode
    console.warn('⚠ No display environment detected (DISPLAY or WAYLAND_DISPLAY not set)');
    console.warn('  Games with graphical output will not be visible');
    
    return {
      mode: 'none',
      env: [],
      volumes: [],
      devices: []
    };
  }
}
