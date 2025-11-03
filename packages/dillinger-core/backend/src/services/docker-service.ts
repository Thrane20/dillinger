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

export interface GameInstallOptions {
  installerPath: string; // Absolute path to installer file on host
  installPath: string; // Absolute path to target installation directory
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
            `dillinger_installers:/installers:rw`, // Use named volume for installers
            `dillinger_installed:/config:rw`, // Use named volume for config
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
   * Install a game using Docker with GUI support
   * This runs an installer (exe, msi, etc.) in a containerized environment
   * with X11/Wayland passthrough so the user sees the installation wizard
   */
  async installGame(options: GameInstallOptions): Promise<ContainerInfo> {
    const { installerPath, installPath, platform, sessionId } = options;

    // Ensure host path is detected
    await this.detectHostPath();

    console.log(`Installing game with installer: ${installerPath}`);
    console.log(`  Installation target: ${installPath}`);
    console.log(`  Platform: ${platform.name} (${platform.type})`);
    console.log(`  Container Image: ${platform.configuration.containerImage}`);

    // Convert paths to host paths if running in devcontainer
    const hostInstallerPath = this.getHostPath(installerPath);
    const hostInstallPath = this.getHostPath(installPath);

    // Get display forwarding configuration
    const displayConfig = this.getDisplayConfiguration();
    console.log(`  Display mode: ${displayConfig.mode}`);

    // Prepare environment variables for installation
    const env = [
      `INSTALLER_PATH=/installer/${path.basename(installerPath)}`,
      `INSTALL_TARGET=/install`,
      ...displayConfig.env
    ];

    // Add Wine-specific configuration for Windows installers
    if (platform.type === 'wine') {
      env.push(
        'WINEDEBUG=-all', // Reduce Wine debug output
        'WINEPREFIX=/install/.wine', // Use install directory for Wine prefix
        'DISPLAY_WINEPREFIX=1' // Signal to show Wine configuration if needed
      );
    }

    try {
      // Create installation container with GUI passthrough
      const container = await docker.createContainer({
        Image: platform.configuration.containerImage || 'dillinger/runner-wine:latest',
        name: `dillinger-install-${sessionId}`,
        Env: env,
        HostConfig: {
          AutoRemove: false, // Keep container for debugging
          Binds: [
            `${hostInstallerPath}:/installer/${path.basename(installerPath)}:ro`, // Mount installer as read-only
            `${hostInstallPath}:/install:rw`, // Mount installation target as read-write
            `${hostInstallPath}/.wine:/wineprefix:rw`, // Prevent anonymous wineprefix volume
            `dillinger_installers:/installers:rw`, // Use named volume for installers
            `dillinger_installed:/config:rw`, // Use named volume for config
            ...displayConfig.volumes
          ],
          Devices: displayConfig.devices,
          IpcMode: displayConfig.ipcMode,
          SecurityOpt: displayConfig.securityOpt,
        },
        // Interactive mode for installation GUI
        Tty: true,
        OpenStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        // Override entrypoint to run installer directly
        Entrypoint: platform.type === 'wine' ? ['/usr/bin/wine'] : ['/bin/bash', '-c'],
        Cmd: platform.type === 'wine' 
          ? [`/installer/${path.basename(installerPath)}`]
          : [`/installer/${path.basename(installerPath)}`],
      });

      await container.start();
      
      const info = await container.inspect();

      console.log(`✓ Installation container started: ${container.id}`);
      console.log(`  Container ID: ${info.Id}`);
      console.log(`  Status: ${info.State.Status}`);
      console.log(`  The installation GUI should now be visible on your display`);

      return {
        containerId: info.Id,
        status: info.State.Status,
        createdAt: info.Created,
      };
    } catch (error) {
      console.error('Error starting installation container:', error);
      throw new Error(`Failed to start installer: ${error}`);
    }
  }

  /**
   * Monitor an installation container and return completion status
   */
  async waitForInstallationComplete(containerId: string): Promise<{ success: boolean; exitCode: number }> {
    try {
      const container = docker.getContainer(containerId);
      
      // Wait for container to finish
      console.log(`🔍 Monitoring installation container: ${containerId}`);
      const result = await container.wait();
      
      console.log(`✓ Installation container finished with exit code: ${result.StatusCode}`);
      
      return {
        success: result.StatusCode === 0,
        exitCode: result.StatusCode
      };
    } catch (error) {
      console.error('Error monitoring installation:', error);
      return { success: false, exitCode: -1 };
    }
  }

