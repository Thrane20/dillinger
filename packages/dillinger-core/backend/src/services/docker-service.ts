import Docker from 'dockerode';
import path from 'path';
import { existsSync } from 'fs';
import type { Game, Platform } from '@dillinger/shared';
import { JSONStorageService } from './storage.js';
import { SettingsService } from './settings.js';

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
  game: Game; // Game object for slug and other metadata
}

export interface ContainerInfo {
  containerId: string;
  status: string;
  createdAt: string;
}

export interface DebugContainerInfo extends ContainerInfo {
  execCommand: string; // Docker exec command to attach to container
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
   * Build WINEDEBUG environment variable from game settings
   * @param game Game object with optional wine debug configuration
   * @returns WINEDEBUG string (e.g., "-all", "+relay,+seh", "+all")
   */
  private buildWineDebug(game: Game): string {
    const debug = game.settings?.wine?.debug;
    
    // If no debug settings or all false, disable all debug output
    if (!debug || Object.keys(debug).length === 0) {
      return '-all';
    }
    
    // If "all" is enabled, enable all debug output
    if (debug.all) {
      return '+all';
    }
    
    // Build comma-separated list of enabled channels
    const enabledChannels: string[] = [];
    
    if (debug.relay) enabledChannels.push('+relay');
    if (debug.seh) enabledChannels.push('+seh');
    if (debug.tid) enabledChannels.push('+tid');
    if (debug.timestamp) enabledChannels.push('+timestamp');
    if (debug.heap) enabledChannels.push('+heap');
    if (debug.file) enabledChannels.push('+file');
    if (debug.module) enabledChannels.push('+module');
    if (debug.win) enabledChannels.push('+win');
    if (debug.d3d) enabledChannels.push('+d3d');
    if (debug.opengl) enabledChannels.push('+opengl');
    
    // If no channels enabled, disable all
    if (enabledChannels.length === 0) {
      return '-all';
    }
    
    // Return comma-separated list
    return enabledChannels.join(',');
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
   * Create session volume for an absolute path (e.g., installed games)
   */
  async setCurrentSessionVolumeAbsolute(absolutePath: string): Promise<void> {
    // Ensure host path is detected first
    await this.detectHostPath();
    
    // Convert to host path if running in devcontainer
    const hostPath = this.getHostPath(absolutePath);

    console.log(`Setting session volume to absolute path: ${absolutePath}`);
    if (hostPath !== absolutePath) {
      console.log(`  Host path: ${hostPath}`);
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

      // Create new volume with bind mount to absolute path
      console.log(`Creating ${this.SESSION_VOLUME} volume bound to ${hostPath}`);
      await docker.createVolume({
        Name: this.SESSION_VOLUME,
        Driver: 'local',
        DriverOpts: {
          type: 'none',
          device: hostPath,
          o: 'bind'
        }
      });

      console.log(`✓ Session volume configured for ${absolutePath}`);
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

    // Ensure host path detection
    await this.detectHostPath();

    const gameDirectory = game.installation?.installPath || game.filePath;
    
    if (!gameDirectory) {
      throw new Error('Game has no file path or installation path configured');
    }

    // Set up the session volume ONLY for non-Wine games
    // Wine games use direct Wine prefix bind mounts, no temp volume needed
    if (platform.type !== 'wine') {
      const isAbsolutePath = path.isAbsolute(gameDirectory);
      if (isAbsolutePath) {
        await this.setCurrentSessionVolumeAbsolute(gameDirectory);
      } else {
        await this.setCurrentSessionVolume(gameDirectory);
      }
    }

    // Get launch configuration
    const launchCommand = game.settings?.launch?.command || './start.sh';
    const launchArgs = game.settings?.launch?.arguments || [];
    const environment = game.settings?.launch?.environment || {};

    // For Wine games, convert Windows paths to Linux paths within the Wine prefix
    // Windows path: C:\GOG Games\Close Combat 3\cc3.exe
    // Becomes: /wineprefix/drive_c/GOG Games/Close Combat 3/cc3.exe
    let gameExecutable: string;
    let cmdArray: string[];
    let containerWorkingDir: string | undefined;
    
    if (platform.type === 'wine') {
      // Convert Windows path to Linux path in Wine prefix
      // Remove drive letter (C:) and convert backslashes to forward slashes
      let linuxPath = launchCommand.replace(/^[A-Za-z]:/, ''); // Remove "C:"
      linuxPath = linuxPath.replace(/\\/g, '/'); // Convert backslashes
      
      // Construct full path: /wineprefix/drive_c/path/to/game.exe
      gameExecutable = path.posix.join('/wineprefix/drive_c', linuxPath);
      
      // Prepare clean arguments
      const cleanArgs = launchArgs
        .filter(arg => arg && typeof arg === 'string')
        .map(arg => arg.replace(/\0/g, ''))
        .filter(arg => arg !== ''); // Remove empty strings
      
      // Build Wine command with Linux path: wine /wineprefix/drive_c/GOG Games/.../game.exe arg1 arg2
      cmdArray = ['wine', gameExecutable, ...cleanArgs];
      
      // Working directory doesn't matter - WINEPREFIX handles it
      containerWorkingDir = '/wineprefix';
      
      console.log(`Launching game: ${game.title}`);
      console.log(`  Container Image: ${platform.configuration.containerImage}`);
      console.log(`  Original Windows path: ${launchCommand}`);
      console.log(`  Converted Linux path: ${gameExecutable}`);
      console.log(`  Wine command: ${cmdArray.join(' ')}`);
      console.log(`  Container working dir: ${containerWorkingDir}`);
    } else {
      // For native Linux games, construct the path normally
      gameExecutable = path.posix.join('/game', launchCommand);
      
      const cleanArgs = launchArgs
        .filter(arg => arg && typeof arg === 'string')
        .map(arg => arg.replace(/\0/g, ''));
      
      cmdArray = [gameExecutable, ...cleanArgs];
      containerWorkingDir = '/game';
      
      console.log(`Launching game: ${game.title}`);
      console.log(`  Container Image: ${platform.configuration.containerImage}`);
      console.log(`  Executable: ${gameExecutable}`);
      console.log(`  Arguments: ${cleanArgs.join(' ') || '(none)'}`);
      console.log(`  Working directory: ${containerWorkingDir}`);
    }

    // Prepare environment variables
    const env = [
      `GAME_ID=${game.id}`,
      `SESSION_ID=${sessionId}`,
      `SAVES_PATH=/data/saves/${game.id}`, // Game-specific saves directory in dillinger_root
      ...Object.entries(environment).map(([key, value]) => `${key}=${value}`)
    ];

    // Add Wine-specific configuration for Windows games
    if (platform.type === 'wine') {
      // The Wine container's entrypoint script expects GAME_EXECUTABLE
      const cleanArgs = launchArgs
        .filter(arg => arg && typeof arg === 'string')
        .map(arg => arg.replace(/\0/g, ''))
        .filter(arg => arg !== '')
        .join(' ');
      
      // Build WINEDEBUG environment variable from game settings
      const wineDebug = this.buildWineDebug(game);
      
      // Check if fullscreen/virtual desktop is requested
      const fullscreen = game.settings?.launch?.fullscreen || false;
      const resolution = game.settings?.launch?.resolution || '1920x1080';
      
      // Note: WINEARCH should NOT be set when launching with an existing prefix
      // Wine will auto-detect the architecture from the existing prefix
      // Setting it causes "not supported in wow64 mode" errors
      env.push(
        `WINEDEBUG=${wineDebug}`,
        'WINEPREFIX=/wineprefix',
        `GAME_EXECUTABLE=${gameExecutable}`,
        `GAME_ARGS=${cleanArgs}`
      );
      
      // Add Wine virtual desktop for fullscreen support
      if (fullscreen) {
        env.push(`WINE_VIRTUAL_DESKTOP=${resolution}`);
        console.log(`  Wine virtual desktop enabled: ${resolution}`);
      }
      
      console.log(`  WINEDEBUG=${wineDebug}`);
      console.log(`  GAME_EXECUTABLE=${gameExecutable}`);
      console.log(`  GAME_ARGS=${cleanArgs || '(none)'}`);
    }

    // Get display forwarding configuration
    const displayConfig = await this.getDisplayConfiguration();
    env.push(...displayConfig.env);
    
    console.log(`  Display mode: ${displayConfig.mode}`);
    console.log(`  WINEPREFIX will be set to: /wineprefix`);
    
    // Determine Wine prefix path if this is a Wine game
    // The game files are in the filePath (e.g., "close-combat-iii-the-russian-front")
    // The Wine prefix is in dillinger_installed/.wine-<slug>
    const gameIdentifier = game.slug || game.id;
    let winePrefixPath: string | null = null;
    
    if (platform.type === 'wine') {
      // Extract the base directory from the game's filePath
      // filePath is like "close-combat-iii-the-russian-front" or "games/my-game"
      const gameBasePath = game.filePath.split('/')[0]; // Get first segment
      const installBasePath = game.filePath.includes('/') 
        ? game.filePath.substring(0, game.filePath.lastIndexOf('/'))
        : '';
      
      // For now, assume Wine prefix is in /mnt/linuxfast/dillinger_installed
      // TODO: Make this configurable
      const hostInstallPath = '/mnt/linuxfast/dillinger_installed';
      winePrefixPath = path.posix.join(
        this.getHostPath(hostInstallPath),
        `.wine-${gameIdentifier}`
      );
      
      console.log(`  Wine prefix: ${winePrefixPath}`);
    }

    // Build volume binds
    const binds = [
      `dillinger_root:/data:rw`, // Mount dillinger_root volume for saves/state
      `dillinger_installers:/installers:rw`, // Use named volume for installers
      `dillinger_installed:/config:rw`, // Use named volume for config
      ...displayConfig.volumes
    ];
    
    // For Wine games, mount the Wine prefix; for native games, mount the game directory
    if (platform.type === 'wine' && winePrefixPath) {
      binds.push(`${winePrefixPath}:/wineprefix:rw`);
      console.log(`  Mounting Wine prefix: ${winePrefixPath} -> /wineprefix`);
    } else {
      // For non-Wine games, mount the game directory
      binds.push(`${this.SESSION_VOLUME}:/game:ro`);
      console.log(`  Mounting game directory: ${this.SESSION_VOLUME} -> /game`);
    }

    try {
      // Create and start the container
      const containerConfig: any = {
        Image: platform.configuration.containerImage || 'dillinger/runner-linux-native:latest',
        name: `dillinger-session-${sessionId}`,
        Env: env,
        WorkingDir: containerWorkingDir,
        HostConfig: {
          AutoRemove: true, // Auto-remove container when stopped
          Binds: binds,
          Devices: displayConfig.devices,
          IpcMode: displayConfig.ipcMode,
          SecurityOpt: displayConfig.securityOpt,
        },
        // For interactive testing, attach TTY
        Tty: true,
        OpenStdin: true,
        AttachStdout: true,
        AttachStderr: true,
      };
      
      // For Wine games, the entrypoint script handles execution via env vars
      // For native games, pass the command directly
      if (platform.type !== 'wine') {
        containerConfig.Cmd = cmdArray;
      }
      
      const container = await docker.createContainer(containerConfig);

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
   * Launch a debug container for troubleshooting
   * Returns the container info and a docker exec command to attach interactively
   */
  async launchDebugContainer(options: GameLaunchOptions): Promise<DebugContainerInfo> {
    const { game, platform, sessionId } = options;

    // Ensure host path detection
    await this.detectHostPath();

    const gameDirectory = game.installation?.installPath || game.filePath;
    
    if (!gameDirectory) {
      throw new Error('Game has no file path or installation path configured');
    }

    // Set up the session volume ONLY for non-Wine games
    // Wine games use direct Wine prefix bind mounts, no temp volume needed
    if (platform.type !== 'wine') {
      const isAbsolutePath = path.isAbsolute(gameDirectory);
      if (isAbsolutePath) {
        await this.setCurrentSessionVolumeAbsolute(gameDirectory);
      } else {
        await this.setCurrentSessionVolume(gameDirectory);
      }
    }

    // Get Wine prefix for Wine games (same logic as launchGame)
    const gameIdentifier = game.slug || game.id;
    let winePrefixPath: string | null = null;
    
    if (platform.type === 'wine') {
      const hostInstallPath = '/mnt/linuxfast/dillinger_installed';
      winePrefixPath = path.posix.join(
        this.getHostPath(hostInstallPath),
        `.wine-${gameIdentifier}`
      );
      console.log(`  Debug Wine prefix: ${winePrefixPath}`);
    }

    // Setup display configuration
    const displayConfig = await this.getDisplayConfiguration();
    
    // Base environment
    const env = [
      ...displayConfig.env,
      'DEBIAN_FRONTEND=noninteractive',
    ];

    // Add Wine-specific environment
    if (platform.type === 'wine') {
      // Build WINEDEBUG environment variable from game settings
      const wineDebug = this.buildWineDebug(game);
      
      // Note: WINEARCH should NOT be set for debug containers with existing prefixes
      // Wine will auto-detect the architecture from the existing prefix
      env.push('WINEPREFIX=/wineprefix');
      env.push(`WINEDEBUG=${wineDebug}`);
      
      console.log(`  WINEDEBUG=${wineDebug}`);
    }

    // Setup volume binds
    const binds = [
      `dillinger_root:/data:rw`,
      ...displayConfig.volumes
    ];
    
    if (platform.type === 'wine' && winePrefixPath) {
      binds.push(`${winePrefixPath}:/wineprefix:rw`);
    } else {
      binds.push(`${this.SESSION_VOLUME}:/game:ro`);
    }

    try {
      const containerConfig: any = {
        Image: platform.configuration.containerImage || 'dillinger/runner-linux-native:latest',
        name: `dillinger-debug-${sessionId}`,
        Env: env,
        WorkingDir: platform.type === 'wine' ? '/wineprefix' : '/game',
        Entrypoint: ['/bin/bash', '-c', 'tail -f /dev/null'], // Override entrypoint for debug mode
        HostConfig: {
          AutoRemove: false,
          Binds: binds,
          Devices: displayConfig.devices,
          IpcMode: displayConfig.ipcMode,
          SecurityOpt: displayConfig.securityOpt,
        },
        Tty: true,
        OpenStdin: true,
      };
      
      const container = await docker.createContainer(containerConfig);
      await container.start();
      const info = await container.inspect();

      console.log(`✓ Debug container started: ${container.id}`);
      console.log(`  Container ID: ${info.Id}`);

      // Generate the docker exec command for interactive access
      const execCommand = `docker exec -it ${info.Id.substring(0, 12)} /bin/bash`;

      return {
        containerId: info.Id,
        status: info.State.Status,
        createdAt: info.Created,
        execCommand,
      };
    } catch (error) {
      console.error('Error launching debug container:', error);
      throw new Error(`Failed to launch debug container: ${error}`);
    }
  }

  /**
   * Run registry setup scripts for Wine games
   * Detects .cmd/.bat files with REG ADD commands and converts them to .reg format
   */
  async runRegistrySetup(options: { game: Game; platform: Platform }): Promise<{ success: boolean; message: string }> {
    const { game, platform } = options;

    if (platform.type !== 'wine') {
      return { success: false, message: 'Registry setup is only for Wine games' };
    }

    const gameIdentifier = game.slug || game.id;
    const hostInstallPath = '/mnt/linuxfast/dillinger_installed';
    const winePrefixPath = path.posix.join(
      this.getHostPath(hostInstallPath),
      `.wine-${gameIdentifier}`
    );
    
    // The game files are inside the Wine prefix at drive_c/GOG Games/<game>/
    // We need to extract the game directory from the launch command
    const launchCommand = game.settings?.launch?.command || '';
    const windowsPath = launchCommand.replace(/^[A-Za-z]:/, ''); // Remove C:
    const gameDirPath = path.dirname(windowsPath.replace(/\\/g, '/')); // Get directory
    const gameInstallPath = path.posix.join(winePrefixPath, 'drive_c', gameDirPath.substring(1)); // Remove leading /

    console.log(`Looking for registry files in: ${gameInstallPath}`);

    // Look for registry setup files
    const { readdir, readFile, writeFile } = await import('fs/promises');
    
    try {
      const files = await readdir(gameInstallPath);
      const regSetupFiles = files.filter(f => 
        (f.toLowerCase().endsWith('.cmd') || f.toLowerCase().endsWith('.bat')) &&
        (f.toLowerCase().includes('reg') || f.toLowerCase().includes('setup'))
      );

      if (regSetupFiles.length === 0) {
        return { success: false, message: 'No registry setup files found (looking for .cmd/.bat files with "reg" or "setup" in name)' };
      }

      console.log(`Found registry setup files: ${regSetupFiles.join(', ')}`);

      // Process the first registry file found
      const regFile = regSetupFiles[0];
      if (!regFile) {
        return { success: false, message: 'No registry file found in array' };
      }
      
      const cmdFilePath = path.join(gameInstallPath, regFile);
      const cmdContent = await readFile(cmdFilePath, 'utf-8');

      // Convert CMD format to REG format
      const regContent = this.convertCmdToReg(cmdContent);
      
      // Write the .reg file
      const regFilePath = path.join(gameInstallPath, 'dillinger_setup.reg');
      await writeFile(regFilePath, regContent, 'utf-8');
      
      console.log(`Converted ${regFile} to dillinger_setup.reg`);

      // Run wine regedit in a temporary container
      const displayConfig = await this.getDisplayConfiguration();
      
      // Build WINEDEBUG from game settings (though registry setup usually doesn't need verbose debug)
      const wineDebug = this.buildWineDebug(game);
      
      // Note: WINEARCH should NOT be set when using an existing prefix
      // Wine will auto-detect the architecture from the existing prefix
      const containerConfig: any = {
        Image: platform.configuration.containerImage || 'dillinger/runner-wine:latest',
        Entrypoint: ['/bin/bash', '-c'],
        Cmd: [`cd /game && WINEPREFIX=/wineprefix wine regedit /S dillinger_setup.reg`],
        Env: [
          'WINEPREFIX=/wineprefix',
          `WINEDEBUG=${wineDebug}`,
          ...displayConfig.env,
        ],
        HostConfig: {
          AutoRemove: true,
          Binds: [
            `${winePrefixPath}:/wineprefix:rw`,
            `${gameInstallPath}:/game:ro`,
          ],
          Devices: displayConfig.devices,
        },
        WorkingDir: '/game',
      };

      console.log(`Running: wine regedit /S dillinger_setup.reg (WINEDEBUG=${wineDebug})`);
      
      const container = await docker.createContainer(containerConfig);
      
      await container.start();
      const result = await container.wait();

      if (result.StatusCode === 0) {
        console.log(`✓ Successfully imported registry settings from ${regFile}`);
        return { success: true, message: `Registry settings imported from ${regFile}` };
      } else {
        console.error(`Failed to import registry settings, exit code: ${result.StatusCode}`);
        return { success: false, message: `Failed to import registry settings (exit code: ${result.StatusCode})` };
      }

    } catch (error: any) {
      console.error('Error running registry setup:', error);
      return { success: false, message: `Error: ${error.message}` };
    }
  }

  /**
   * Convert Windows CMD registry script to .reg file format
   */
  private convertCmdToReg(cmdContent: string): string {
    const lines = cmdContent.split('\n');
    let regContent = 'Windows Registry Editor Version 5.00\n\n';
    let currentKey = '';
    
    // Extract regpath variable if defined
    let regpathValue = '';
    for (const line of lines) {
      const regpathMatch = line.match(/SET\s+regpath=["']([^"']+)["']/i);
      if (regpathMatch && regpathMatch[1]) {
        regpathValue = regpathMatch[1];
        break;
      }
    }
    
    console.log(`Found regpath variable: ${regpathValue}`);
    console.log(`Total lines in CMD file: ${lines.length}`);
    
    let processedCount = 0;
    let skippedCount = 0;
    let matchedCount = 0;
    
    for (const line of lines) {
      let trimmed = line.trim();
      
      // Skip empty lines, comments, and SET commands
      if (!trimmed || trimmed.startsWith('::') || trimmed.startsWith('@') || trimmed.startsWith('SET ') || trimmed === 'exit') {
        skippedCount++;
        continue;
      }
      
      processedCount++;
      const originalLine = trimmed;
      
      // Replace %regpath% with actual value
      if (regpathValue) {
        trimmed = trimmed.replace(/%regpath%/gi, `"${regpathValue}"`);
      }
      
      console.log(`[${processedCount}] Original: ${originalLine.substring(0, 80)}`);
      console.log(`[${processedCount}] After replace: ${trimmed.substring(0, 100)}`);
      
      // Parse REG ADD commands - more flexible pattern
      // Matches: REG ADD "path" /v "name" /t TYPE /d "data" /f [/reg:32]
      const regAddMatch = trimmed.match(/REG\s+ADD\s+"([^"]+)"\s+\/v\s+"([^"]+)"\s+\/t\s+(\S+)\s+\/d\s+(.+?)(?:\s+\/f|\s+$)/i);
      
      if (regAddMatch) {
        matchedCount++;
        console.log(`[${processedCount}] MATCHED!`);
        const keyPath = regAddMatch[1];
        const valueName = regAddMatch[2];
        const valueType = regAddMatch[3];
        let valueData = regAddMatch[4]?.trim();
        
        if (!keyPath || !valueName || !valueType || !valueData) {
          console.log(`Skipping line - missing data: ${trimmed}`);
          continue;
        }
        
        // Remove quotes from valueData if present
        if (valueData.startsWith('"') && valueData.includes('"')) {
          valueData = valueData.match(/"([^"]*)"/)?.[1] || valueData;
        }
        
        // Add key header if it changed
        if (keyPath !== currentKey) {
          currentKey = keyPath;
          regContent += `\n[${keyPath}]\n`;
        }
        
        // Convert value based on type
        if (valueType === 'REG_SZ') {
          regContent += `"${valueName}"="${valueData}"\n`;
        } else if (valueType === 'REG_DWORD') {
          const hexValue = parseInt(valueData).toString(16).padStart(8, '0');
          regContent += `"${valueName}"=dword:${hexValue}\n`;
        } else if (valueType === 'REG_BINARY') {
          // Convert binary data (e.g., "01000000" to "01,00,00,00")
          const hexBytes = valueData.match(/.{2}/g)?.join(',') || valueData;
          regContent += `"${valueName}"=hex:${hexBytes}\n`;
        }
      }
    }
    
    console.log(`\n=== CMD Parsing Summary ===`);
    console.log(`Total lines: ${lines.length}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log(`Processed: ${processedCount}`);
    console.log(`Matched: ${matchedCount}`);
    console.log(`===========================\n`);
    
    console.log(`Generated .reg file with ${regContent.split('\n').length} lines`);
    return regContent;
  }

  /**
   * Monitor a game container and notify when it stops
   * This runs asynchronously and updates the session status
   */
  async monitorGameContainer(
    containerId: string, 
    sessionId: string,
    onStop?: (exitCode: number) => void | Promise<void>
  ): Promise<void> {
    try {
      const container = docker.getContainer(containerId);
      
      console.log(`🔍 Monitoring game container: ${containerId.substring(0, 12)}`);
      
      // Wait for container to finish (this blocks until container stops)
      const result = await container.wait();
      
      console.log(`✓ Game container stopped: ${containerId.substring(0, 12)}`);
      console.log(`  Exit code: ${result.StatusCode}`);
      
      // Call the callback if provided
      if (onStop) {
        await onStop(result.StatusCode);
      }
    } catch (error) {
      console.error('Error monitoring game container:', error);
    }
  }

  /**
   * Install a game using Docker with GUI support
   * This runs an installer (exe, msi, etc.) in a containerized environment
   * with X11/Wayland passthrough so the user sees the installation wizard
   */
  async installGame(options: GameInstallOptions): Promise<ContainerInfo> {
    const { installerPath, installPath, platform, sessionId, game } = options;

    // Ensure host path is detected
    await this.detectHostPath();

    console.log(`Installing game with installer: ${installerPath}`);
    console.log(`  Installation target: ${installPath}`);
    console.log(`  Platform: ${platform.name} (${platform.type})`);
    console.log(`  Container Image: ${platform.configuration.containerImage}`);
    console.log(`  Game slug: ${game.slug || game.id}`);

    // Convert paths to host paths if running in devcontainer
    const hostInstallerPath = this.getHostPath(installerPath);
    const hostInstallPath = this.getHostPath(installPath);

    // Get display forwarding configuration
    const displayConfig = await this.getDisplayConfiguration();
    console.log(`  Display mode: ${displayConfig.mode}`);

    // Use game slug (or ID if no slug) for Wine prefix directory
    const gameIdentifier = game.slug || game.id;
    const winePrefixPath = path.posix.join(hostInstallPath, `.wine-${gameIdentifier}`);
    
    console.log(`  Wine prefix: ${winePrefixPath}`);

    // For Wine installations, ensure the Wine prefix directory exists with proper permissions
    // We'll create it with a permissive mode so Wine can use it
    if (platform.type === 'wine') {
      try {
        const fs = await import('fs-extra');
        // Create directory if it doesn't exist
        await fs.ensureDir(winePrefixPath);
        // Set permissions to 777 so Wine user in container can access it
        await fs.chmod(winePrefixPath, 0o777);
        console.log(`  ✓ Wine prefix directory prepared with correct permissions`);
      } catch (error) {
        console.warn(`  ⚠ Could not prepare Wine prefix directory:`, error);
        // Continue anyway - Wine will try to create it
      }
    }

    // Prepare environment variables for installation
    const env = [
      `INSTALLER_PATH=/installer/${path.basename(installerPath)}`,
      `INSTALL_TARGET=/install`,
      ...displayConfig.env
    ];

    // Add Wine-specific configuration for Windows installers
    if (platform.type === 'wine') {
      // Get Wine architecture from game settings (default to win64)
      const wineArch = game.settings?.wine?.arch || 'win64';
      
      // Build WINEDEBUG from game settings (but default to -all for installation)
      // Installation usually works better with minimal logging
      const wineDebug = this.buildWineDebug(game);
      
      env.push(
        `WINEDEBUG=${wineDebug}`, // Use game's debug settings
        `WINEPREFIX=/wineprefix`, // Wine prefix mounted separately
        `WINEARCH=${wineArch}`, // Wine architecture (win32 or win64)
        'DISPLAY_WINEPREFIX=1' // Signal to show Wine configuration if needed
      );
      
      console.log(`  Wine architecture: ${wineArch}`);
      console.log(`  WINEDEBUG=${wineDebug}`);
    }

    try {
      // Create installation container with GUI passthrough
      const container = await docker.createContainer({
        Image: platform.configuration.containerImage || 'dillinger/runner-wine:latest',
        name: `dillinger-install-${sessionId}`,
        Env: env,
        HostConfig: {
          AutoRemove: true, // Auto-remove container when installation completes
          Binds: [
            `${hostInstallerPath}:/installer/${path.basename(installerPath)}:ro`, // Mount installer as read-only
            `${hostInstallPath}:/install:rw`, // Mount installation target as read-write
            `${winePrefixPath}:/wineprefix:rw`, // Game-specific Wine prefix (prevents interference between games)
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
      
      // Note: We don't clean up save volumes here anymore
      // Save volumes are game-based (dillinger_saves_<gameId>) and persist across sessions
      // They should only be deleted when the game itself is deleted
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
  /**
   * Check if a container exists (without throwing errors)
   */
  async containerExists(containerId: string): Promise<boolean> {
    try {
      const container = docker.getContainer(containerId);
      await container.inspect();
      return true;
    } catch (error) {
      return false;
    }
  }

  async getContainerLogs(containerId: string, tail: number = 100): Promise<string> {
    try {
      const container = docker.getContainer(containerId);
      
      // Get logs as buffer (follow: false returns Buffer)
      const logsBuffer = await container.logs({
        stdout: true,
        stderr: true,
        tail,
        timestamps: true,
        follow: false,
      });

      // Docker's multiplexed stream format: 8-byte header per chunk
      // Header: [stream_type, 0, 0, 0, size1, size2, size3, size4]
      // stream_type: 1=stdout, 2=stderr
      const logs: string[] = [];
      let offset = 0;

      while (offset < logsBuffer.length) {
        // Read 8-byte header
        const streamType = logsBuffer[offset];
        const size = logsBuffer.readUInt32BE(offset + 4);
        
        // Read payload
        const payload = logsBuffer.slice(offset + 8, offset + 8 + size).toString('utf8');
        logs.push(payload);
        
        offset += 8 + size;
      }

      // Join and remove duplicates
      const allLines = logs.join('').split('\n').filter(line => line.trim());
      const uniqueLines = Array.from(new Set(allLines));
      return uniqueLines.join('\n');
    } catch (error) {
      // Don't log 404 errors - just rethrow silently
      if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
        throw new Error('Container not found');
      }
      console.error('Error getting container logs:', error);
      throw new Error(`Failed to get container logs: ${error}`);
    }
  }

  /**
   * Get display forwarding configuration based on host environment
   * Supports X11 and Wayland display protocols
   * Prefers X11 when both are available (more compatible with games)
   */
  private async getDisplayConfiguration(): Promise<{
    mode: 'x11' | 'wayland' | 'none';
    env: string[];
    volumes: string[];
    devices: Array<{ PathOnHost: string; PathInContainer: string; CgroupPermissions: string }>;
    ipcMode?: string;
    securityOpt?: string[];
  }> {
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
      
      // Add PulseAudio socket for audio support
      const userHome = process.env.HOME;
      if (xdgRuntimeDir && existsSync(`${xdgRuntimeDir}/pulse`)) {
        volumes.push(`${xdgRuntimeDir}/pulse:/run/user/1000/pulse:rw`);
        console.log(`  ✓ PulseAudio socket available`);
        
        // Mount PulseAudio cookie if it exists
        const pulseCookie = `${userHome}/.config/pulse/cookie`;
        if (existsSync(pulseCookie)) {
          volumes.push(`${pulseCookie}:/home/gameuser/.config/pulse/cookie:ro`);
          console.log(`  ✓ PulseAudio cookie available`);
        }
      } else {
        console.log(`  ⚠ No PulseAudio socket found at ${xdgRuntimeDir}/pulse`);
      }
      
      // Check if GPU device exists
      const devices = [];
      if (existsSync('/dev/dri')) {
        devices.push({ PathOnHost: '/dev/dri', PathInContainer: '/dev/dri', CgroupPermissions: 'rwm' });
        console.log(`  ✓ GPU device available`);
      } else {
        console.log(`  ⚠ No GPU device (/dev/dri not found), software rendering only`);
      }
      
      // Get default PulseAudio sink from settings or environment variable
      // This allows directing audio to a specific output when multiple are available
      const settingsService = SettingsService.getInstance();
      const audioSettings = await settingsService.getAudioSettings();
      const pulseSink = audioSettings.defaultSink || process.env.PULSE_SINK || '';
      
      const envVars = [
        `DISPLAY=${display}`,
        'XAUTHORITY=',  // Disable Xauthority requirement
        'PULSE_SERVER=unix:/run/user/1000/pulse/native',
        'PULSE_COOKIE=/home/gameuser/.config/pulse/cookie',
      ];
      
      if (pulseSink) {
        envVars.push(`PULSE_SINK=${pulseSink}`);
      }
      
      return {
        mode: 'x11',
        env: envVars,
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
   * NOTE: Save volumes are no longer used
   * 
   * Game saves are now stored in dillinger_root at /data/saves/<gameId>
   * This eliminates the need for per-game or per-session save volumes.
   * All save data is centralized in the dillinger_root volume.
   * 
   * Any old dillinger_saves_* volumes can be safely deleted manually.
   */

  /**
   * Get available PulseAudio sinks on the host system
   */
  async getAvailableAudioSinks(): Promise<Array<{ id: string; name: string; description: string }>> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    try {
      // Use pactl to list sinks
      const { stdout } = await execAsync('pactl list sinks');
      
      const sinks: Array<{ id: string; name: string; description: string }> = [];
      const lines = stdout.split('\n');
      
      let currentSink: { id?: string; name?: string; description?: string } = {};
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        // New sink entry starts
        if (trimmed.startsWith('Sink #')) {
          if (currentSink.id && currentSink.name) {
            sinks.push({
              id: currentSink.id,
              name: currentSink.name,
              description: currentSink.description || currentSink.name
            });
          }
          currentSink = {};
        }
        
        // Parse Name field (the actual sink ID we need)
        if (trimmed.startsWith('Name:')) {
          currentSink.id = trimmed.substring(5).trim();
          currentSink.name = currentSink.id; // Fallback if no description
        }
        
        // Parse Description field (human-readable name)
        if (trimmed.startsWith('Description:')) {
          const description = trimmed.substring(12).trim();
          currentSink.description = description;
          currentSink.name = description;
        }
      }
      
      // Add last sink if exists
      if (currentSink.id && currentSink.name) {
        sinks.push({
          id: currentSink.id,
          name: currentSink.name,
          description: currentSink.description || currentSink.name
        });
      }
      
      return sinks;
    } catch (error) {
      console.error('Failed to get audio sinks:', error);
      return [];
    }
  }
}