  /**
   * Scan installation directory for game executables
   */
  async scanForGameExecutables(installPath: string): Promise<string[]> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    try {
      console.log(`🔍 Scanning for game executables in: ${installPath}`);
      
      const executables: string[] = [];
      
      const scanDirectory = async (dirPath: string, depth: number = 0): Promise<void> => {
        // Limit recursion depth to avoid scanning too deep
        if (depth > 3) return;
        
        try {
          const items = await fs.readdir(dirPath, { withFileTypes: true });
          
          for (const item of items) {
            const itemPath = path.join(dirPath, item.name);
            const relativePath = path.relative(installPath, itemPath);
            
            if (item.isFile()) {
              const ext = path.extname(item.name).toLowerCase();
              // Look for executable files
              if (['.exe', '.bat', '.cmd'].includes(ext)) {
                // Prioritize likely game executables
                const name = item.name.toLowerCase();
                const isMainExecutable = 
                  name.includes('game') ||
                  name.includes('main') ||
                  name.includes('start') ||
                  name.includes('launcher') ||
                  name.includes('run') ||
                  !name.includes('uninstall') &&
                  !name.includes('setup') &&
                  !name.includes('install') &&
                  !name.includes('config') &&
                  !name.includes('settings');
                
                if (isMainExecutable) {
                  executables.push(relativePath);
                  console.log(`  Found executable: ${relativePath}`);
                }
              }
            } else if (item.isDirectory()) {
              // Skip common non-game directories
              const dirName = item.name.toLowerCase();
              if (!['temp', 'tmp', 'cache', 'logs', 'uninstall', '_redist'].includes(dirName)) {
                await scanDirectory(itemPath, depth + 1);
              }
            }
          }
        } catch (err) {
          console.warn(`Could not scan directory ${dirPath}:`, err);
        }
      };
      
      await scanDirectory(installPath);
      
      // Sort executables by likelihood (shorter paths and better names first)
      executables.sort((a, b) => {
        const depthA = a.split(path.sep).length;
        const depthB = b.split(path.sep).length;
        if (depthA !== depthB) return depthA - depthB;
        
        const nameA = path.basename(a).toLowerCase();
        const nameB = path.basename(b).toLowerCase();
        
        // Prioritize main-sounding names
        const scoreA = (nameA.includes('game') ? 10 : 0) + (nameA.includes('main') ? 8 : 0);
        const scoreB = (nameB.includes('game') ? 10 : 0) + (nameB.includes('main') ? 8 : 0);
        
        return scoreB - scoreA;
      });
      
      console.log(`✓ Found ${executables.length} potential game executables`);
      return executables;
      
    } catch (error) {
      console.error('Error scanning for executables:', error);
      return [];
    }
  }

  /**
   * Scan for Windows shortcut files (.lnk) in the installation directory
   */
  async scanForShortcuts(installPath: string): Promise<string[]> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    try {
      console.log(`🔍 Scanning for shortcuts in: ${installPath}`);
      
      const shortcuts: string[] = [];
      
      const scanDirectory = async (dirPath: string, depth: number = 0): Promise<void> => {
        // Limit recursion depth but allow deeper for shortcut scanning
        if (depth > 10) return;
        
        try {
          const items = await fs.readdir(dirPath, { withFileTypes: true });
          
          for (const item of items) {
            const itemPath = path.join(dirPath, item.name);
            const relativePath = path.relative(installPath, itemPath);
            
            if (item.isFile()) {
              const ext = path.extname(item.name).toLowerCase();
              if (ext === '.lnk') {
                shortcuts.push(relativePath);
                console.log(`  Found shortcut: ${relativePath}`);
              }
            } else if (item.isDirectory()) {
              // Look in common shortcut directories
              const dirName = item.name.toLowerCase();
              if (['start menu', 'desktop', 'menu', 'shortcuts'].some(keyword => dirName.includes(keyword)) || depth < 5) {
                await scanDirectory(itemPath, depth + 1);
              }
            }
          }
        } catch (err) {
          console.warn(`Could not scan directory ${dirPath}:`, err);
        }
      };
      
      await scanDirectory(installPath);
      
      console.log(`✓ Found ${shortcuts.length} shortcut files`);
      return shortcuts;
      
    } catch (error) {
      console.error('Error scanning for shortcuts:', error);
      return [];
    }
  }

  /**
   * Parse a Windows shortcut (.lnk) file to extract target information
   * Uses direct binary parsing to work with Wine-created .lnk files on Linux
   */
  async parseShortcut(shortcutPath: string): Promise<{
    target: string;
    arguments: string;
    workingDirectory: string;
    description: string;
  } | null> {
    console.log(`🔗 Parsing shortcut: ${shortcutPath}`);
    
    try {
      const fs = await import('fs/promises');
      
      // Read the entire .lnk file
      const buffer = await fs.readFile(shortcutPath);
      
      // Verify it's a valid .lnk file (starts with magic bytes)
      if (buffer.length < 76 || buffer.readUInt32LE(0) !== 0x0000004C) {
        console.warn('Invalid .lnk file format');
        return null;
      }
      
      const result = {
        target: '',
        arguments: '',
        workingDirectory: '',
        description: ''
      };
      
      // Read LinkFlags at offset 0x14
      const linkFlags = buffer.readUInt32LE(0x14);
      
      // HasLinkTargetIDList flag (0x01)
      const hasLinkTargetIDList = (linkFlags & 0x01) !== 0;
      // HasLinkInfo flag (0x02)
      const hasLinkInfo = (linkFlags & 0x02) !== 0;
      // HasName flag (0x04)
      const hasName = (linkFlags & 0x04) !== 0;
      // HasRelativePath flag (0x08)
      const hasRelativePath = (linkFlags & 0x08) !== 0;
      // HasWorkingDir flag (0x10)
      const hasWorkingDir = (linkFlags & 0x10) !== 0;
      // HasArguments flag (0x20)
      const hasArguments = (linkFlags & 0x20) !== 0;
      
      let offset = 0x4C; // Start after shell link header (76 bytes)
      
      // Skip LinkTargetIDList if present
      if (hasLinkTargetIDList) {
        const idListSize = buffer.readUInt16LE(offset);
        offset += 2 + idListSize;
      }
      
      // Parse LinkInfo if present
      if (hasLinkInfo && offset + 4 <= buffer.length) {
        const linkInfoSize = buffer.readUInt32LE(offset);
        const linkInfoStart = offset;
        
        if (offset + linkInfoSize <= buffer.length) {
          // Try to extract local base path
          const linkInfoHeaderSize = buffer.readUInt32LE(offset + 4);
          
          if (linkInfoHeaderSize >= 0x1C) {
            const localBasePathOffset = buffer.readUInt32LE(offset + 0x10);
            
            if (localBasePathOffset > 0 && linkInfoStart + localBasePathOffset < buffer.length) {
              let pathEnd = linkInfoStart + localBasePathOffset;
              while (pathEnd < buffer.length && buffer[pathEnd] !== 0) {
                pathEnd++;
              }
              result.target = buffer.toString('ascii', linkInfoStart + localBasePathOffset, pathEnd);
            }
          }
          
          offset += linkInfoSize;
        }
      }
      
      // Helper function to read a string data structure
      const readStringData = (pos: number): { str: string; nextPos: number } => {
        if (pos + 2 > buffer.length) return { str: '', nextPos: pos };
        
        const charCount = buffer.readUInt16LE(pos);
        const strStart = pos + 2;
        const strEnd = strStart + (charCount * 2);
        
        if (strEnd > buffer.length) return { str: '', nextPos: pos };
        
        // Read UTF-16LE string
        const str = buffer.toString('utf16le', strStart, strEnd);
        return { str, nextPos: strEnd };
      };
      
      // Read string data structures
      if (hasName && offset + 2 <= buffer.length) {
        const { str, nextPos } = readStringData(offset);
        result.description = str;
        offset = nextPos;
      }
      
      if (hasRelativePath && offset + 2 <= buffer.length) {
        const { str, nextPos } = readStringData(offset);
        if (!result.target) {
          result.target = str;
        }
        offset = nextPos;
      }
      
      if (hasWorkingDir && offset + 2 <= buffer.length) {
        const { str, nextPos } = readStringData(offset);
        result.workingDirectory = str;
        offset = nextPos;
      }
      
      if (hasArguments && offset + 2 <= buffer.length) {
        const { str, nextPos } = readStringData(offset);
        result.arguments = str;
        offset = nextPos;
      }
      
      console.log(`✓ Parsed shortcut: ${result.target || 'No target found'}`);
      console.log(`  Working dir: ${result.workingDirectory || 'None'}`);
      console.log(`  Arguments: ${result.arguments || 'None'}`);
      
      return result.target ? result : null;
      
    } catch (error) {
      console.error('Error parsing shortcut:', error);
      return null;
    }
  }

  /**
   * Stop a running game container and clean up its session volume
   */
  async stopGame(containerId: string, cleanupVolume: boolean = true): Promise<void> {
    try {
      const container = docker.getContainer(containerId);
      
      // Extract session ID from container name before stopping
      let sessionId: string | null = null;
      if (cleanupVolume) {
        try {
          const info = await container.inspect();
          const containerName = info.Name.replace(/^\//, ''); // Remove leading slash
          const match = containerName.match(/dillinger-session-(.+)/);
          if (match && match[1]) {
            sessionId = match[1];
          }
        } catch (err) {
          console.warn('Could not extract session ID for cleanup:', err);
        }
      }
      
      await container.stop();
      console.log(`✓ Game container stopped: ${containerId}`);
      
      // Clean up the session volume
      if (cleanupVolume && sessionId) {
        await this.cleanupSessionVolume(sessionId);
      }
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
   * Clean up a session's save volume
   */
  async cleanupSessionVolume(sessionId: string): Promise<void> {
    const volumeName = `dillinger_saves_${sessionId}`;
    try {
      const volume = docker.getVolume(volumeName);
      await volume.remove();
      console.log(`✓ Cleaned up session volume: ${volumeName}`);
    } catch (error: any) {
      if (error.statusCode === 404) {
        console.log(`ℹ Session volume not found (already cleaned): ${volumeName}`);
        return;
      }
      console.error(`Failed to cleanup session volume ${volumeName}:`, error);
      // Don't throw - volume cleanup failure shouldn't break session stop
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

  /**
   * List all session volumes (dillinger_saves_*)
   */
  async listSessionVolumes(): Promise<Array<{ name: string; inUse: boolean }>> {
    try {
      // Get all volumes
      const volumeListResponse = await docker.listVolumes();
      const allVolumes = volumeListResponse.Volumes || [];
      
      // Filter for session volumes
      const sessionVolumes = allVolumes
        .filter(vol => vol.Name.startsWith('dillinger_saves_'))
        .map(vol => vol.Name);

      // Get all running containers to check which volumes are in use
      const runningContainers = await docker.listContainers();
      const volumesInUse = new Set<string>();

      for (const container of runningContainers) {
        const containerInfo = await docker.getContainer(container.Id).inspect();
        const mounts = containerInfo.Mounts || [];
        mounts.forEach(mount => {
          if (mount.Type === 'volume' && mount.Name) {
            volumesInUse.add(mount.Name);
          }
        });
      }

      return sessionVolumes.map(name => ({
        name,
        inUse: volumesInUse.has(name),
      }));
    } catch (error) {
      console.error('Error listing session volumes:', error);
      throw new Error(`Failed to list session volumes: ${error}`);
    }
  }

  /**
   * Clean up all inactive session volumes
   * Returns count of volumes cleaned and any errors
   */
  async cleanupInactiveSessionVolumes(): Promise<{ cleaned: number; failed: number; errors: string[] }> {
    try {
      const sessionVolumes = await this.listSessionVolumes();
      const inactiveVolumes = sessionVolumes.filter(v => !v.inUse);

      console.log(`Found ${inactiveVolumes.length} inactive session volumes to clean up`);

      let cleaned = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const volumeInfo of inactiveVolumes) {
        try {
          const volume = docker.getVolume(volumeInfo.name);
          await volume.remove();
          console.log(`  ✓ Cleaned up: ${volumeInfo.name}`);
          cleaned++;
        } catch (error: any) {
          console.error(`  ✗ Failed to clean up ${volumeInfo.name}:`, error.message);
          failed++;
          errors.push(`${volumeInfo.name}: ${error.message}`);
        }
      }

      console.log(`✓ Cleanup complete: ${cleaned} cleaned, ${failed} failed`);

      return { cleaned, failed, errors };
    } catch (error) {
      console.error('Error during bulk cleanup:', error);
      throw new Error(`Failed to cleanup session volumes: ${error}`);
    }
  }
}
