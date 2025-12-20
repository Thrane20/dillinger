import Docker from 'dockerode';
import path from 'path';
import { existsSync, statSync } from 'fs';
import type { Game, Platform } from '@dillinger/shared';
import { JSONStorageService } from './storage';
import { SettingsService } from './settings';
import { logger } from './logger';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

export interface GameLaunchOptions {
  game: Game;
  platform: Platform;
  sessionId: string;
  mode?: 'local' | 'streaming'; // Launch mode: local (host display) or streaming (Moonlight/Wolf)
  keepContainer?: boolean; // If true, do not auto-remove container (debugging)
  keepAlive?: boolean; // If true, keep runner alive after failure (debugging)
}

export interface GameInstallOptions {
  installerPath: string; // Absolute path to installer file on host
  installPath: string; // Absolute path to target installation directory
  platform: Platform;
  sessionId: string;
  game: Game; // Game object for slug and other metadata
  installerArgs?: string; // Optional installer arguments
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
  private installVolumeHostPath: string | null = null;
  private mounts: any[] = []; // Store all mounts for path translation

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
   * Get the host path for the dillinger_installed volume
   * This is needed for mounting subdirectories (Wine prefixes)
   */
  private async getInstallVolumeHostPath(): Promise<string> {
    if (this.installVolumeHostPath) {
      return this.installVolumeHostPath;
    }

    // Try env var first
    if (process.env.DILLINGER_INSTALLED_HOST_PATH) {
      this.installVolumeHostPath = process.env.DILLINGER_INSTALLED_HOST_PATH;
      logger.info(`Using configured install volume path: ${this.installVolumeHostPath}`);
      return this.installVolumeHostPath;
    }

    // Try to inspect the volume
    try {
      const volume = docker.getVolume('dillinger_installed');
      const info = await volume.inspect();
      if (info.Mountpoint) {
        this.installVolumeHostPath = info.Mountpoint;
        logger.info(`Detected dillinger_installed volume at: ${this.installVolumeHostPath}`);
        return this.installVolumeHostPath;
      }
    } catch (err) {
      // Volume might not exist or other error
      logger.warn('Could not inspect dillinger_installed volume, falling back to default path');
    }

    // Fallback to default
    this.installVolumeHostPath = '/mnt/linuxfast/dillinger_installed';
    logger.info(`Using default install volume path: ${this.installVolumeHostPath}`);
    return this.installVolumeHostPath;
  }

  /**
   * Check if a path exists inside the `dillinger_installed` Docker volume.
   * This avoids relying on host access to `/var/lib/docker/volumes/...`.
   */
  private async installedVolumePathExists(containerPathUnderInstalled: string): Promise<boolean> {
    const clean = containerPathUnderInstalled.replace(/^\/+/, '');
    const full = path.posix.join('/installed', clean);

    // Use a tiny container to test for existence.
    // We keep it minimal and non-interactive.
    try {
      const container = await docker.createContainer({
        Image: 'alpine:3.20',
        Cmd: ['sh', '-lc', `[ -e "${full}" ]`],
        HostConfig: {
          AutoRemove: true,
          Binds: ['dillinger_installed:/installed:ro'],
        },
      } as any);

      await container.start();
      const wait = await container.wait();
      return wait.StatusCode === 0;
    } catch (error) {
      logger.warn(`installedVolumePathExists check failed for ${full}:`, error);
      return false;
    }
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
      logger.info(`✓ Using HOST_WORKSPACE_PATH from env: ${this.workspaceHostPath}`);
      return;
    }
    
    try {
      // Get the hostname (container ID)
      const os = await import('os');
      const hostname = os.hostname();
      
      logger.info(`Detecting host path for container: ${hostname}`);
      
      // Inspect the current container to find the workspace mount
      const container = docker.getContainer(hostname);
      const info = await container.inspect();
      
      this.mounts = info.Mounts || []; // Store mounts for general translation
      logger.info(`Found ${info.Mounts?.length || 0} mounts in container`);
      
      // Find the mount for /workspaces/dillinger
      const workspaceMount = info.Mounts?.find((mount: any) => 
        mount.Destination === '/workspaces/dillinger'
      );
      
      if (workspaceMount) {
        this.workspaceHostPath = workspaceMount.Source;
        logger.info(`✓ Detected host workspace path: ${this.workspaceHostPath}`);
      } else {
        this.workspaceHostPath = ''; // Mark as checked but not found
        logger.warn('⚠ Not running in devcontainer, using container paths directly');
        logger.info('Available mounts: ' + info.Mounts?.map((m: any) => m.Destination).join(', '));
      }
    } catch (error: any) {
      // Not running in a container or can't detect - use paths as-is
      this.workspaceHostPath = ''; // Mark as checked but not found
      logger.warn('⚠ Could not detect host path, using container paths');
      logger.error('Error details: ' + error.message);
      logger.info('💡 Tip: Set HOST_WORKSPACE_PATH environment variable to override');
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
      logger.debug(`  Path translation: ${containerPath} -> ${hostPath}`);
      return hostPath;
    }

    // General path translation based on detected mounts
    if (this.mounts && this.mounts.length > 0) {
      // Sort mounts by destination length (descending) to match longest prefix first
      const sortedMounts = [...this.mounts].sort((a, b) => b.Destination.length - a.Destination.length);
      
      for (const mount of sortedMounts) {
        // Check if container path starts with mount destination
        // Ensure we match directory boundaries (e.g. /data matches /data/foo but not /database)
        if (containerPath === mount.Destination || containerPath.startsWith(mount.Destination + '/')) {
          const relativePath = containerPath.substring(mount.Destination.length);
          // If it's a named volume, we can't easily map it to a host path unless we know where volumes are stored
          // But if Source is a path (bind mount), we can use it
          if (mount.Type === 'bind' || mount.Source.startsWith('/')) {
             const hostPath = mount.Source + relativePath;
             logger.debug(`  Path translation (mount): ${containerPath} -> ${hostPath}`);
             return hostPath;
          }
        }
      }
    }

    return containerPath;
  }

  /**
   * Normalize a user-configured install path (often under the public install root)
   * to the actual host path of the `dillinger_installed` Docker volume.
   *
   * In some environments the UI stores install paths like:
   *   /mnt/linuxfast/dillinger_installed/<game>
   * while Docker bind mounts must use the volume host root:
   *   /var/lib/docker/volumes/dillinger_installed/_data/<game>
   */
  private async normalizeInstalledPath(maybePublicPath: string): Promise<string> {
    await this.detectHostPath();

    const installVolumeHostRoot = this.getHostPath(await this.getInstallVolumeHostPath());
    const containerInstalledRoot = '/installed';
    const defaultPublicRoot = '/mnt/linuxfast/dillinger_installed';
    const publicRoot = process.env.DILLINGER_INSTALLED_PUBLIC_PATH || defaultPublicRoot;

    // If the path is already inside the volume host root, keep it.
    if (maybePublicPath === installVolumeHostRoot || maybePublicPath.startsWith(installVolumeHostRoot + '/')) {
      return maybePublicPath;
    }

    // Canonical (Option A): user stores container paths under /installed
    if (maybePublicPath === containerInstalledRoot || maybePublicPath.startsWith(containerInstalledRoot + '/')) {
      const rel = maybePublicPath.substring(containerInstalledRoot.length);
      return installVolumeHostRoot + rel;
    }

    // If the path is under the public root, map it to the volume host root.
    if (maybePublicPath === publicRoot || maybePublicPath.startsWith(publicRoot + '/')) {
      const rel = maybePublicPath.substring(publicRoot.length);
      // rel includes leading '/', which is what we want.
      return installVolumeHostRoot + rel;
    }

    // Otherwise, attempt generic container->host translation (devcontainer mounts etc.)
    return this.getHostPath(maybePublicPath);
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

    logger.info(`Setting session volume to: ${absoluteGamePath}`);
    if (hostGamePath !== absoluteGamePath) {
      logger.info(`  Host path: ${hostGamePath}`);
    }

    try {
      // Check if volume exists
      const volume = docker.getVolume(this.SESSION_VOLUME);
      try {
        await volume.inspect();
        // Volume exists, remove it first
        logger.info(`Removing existing ${this.SESSION_VOLUME} volume`);
        
        try {
          await volume.remove();
        } catch (removeErr: any) {
          if (removeErr.statusCode === 409) {
            // Volume is in use, find and remove containers using it
            logger.info(`Volume in use, cleaning up containers...`);
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
      logger.info(`Creating ${this.SESSION_VOLUME} volume bound to ${hostGamePath}`);
      await docker.createVolume({
        Name: this.SESSION_VOLUME,
        Driver: 'local',
        DriverOpts: {
          type: 'none',
          device: hostGamePath,
          o: 'bind'
        }
      });

      logger.info(`✓ Session volume configured for ${gamePath}`);
    } catch (error) {
      logger.error('Error setting session volume:', error);
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

    logger.info(`Setting session volume to absolute path: ${absolutePath}`);
    if (hostPath !== absolutePath) {
      logger.info(`  Host path: ${hostPath}`);
    }

    try {
      // Check if volume exists
      const volume = docker.getVolume(this.SESSION_VOLUME);
      try {
        await volume.inspect();
        // Volume exists, remove it first
        logger.info(`Removing existing ${this.SESSION_VOLUME} volume`);
        
        try {
          await volume.remove();
        } catch (removeErr: any) {
          if (removeErr.statusCode === 409) {
            // Volume is in use, find and remove containers using it
            logger.info(`Volume in use, cleaning up containers...`);
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
      logger.info(`Creating ${this.SESSION_VOLUME} volume bound to ${hostPath}`);
      await docker.createVolume({
        Name: this.SESSION_VOLUME,
        Driver: 'local',
        DriverOpts: {
          type: 'none',
          device: hostPath,
          o: 'bind'
        }
      });

      logger.info(`✓ Session volume configured for ${absolutePath}`);
    } catch (error) {
      logger.error('Error setting session volume:', error);
      throw new Error(`Failed to configure session volume: ${error}`);
    }
  }

  /**
   * Launch a game in a Docker container
   */
  async launchGame(options: GameLaunchOptions): Promise<ContainerInfo> {
    const { game, platform, sessionId, mode = 'local' } = options;

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
    
    // Map platform IDs to VICE emulator commands
    const viceEmulators: Record<string, string> = {
      'c64': 'x64sc',           // Commodore 64 (accurate)
      'c128': 'x128',           // Commodore 128
      'vic20': 'xvic',          // VIC-20
      'plus4': 'xplus4',        // Plus/4
      'pet': 'xpet'             // PET
    };

    // Map platform IDs to Amiga emulator commands
    const amigaEmulators: Record<string, string> = {
      'amiga': 'fs-uae',        // Amiga (A500 default)
      'amiga500': 'fs-uae',     // Amiga 500
      'amiga500plus': 'fs-uae', // Amiga 500+
      'amiga600': 'fs-uae',     // Amiga 600
      'amiga1200': 'fs-uae',    // Amiga 1200
      'amiga3000': 'fs-uae',    // Amiga 3000
      'amiga4000': 'fs-uae',    // Amiga 4000
      'cd32': 'fs-uae'          // Amiga CD32
    };

    // Map platform IDs to MAME emulator commands
    const mameEmulators: Record<string, string> = {
      'mame': 'mame',
      // 'arcade': 'mame' // Removed arcade from here as it's now handled by RetroArch runner
    };
    
    if (platform.type === 'wine') {
      // For Wine games, we pass a container path executable via env (GAME_EXECUTABLE)
      // and let the runner use WINEPREFIX (also set via env). This avoids hardcoding
      // legacy /wineprefix paths now that prefixes live under /installed.

      // Prepare clean arguments
      const cleanArgs = launchArgs
        .filter(arg => arg && typeof arg === 'string')
        .map(arg => arg.replace(/\0/g, ''))
        .filter(arg => arg !== ''); // Remove empty strings

      // Resolve Windows-style command into a path under the mounted prefix.
      // This will later be rewritten from `/wineprefix/...` to `/installed/...`.
      let linuxPath = launchCommand.replace(/^[A-Za-z]:/, '');
      linuxPath = linuxPath.replace(/\\/g, '/');
      gameExecutable = path.posix.join('/wineprefix/drive_c', linuxPath);

      // Note: Docker's `Cmd` does not perform shell expansion, so passing
      // `$GAME_EXECUTABLE` would be treated as a literal filename. Use a shell
      // wrapper so the variable expands at runtime.
      const escapedArgs = cleanArgs.map((a) => a.replace(/"/g, '\\"'));
      const argsJoined = escapedArgs.map((a) => `"${a}"`).join(' ');

      // If keepAlive is enabled, ensure the container stays running after Wine exits
      // so the user can `docker exec` and inspect files/logs.
      const keepAliveSuffix = options.keepAlive === true
        ? ' ; EXIT_CODE=$? ; echo "[dillinger] wine exited with code: ${EXIT_CODE}" ; tail -f /dev/null'
        : '';

      cmdArray = ['bash', '-lc', `wine "${'${GAME_EXECUTABLE}'}"${argsJoined ? ` ${argsJoined}` : ''}${keepAliveSuffix}`];
      // Set working directory to the executable directory.
      // Some Windows games rely on relative paths to DLLs/data next to the EXE.
      // Note: GAME_EXECUTABLE will be rewritten from /wineprefix/... to /installed/... later,
      // so we use the expected rewritten path when computing the working directory.
      const expectedPrefixRoot = `/installed/${game.id}/wineprefix-${game.id}`;
      const expectedExecutable = gameExecutable.startsWith('/wineprefix/')
        ? `${expectedPrefixRoot}${gameExecutable.substring('/wineprefix'.length)}`
        : gameExecutable;
      containerWorkingDir = path.posix.dirname(expectedExecutable);

      logger.info(`Launching game: ${game.title}`);
      logger.info(`  Container Image: ${platform.configuration.containerImage}`);
      logger.info(`  Original Windows path: ${launchCommand}`);
      logger.info(`  Wine command (template): ${cmdArray.join(' ')}`);
      logger.info(`  Working directory: ${containerWorkingDir}`);
    } else if (platform.configuration.containerImage?.includes('runner-retroarch')) {
      // For RetroArch games
      const core = game.settings?.emulator?.core || platform.configuration.defaultSettings?.emulator?.core || 'mame';
      
      const romPath = game.filePath;
      
      if (romPath === 'MENU') {
        // Launch into menu without a ROM
        // Do NOT set RETROARCH_CORE to avoid pre-loading a core
        gameExecutable = 'retroarch';
        cmdArray = [];
        containerWorkingDir = '/home/gameuser';
        logger.info(`Launching RetroArch Menu (Setup Mode)`);
      } else {
        // Set RETROARCH_CORE env var for normal games
        environment['RETROARCH_CORE'] = core;

        if (!romPath) {
          throw new Error('No ROM file specified for RetroArch game');
        }
        
        // The ROM file is mounted into /roms inside the container
        const romFilename = path.basename(romPath);
        
        // Command is just the ROM path (entrypoint handles the rest)
        gameExecutable = 'retroarch'; // Just for logging
        cmdArray = [`/roms/${romFilename}`];
        containerWorkingDir = '/home/gameuser';
        
        logger.info(`Launching RetroArch game: ${game.title}`);
        logger.info(`  Container Image: ${platform.configuration.containerImage}`);
        logger.info(`  Core: ${core}`);
        logger.info(`  ROM file: ${romPath}`);
      }
    } else if (game.platformId && viceEmulators[game.platformId]) {
      // For Commodore emulator games (C64, C128, VIC-20, Plus/4, PET)
      const emulatorCmd = viceEmulators[game.platformId];
      
      if (!emulatorCmd) {
        throw new Error(`Unknown Commodore platform: ${game.platformId}`);
      }
      
      const romPath = game.filePath; // Path to ROM file (.d64, .crt, .t64, etc.)
      
      if (!romPath) {
        throw new Error('No ROM file specified for Commodore game');
      }
      
      // VICE emulator command: x64sc /roms/game.d64
      // The ROM file is mounted into /roms inside the container
      const romFilename = path.basename(romPath);
      gameExecutable = emulatorCmd;
      cmdArray = [emulatorCmd, `/roms/${romFilename}`];
      containerWorkingDir = '/home/gameuser';
      
      logger.info(`Launching Commodore game: ${game.title}`);
      logger.info(`  Container Image: ${platform.configuration.containerImage}`);
      logger.info(`  Emulator: ${emulatorCmd}`);
      logger.info(`  ROM file: ${romPath}`);
      logger.info(`  Command: ${cmdArray.join(' ')}`);
    } else if (game.platformId && amigaEmulators[game.platformId]) {
      // For Amiga emulator games
      const emulatorCmd = amigaEmulators[game.platformId];
      
      if (!emulatorCmd) {
        throw new Error(`Unknown Amiga platform: ${game.platformId}`);
      }
      
      const romPath = game.filePath; // Path to ROM file (.adf, .lha, etc.)
      
      if (!romPath) {
        throw new Error('No ROM file specified for Amiga game');
      }
      
      // FS-UAE emulator command: fs-uae /roms/game.adf
      // The ROM file is mounted into /roms inside the container
      const romFilename = path.basename(romPath);
      gameExecutable = emulatorCmd;
      cmdArray = [emulatorCmd, `/roms/${romFilename}`];
      containerWorkingDir = '/home/gameuser';
      
      // Determine Amiga model from platform ID
      let amigaModel = 'A500'; // Default
      switch (game.platformId) {
        case 'amiga500': amigaModel = 'A500'; break;
        case 'amiga500plus': amigaModel = 'A500+'; break;
        case 'amiga600': amigaModel = 'A600'; break;
        case 'amiga1200': amigaModel = 'A1200'; break;
        case 'amiga3000': amigaModel = 'A3000'; break;
        case 'amiga4000': amigaModel = 'A4000'; break;
        case 'cd32': amigaModel = 'CD32'; break;
      }
      
      // Add model to environment variables
      // This will be picked up by the entrypoint script to generate Default.fs-uae
      // Note: We add it to the environment map so it gets included in the env array later
      environment['FSUAE_AMIGA_MODEL'] = amigaModel;
      
      logger.info(`Launching Amiga game: ${game.title}`);
      logger.info(`  Platform ID: ${game.platformId}`);
      logger.info(`  Amiga Model: ${amigaModel}`);
      logger.info(`  Container Image: ${platform.configuration.containerImage}`);
      logger.info(`  Emulator: ${emulatorCmd}`);
      logger.info(`  Model: ${amigaModel}`);
      logger.info(`  ROM file: ${romPath}`);
      logger.info(`  Command: ${cmdArray.join(' ')}`);
    } else if (game.platformId && mameEmulators[game.platformId]) {
      // For MAME Arcade games
      const emulatorCmd = mameEmulators[game.platformId];
      
      if (!emulatorCmd) {
        throw new Error(`Unknown MAME platform: ${game.platformId}`);
      }
      
      const romPath = game.filePath; // Path to ROM zip file
      
      if (!romPath) {
        throw new Error('No ROM file specified for MAME game');
      }
      
      // MAME expects the driver name (filename without extension)
      // The ROM directory is mounted to /roms
      const romFilename = path.basename(romPath);
      const driverName = romFilename.replace(/\.[^/.]+$/, ""); // Remove extension
      
      gameExecutable = emulatorCmd;
      // Pass driver name to MAME
      // MAME will look for the zip file in the configured rompath (/roms)
      cmdArray = [emulatorCmd, driverName];
      containerWorkingDir = '/home/gameuser';
      
      logger.info(`Launching MAME game: ${game.title}`);
      logger.info(`  Container Image: ${platform.configuration.containerImage}`);
      logger.info(`  Emulator: ${emulatorCmd}`);
      logger.info(`  Driver: ${driverName}`);
      logger.info(`  ROM file: ${romPath}`);
      logger.info(`  Command: ${cmdArray.join(' ')}`);
    } else {
      // For native Linux games, construct the path normally
      gameExecutable = path.posix.join('/game', launchCommand);
      
      const cleanArgs = launchArgs
        .filter(arg => arg && typeof arg === 'string')
        .map(arg => arg.replace(/\0/g, ''));
      
      cmdArray = [gameExecutable, ...cleanArgs];
      containerWorkingDir = '/game';
      
      logger.info(`Launching game: ${game.title}`);
      logger.info(`  Container Image: ${platform.configuration.containerImage}`);
      logger.info(`  Executable: ${gameExecutable}`);
      logger.info(`  Arguments: ${cleanArgs.join(' ') || '(none)'}`);
      logger.info(`  Working directory: ${containerWorkingDir}`);
    }

    // Prepare environment variables
    const env = [
      `GAME_ID=${game.id}`,
      `SESSION_ID=${sessionId}`,
      `SAVES_PATH=/data/saves/${game.id}`, // Game-specific saves directory in dillinger_root
      `ENABLE_MOONLIGHT=${mode === 'streaming' ? 'true' : 'false'}`, // Enable Moonlight/Wolf streaming mode
      ...Object.entries(environment).map(([key, value]) => `${key}=${value}`)
    ];

    // Inject Joystick Configuration
    try {
      const settingsService = SettingsService.getInstance();
      const joystickSettings = await settingsService.getJoystickSettings();
      
      // Determine platform category for joystick mapping
      let joystickPlatform = 'default';
      const platformType = platform.type as string;
      
      if (platformType === 'arcade' || game.platformId === 'mame' || game.platformId === 'arcade' || platform.configuration.containerImage?.includes('retroarch')) {
        joystickPlatform = 'arcade';
      } else if (platformType === 'console' || ['nes', 'snes', 'genesis', 'psx', 'n64'].includes(game.platformId || '')) {
        joystickPlatform = 'console';
      } else if (platformType === 'computer' || ['c64', 'amiga', 'dos', 'pc'].includes(game.platformId || '')) {
        joystickPlatform = 'computer';
      }

      // Check for specific platform config first, then fallback to category
      const joystickConfig = joystickSettings[game.platformId || ''] || joystickSettings[joystickPlatform];
      
      if (joystickConfig) {
        env.push(`JOYSTICK_DEVICE_ID=${joystickConfig.deviceId}`);
        env.push(`JOYSTICK_DEVICE_NAME=${joystickConfig.deviceName}`);
        logger.info(`  Joystick configured: ${joystickConfig.deviceName} (${joystickConfig.deviceId})`);
      }
    } catch (err) {
      logger.warn('Failed to inject joystick configuration:', err);
    }

    // Pass PUID/PGID to runner if set in environment
    if (process.env.PUID) env.push(`PUID=${process.env.PUID}`);
    if (process.env.PGID) env.push(`PGID=${process.env.PGID}`);

    // Pass global GPU selection to runner (base entrypoint consumes GPU_VENDOR)
    try {
      const settingsService = SettingsService.getInstance();
      const gpuSettings = await settingsService.getGpuSettings();
      if (gpuSettings?.vendor) {
        env.push(`GPU_VENDOR=${gpuSettings.vendor}`);
        logger.info(`  GPU vendor preference: ${gpuSettings.vendor}`);
      }
    } catch (err) {
      logger.warn('Failed to load GPU settings:', err);
    }

    // Add Wine-specific configuration
    const wineConfig = game.settings?.wine;
    if (wineConfig?.useDxvk) {
      env.push('INSTALL_DXVK=true');
      // Enable DXVK HUD for verification (shows GPU info, driver, FPS)
      env.push('DXVK_HUD=devinfo,fps');
      logger.info(`  DXVK enabled (DirectX to Vulkan translation)`);
    }

    // Add Wine DLL overrides if configured
    if (wineConfig?.dlls && Object.keys(wineConfig.dlls).length > 0) {
      const dllOverrides = Object.entries(wineConfig.dlls)
        .map(([dll, mode]) => `${dll}=${mode}`)
        .join(';');
      env.push(`WINE_DLL_OVERRIDES=${dllOverrides}`);
      logger.info(`  Wine DLL overrides: ${dllOverrides}`);
    }

    // Add Wine compatibility mode if configured
    if (wineConfig?.compatibilityMode && wineConfig.compatibilityMode !== 'none') {
      env.push(`WINE_COMPAT_MODE=${wineConfig.compatibilityMode}`);
      logger.info(`  Wine compatibility mode: ${wineConfig.compatibilityMode}`);
    }

    // Add Gamescope configuration if enabled
    const gamescopeConfig = game.settings?.gamescope;
    if (gamescopeConfig?.enabled) {
      env.push(
        'USE_GAMESCOPE=true',
        `GAMESCOPE_WIDTH=${gamescopeConfig.width || 1920}`,
        `GAMESCOPE_HEIGHT=${gamescopeConfig.height || 1080}`,
        `GAMESCOPE_REFRESH=${gamescopeConfig.refreshRate || 60}`,
        `GAMESCOPE_FULLSCREEN=${gamescopeConfig.fullscreen ? 'true' : 'false'}`,
        `GAMESCOPE_UPSCALER=${gamescopeConfig.upscaler || 'auto'}`
      );
      
      if (gamescopeConfig.inputWidth && gamescopeConfig.inputHeight) {
        env.push(
          `GAMESCOPE_INPUT_WIDTH=${gamescopeConfig.inputWidth}`,
          `GAMESCOPE_INPUT_HEIGHT=${gamescopeConfig.inputHeight}`
        );
      }
      
      if (gamescopeConfig.limitFps) {
        env.push(`GAMESCOPE_FPS_LIMIT=${gamescopeConfig.limitFps}`);
      }
      
      logger.info(`  Gamescope enabled: ${gamescopeConfig.width}x${gamescopeConfig.height}@${gamescopeConfig.refreshRate}Hz`);
      logger.info(`  Gamescope upscaler: ${gamescopeConfig.upscaler || 'auto'}`);
    }

    // Add MangoHUD configuration if enabled
    const mangoHudConfig = game.settings?.mangohud;
    if (mangoHudConfig?.enabled) {
      env.push('ENABLE_MANGOHUD=true');
      logger.info(`  MangoHUD overlay enabled`);
    }

    // Add Moonlight streaming configuration if enabled
    const moonlightConfig = game.settings?.moonlight;
    if (moonlightConfig?.enabled) {
      env.push('ENABLE_MOONLIGHT=true');
      
      // Set quality preset or custom bitrate
      if (moonlightConfig.bitrate) {
        env.push(`MOONLIGHT_BITRATE=${moonlightConfig.bitrate * 1000}`); // Convert Mbps to Kbps
      } else {
        const qualityPreset = moonlightConfig.quality || 'high';
        env.push(`MOONLIGHT_QUALITY=${qualityPreset}`);
      }
      
      if (moonlightConfig.framerate) {
        env.push(`MOONLIGHT_FPS=${moonlightConfig.framerate}`);
      }
      
      if (moonlightConfig.resolution) {
        env.push(`MOONLIGHT_RESOLUTION=${moonlightConfig.resolution}`);
      }
      
      if (moonlightConfig.codec) {
        env.push(`MOONLIGHT_CODEC=${moonlightConfig.codec}`);
      }
      
      if (moonlightConfig.audioCodec) {
        env.push(`MOONLIGHT_AUDIO_CODEC=${moonlightConfig.audioCodec}`);
      }
      
      logger.info(`  Moonlight streaming enabled`);
      logger.info(`  Moonlight quality: ${moonlightConfig.quality || 'custom'}`);
      if (moonlightConfig.bitrate) {
        logger.info(`  Moonlight bitrate: ${moonlightConfig.bitrate}Mbps`);
      }
    }

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
      // const fullscreen = game.settings?.launch?.fullscreen || false; // TODO: implement fullscreen mode
      const resolution = game.settings?.launch?.resolution || '1920x1080';
      const useXrandr = game.settings?.launch?.useXrandr || false;
      const xrandrMode = game.settings?.launch?.xrandrMode || resolution;
      
      // Note: WINEARCH should NOT be set when launching with an existing prefix
      // Wine will auto-detect the architecture from the existing prefix
      // Setting it causes "not supported in wow64 mode" errors
      //
      // IMPORTANT: `gameExecutable` is set earlier in launchGame(). Use it as-is.
      // Do NOT overwrite it with a placeholder string.
      env.push(
        `WINEDEBUG=${wineDebug}`,
        'WINEPREFIX=/wineprefix',
        `GAME_EXECUTABLE=${gameExecutable}`,
        `GAME_ARGS=${cleanArgs}`
      );

      // Allow per-game selection of D3D renderer (Wine runner consumes WINE_D3D_RENDERER)
      const renderer = game.settings?.wine?.renderer;
      if (renderer === 'vulkan' || renderer === 'opengl') {
        env.push(`WINE_D3D_RENDERER=${renderer}`);
        logger.info(`  Wine renderer: ${renderer}`);
      }

      if (options.keepAlive === true) {
        env.push('KEEP_ALIVE=true');
        logger.info('  KEEP_ALIVE enabled for Wine runner');
      }
      
      // Note: Wine virtual desktop disabled due to input handling issues
      // Users should enable gamescope for fullscreen support instead
      
      // Add xrandr resolution setting if requested
      if (useXrandr) {
        env.push(`XRANDR_MODE=${xrandrMode}`);
        logger.info(`  xrandr mode will be set to: ${xrandrMode}`);
      }
      
      logger.info(`  WINEDEBUG=${wineDebug}`);
      logger.info(`  GAME_EXECUTABLE=${gameExecutable}`);
      logger.info(`  GAME_ARGS=${cleanArgs || '(none)'}`);
    }

    // Get display forwarding configuration
    const displayConfig = await this.getDisplayConfiguration();
    env.push(...displayConfig.env);
    
    logger.info(`  Display mode: ${displayConfig.mode}`);
    logger.info(`  WINEPREFIX will be set to: /wineprefix`);
    
    // Determine Wine prefix path if this is a Wine game
    // Wine prefix layout:
    // - Preferred (current installer flow): <installation.installPath>/wineprefix-<slug>
    // - Legacy fallback: <dillinger_installed volume root>/wineprefix-<slug>
    const gameIdentifier = game.slug || game.id;
    let winePrefixPath: string | null = null;
    let emulatorHomePath: string | null = null;
    
    if (platform.type === 'wine') {
      // fs-extra is imported dynamically but not used directly here
      // The volume existence checking happens via Docker

      // IMPORTANT: the backend process may not have permission to read
      // `/var/lib/docker/volumes/...` on the host, even though Docker itself can.
      // So we probe for existence *inside the dillinger_installed volume*.

      const configuredInstallPath = game.installation?.installPath;

      const candidates: string[] = [];
      // Prefer per-game directory (Option A): /installed/<gameId>/wineprefix-<gameId>
      candidates.push(path.posix.join(gameIdentifier, `wineprefix-${gameIdentifier}`));
      // Legacy root prefix: /installed/wineprefix-<gameId>
      candidates.push(`wineprefix-${gameIdentifier}`);

      // If installPath is /installed/<something>, try that too.
      if (configuredInstallPath && configuredInstallPath.startsWith('/installed/')) {
        const rel = configuredInstallPath.replace(/^\/installed\//, '');
        if (rel) {
          candidates.unshift(path.posix.join(rel, `wineprefix-${gameIdentifier}`));
        }
      }

      // Deduplicate
      const seen = new Set<string>();
      const uniqueCandidates = candidates.filter((p) => {
        if (seen.has(p)) return false;
        seen.add(p);
        return true;
      });

      for (const relCandidate of uniqueCandidates) {
        if (await this.installedVolumePathExists(relCandidate)) {
          winePrefixPath = path.posix.join('/installed', relCandidate);
          logger.info(`  Wine prefix (installed volume): ${winePrefixPath}`);
          break;
        }
      }

      if (!winePrefixPath) {
        logger.warn(`  ⚠ No Wine prefix found in installed volume for game: ${gameIdentifier}`);
        logger.warn(`    installPath: ${configuredInstallPath || '(none)'}`);
        logger.warn(`    Probed container paths:`);
        for (const p of uniqueCandidates) {
          logger.warn(`      - /installed/${p}`);
        }
      }
    } else if ((game.platformId && (viceEmulators[game.platformId] || amigaEmulators[game.platformId] || mameEmulators[game.platformId])) || platform.configuration.containerImage?.includes('runner-retroarch')) {
      // For emulator games (VICE Commodore, FS-UAE Amiga, MAME, or RetroArch), create a per-game home directory
      // This allows each game to have its own emulator config, saves, screenshots, etc.
      const dillingerRoot = this.storage.getDillingerRoot();
      const emulatorHomeDir = path.join(dillingerRoot, 'emulator-homes', gameIdentifier);
      emulatorHomePath = this.getHostPath(emulatorHomeDir);
      
      // Ensure the directory exists with proper permissions
      try {
        const fs = await import('fs-extra');
        const { chmod } = await import('fs/promises');
        
        // Create parent directory first if it doesn't exist
        const parentDir = path.dirname(emulatorHomePath);
        await fs.ensureDir(parentDir);
        
        // Create the game-specific directory
        await fs.ensureDir(emulatorHomePath);
        
        // Pre-create .config/pulse directory for PulseAudio
        // This prevents Docker from creating it as root when mounting pulse/cookie
        const pulseDir = path.join(emulatorHomePath, '.config', 'pulse');
        await fs.ensureDir(pulseDir);

        // Pre-create .cache directory for applications that expect it (like VICE)
        const cacheDir = path.join(emulatorHomePath, '.cache');
        await fs.ensureDir(cacheDir);
        
        // Set permissions so the container user can write to it
        // Use 777 to ensure the container user (uid 1000) can write even if created by root
        await chmod(emulatorHomePath, 0o777);
        await chmod(path.join(emulatorHomePath, '.config'), 0o777);
        await chmod(pulseDir, 0o777);
        await chmod(cacheDir, 0o777);
        logger.info(`  Emulator home directory: ${emulatorHomePath}`);

        // --- MASTER CONFIG INJECTION ---
        // Check if this is an Arcade/RetroArch game and if we need to inject the master config
        const platformType = platform.type as string;
        if (platformType === 'arcade' || game.platformId === 'mame' || game.platformId === 'arcade' || platform.configuration.containerImage?.includes('retroarch')) {
          const retroArchConfigPath = path.join(emulatorHomePath, '.config', 'retroarch', 'retroarch.cfg');
          
          // If config doesn't exist, try to copy from master
          if (!await fs.pathExists(retroArchConfigPath)) {
            const masterConfigPath = path.join(dillingerRoot, 'storage', 'platform-configs', 'arcade', 'retroarch.cfg');
            
            if (await fs.pathExists(masterConfigPath)) {
              logger.info(`  Injecting Master Arcade Config from: ${masterConfigPath}`);
              await fs.ensureDir(path.dirname(retroArchConfigPath));
              await fs.copy(masterConfigPath, retroArchConfigPath);
              await chmod(retroArchConfigPath, 0o666); // Ensure writable
            } else {
              logger.warn(`  Master Arcade Config not found at: ${masterConfigPath}`);
            }
          } else {
             logger.info(`  Using existing game-specific config: ${retroArchConfigPath}`);
          }
        }
        // -------------------------------

      } catch (error: any) {
        logger.error(`  ✗ Failed to create emulator home directory: ${error.message}`);
        logger.error(`    Path: ${emulatorHomePath}`);
        logger.error(`    Error code: ${error.code}`);
        // Don't mount if we can't create the directory
        emulatorHomePath = null;
      }
    }

    // Build volume binds
    const binds = [
      `dillinger_root:/data:rw`, // Mount dillinger_root volume for saves/state
      `dillinger_installers:/installers:rw`, // Helper volume for finding installers
      `dillinger_installed:/installed:rw`, // Points to where games are installed
    ];
    
    // For Wine games, mount the Wine prefix
    if (platform.type === 'wine' && winePrefixPath) {
      // Rewrite WINEPREFIX and GAME_EXECUTABLE to point at the prefix path inside /installed.
      for (let i = 0; i < env.length; i++) {
        const entry = env[i];
        if (!entry) continue;

        if (entry.startsWith('WINEPREFIX=')) {
          env[i] = `WINEPREFIX=${winePrefixPath}`;
          continue;
        }
        if (entry.startsWith('GAME_EXECUTABLE=/wineprefix/')) {
          const rel = entry.substring('GAME_EXECUTABLE=/wineprefix'.length);
          env[i] = `GAME_EXECUTABLE=${winePrefixPath}${rel}`;
        }
      }

      // Preflight: ensure the target executable exists within the selected prefix.
      // This avoids launching with the wrong prefix and getting a vague Wine error.
      try {
        const maybeGameExecutable = env.find((e) => e.startsWith('GAME_EXECUTABLE='));
        if (maybeGameExecutable) {
          const gameExecutable = maybeGameExecutable.substring('GAME_EXECUTABLE='.length);
          // Existence check inside installed volume using helper.
          if (gameExecutable.startsWith('/installed/')) {
            const relUnderInstalled = gameExecutable.substring('/installed/'.length);
            if (!(await this.installedVolumePathExists(relUnderInstalled))) {
              logger.error(`  ✗ Executable not found inside installed volume prefix:`);
              logger.error(`    GAME_EXECUTABLE: ${gameExecutable}`);
              throw new Error('Executable not found in Wine prefix (prefix is likely wrong or install is incomplete)');
            }
          }
        }
      } catch (err) {
        // Re-throw so launch fails fast with a useful message.
        throw err;
      }

      // Do NOT bind-mount /wineprefix from host. We already have the installed volume mounted at /installed,
      // and we pointed WINEPREFIX+GAME_EXECUTABLE into it.
      logger.info(`  Using Wine prefix inside installed volume: ${winePrefixPath}`);

      // Log the effective (rewritten) Wine env for debugging.
      const effectiveWinePrefix = env.find((e) => e.startsWith('WINEPREFIX='));
      const effectiveGameExecutable = env.find((e) => e.startsWith('GAME_EXECUTABLE='));
      if (effectiveWinePrefix) logger.info(`  Effective ${effectiveWinePrefix}`);
      if (effectiveGameExecutable) logger.info(`  Effective ${effectiveGameExecutable}`);
    } 
    else if (platform.type === 'wine' && !winePrefixPath) {
      // Without a prefix mount, the container will get an empty anonymous volume at /wineprefix
      // and Wine will fail to find the installed game files.
      throw new Error('Wine prefix not found; refusing to launch without /wineprefix bind mount');
    }
    // For Commodore, Amiga, MAME, and RetroArch emulator games, mount the ROM file directory and per-game home
    else if ((game.platformId && (viceEmulators[game.platformId] || amigaEmulators[game.platformId] || mameEmulators[game.platformId])) || platform.configuration.containerImage?.includes('runner-retroarch')) {
      if (game.filePath && game.filePath !== 'MENU') {
        const romDir = path.dirname(game.filePath);
        binds.push(`${romDir}:/roms:ro`);
        logger.info(`  Mounting ROM directory: ${romDir} -> /roms`);
      }
      
      // Mount per-game home directory for emulator config and saves
      // IMPORTANT: Mount this BEFORE displayConfig.volumes so individual files can overlay
      if (emulatorHomePath) {
        binds.push(`${emulatorHomePath}:/home/gameuser:rw`);
        logger.info(`  Mounting emulator home: ${emulatorHomePath} -> /home/gameuser`);
      }

      // Mount BIOS directory for Amiga
      if (game.platformId && amigaEmulators[game.platformId]) {
         const dillingerRoot = this.storage.getDillingerRoot();
         const biosPath = path.join(dillingerRoot, 'bios', 'amiga');
         
         // Ensure directory exists to prevent Docker from creating it as root
         try {
           const fs = await import('fs-extra');
           await fs.ensureDir(biosPath);
         } catch (err) {
           logger.warn(`Could not ensure BIOS directory exists: ${biosPath}`, err);
         }

         const hostBiosPath = this.getHostPath(biosPath);
         binds.push(`${hostBiosPath}:/bios:ro`);
         logger.info(`  Mounting BIOS directory: ${hostBiosPath} -> /bios`);
      }
    } 
    // For other games, mount the game directory.
    // Wine games should NOT mount `/game` via dillinger_current_session:
    // they run from `/wineprefix` and the session volume can accidentally
    // point at a single ROM file (causing Docker "not a directory").
    else if (platform.type !== 'wine') {
      binds.push(`${this.SESSION_VOLUME}:/game:ro`);
      logger.info(`  Mounting game directory: ${this.SESSION_VOLUME} -> /game`);
    }
    
    // Add display configuration volumes AFTER game-specific mounts
    // This allows individual file mounts (like .Xauthority, pulse/cookie) to overlay
    binds.push(...displayConfig.volumes);

    try {
      // Get Docker settings for auto-remove policy
      // Allow a per-launch override for debugging.
      const settingsService = SettingsService.getInstance();
      const dockerSettings = await settingsService.getDockerSettings();
      const keepContainer = options.keepContainer === true;
      const autoRemove = keepContainer
        ? false
        : (dockerSettings.autoRemoveContainers !== undefined
          ? dockerSettings.autoRemoveContainers
          : false); // Default to false (keep containers)

      // Create and start the container
      const containerConfig: any = {
        Image: platform.configuration.containerImage || 'dillinger/runner-linux-native:latest',
        name: `dillinger-session-${sessionId}`,
        Env: env,
        WorkingDir: containerWorkingDir,
        HostConfig: {
          AutoRemove: autoRemove,
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

      if (keepContainer) {
        logger.info('  Keep container enabled: container will not be auto-removed');
      }
      
      // Expose Moonlight ports if streaming is enabled
      if (moonlightConfig?.enabled) {
        containerConfig.ExposedPorts = {
          '47984/tcp': {}, // HTTPS
          '47989/tcp': {}, // HTTP
          '47999/udp': {}, // Control
          '48010/tcp': {}, // RTSP
          '48100/udp': {}, // Video
          '48200/udp': {}, // Audio
        };
        
        containerConfig.HostConfig.PortBindings = {
          '47984/tcp': [{ HostPort: '47984' }],
          '47989/tcp': [{ HostPort: '47989' }],
          '47999/udp': [{ HostPort: '47999' }],
          '48010/tcp': [{ HostPort: '48010' }],
          '48100/udp': [{ HostPort: '48100' }],
          '48200/udp': [{ HostPort: '48200' }],
        };
        
        logger.info(`  Moonlight ports exposed: 47984, 47989, 47999, 48010, 48100, 48200`);
      }
      
      // Pass the command array to the container
      // The entrypoint script will execute it with gosu
      containerConfig.Cmd = cmdArray;
      
      const container = await docker.createContainer(containerConfig);

      await container.start();
      
      const info = await container.inspect();

      logger.info(`✓ Game container started: ${container.id}`);
      logger.info(`  Container ID: ${info.Id}`);
      logger.info(`  Status: ${info.State.Status}`);

      return {
        containerId: info.Id,
        status: info.State.Status,
        createdAt: info.Created,
      };
    } catch (error) {
      logger.error('Error launching game container:', error);
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
    let emulatorHomePath: string | null = null;
    
    // Map platform IDs to VICE emulator commands
    const viceEmulators: Record<string, string> = {
      'c64': 'x64sc',
      'c128': 'x128',
      'vic20': 'xvic',
      'plus4': 'xplus4',
      'pet': 'xpet'
    };

    // Map platform IDs to MAME emulator commands
    const mameEmulators: Record<string, string> = {
      'mame': 'mame',
      // 'arcade': 'mame' // Removed arcade from here as it's now handled by RetroArch runner
    };
    
    if (platform.type === 'wine') {
      const fs = await import('fs-extra');

      const configuredInstallPath = game.installation?.installPath;
      if (configuredInstallPath) {
        const normalizedInstallPath = await this.normalizeInstalledPath(configuredInstallPath);
        const preferredPrefixPath = path.posix.join(normalizedInstallPath, `wineprefix-${gameIdentifier}`);
        if (await fs.pathExists(preferredPrefixPath)) {
          winePrefixPath = preferredPrefixPath;
          logger.info(`  Debug Wine prefix (per-game installPath): ${winePrefixPath}`);
        }
      }

      if (!winePrefixPath) {
        const hostInstallPath = await this.getInstallVolumeHostPath();
        const legacyPrefixPath = path.posix.join(this.getHostPath(hostInstallPath), `wineprefix-${gameIdentifier}`);
        winePrefixPath = legacyPrefixPath;
        logger.info(`  Debug Wine prefix (legacy volume root): ${winePrefixPath}`);
      }
    } else if (game.platformId && (viceEmulators[game.platformId] || mameEmulators[game.platformId])) {
      // For emulator games, prepare the per-game home directory
      const dillingerRoot = this.storage.getDillingerRoot();
      const emulatorHomeDir = path.join(dillingerRoot, 'emulator-homes', gameIdentifier);
      emulatorHomePath = this.getHostPath(emulatorHomeDir);
      
      // Ensure the directory exists
      try {
        const fs = await import('fs-extra');
        const { chmod } = await import('fs/promises');
        
        // Create parent directory first if it doesn't exist
        const parentDir = path.dirname(emulatorHomePath);
        await fs.ensureDir(parentDir);
        
        // Create the game-specific directory
        await fs.ensureDir(emulatorHomePath);
        
        // Pre-create .config/pulse directory for PulseAudio
        const pulseDir = path.join(emulatorHomePath, '.config', 'pulse');
        await fs.ensureDir(pulseDir);
        
        await chmod(emulatorHomePath, 0o755);
        await chmod(path.join(emulatorHomePath, '.config'), 0o755);
        await chmod(pulseDir, 0o755);
        logger.info(`  Debug emulator home: ${emulatorHomePath}`);
      } catch (error: any) {
        logger.error(`  ✗ Failed to create debug emulator home directory: ${error.message}`);
        logger.error(`    Path: ${emulatorHomePath}`);
        emulatorHomePath = null;
      }
    }

    // Setup display configuration
    const displayConfig = await this.getDisplayConfiguration();
    
    // Base environment
    const env = [
      ...displayConfig.env,
      'DEBIAN_FRONTEND=noninteractive',
    ];

    // Pass PUID/PGID to runner if set in environment
    if (process.env.PUID) env.push(`PUID=${process.env.PUID}`);
    if (process.env.PGID) env.push(`PGID=${process.env.PGID}`);

    // Add Wine-specific environment
    if (platform.type === 'wine') {
      // Build WINEDEBUG environment variable from game settings
      const wineDebug = this.buildWineDebug(game);
      
      // Note: WINEARCH should NOT be set for debug containers with existing prefixes
      // Wine will auto-detect the architecture from the existing prefix
      env.push('WINEPREFIX=/wineprefix');
      env.push(`WINEDEBUG=${wineDebug}`);
      
      logger.info(`  WINEDEBUG=${wineDebug}`);
    }

    // Setup volume binds
    const binds = [
      `dillinger_root:/data:rw`,
      ...displayConfig.volumes
    ];
    
    if (platform.type === 'wine' && winePrefixPath) {
      binds.push(`${winePrefixPath}:/wineprefix:rw`);
    } else if (game.platformId && (viceEmulators[game.platformId] || mameEmulators[game.platformId]) && emulatorHomePath) {
      // Mount emulator home for debug session
      binds.push(`${emulatorHomePath}:/home/gameuser:rw`);
      // Also mount ROM directory if available
      if (game.filePath) {
        const romDir = path.dirname(game.filePath);
        binds.push(`${romDir}:/roms:ro`);
      }
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

      logger.info(`✓ Debug container started: ${container.id}`);
      logger.info(`  Container ID: ${info.Id}`);

      // Generate the docker exec command for interactive access
      const execCommand = `docker exec -it ${info.Id.substring(0, 12)} /bin/bash`;

      return {
        containerId: info.Id,
        status: info.State.Status,
        createdAt: info.Created,
        execCommand,
      };
    } catch (error) {
      logger.error('Error launching debug container:', error);
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
    const hostInstallPath = await this.getInstallVolumeHostPath();
    const winePrefixPath = path.posix.join(
      this.getHostPath(hostInstallPath),
      `wineprefix-${gameIdentifier}`
    );
    
    // The game files are inside the Wine prefix at drive_c/GOG Games/<game>/
    // We need to extract the game directory from the launch command
    const launchCommand = game.settings?.launch?.command || '';
    const windowsPath = launchCommand.replace(/^[A-Za-z]:/, ''); // Remove C:
    const gameDirPath = path.dirname(windowsPath.replace(/\\/g, '/')); // Get directory
    const gameInstallPath = path.posix.join(winePrefixPath, 'drive_c', gameDirPath.substring(1)); // Remove leading /

    logger.info(`Looking for registry files in: ${gameInstallPath}`);

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

      logger.info(`Found registry setup files: ${regSetupFiles.join(', ')}`);

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
      
      logger.info(`Converted ${regFile} to dillinger_setup.reg`);

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

      logger.info(`Running: wine regedit /S dillinger_setup.reg (WINEDEBUG=${wineDebug})`);
      
      const container = await docker.createContainer(containerConfig);
      
      await container.start();
      const result = await container.wait();

      if (result.StatusCode === 0) {
        logger.info(`✓ Successfully imported registry settings from ${regFile}`);
        return { success: true, message: `Registry settings imported from ${regFile}` };
      } else {
        logger.error(`Failed to import registry settings, exit code: ${result.StatusCode}`);
        return { success: false, message: `Failed to import registry settings (exit code: ${result.StatusCode})` };
      }

    } catch (error: any) {
      logger.error('Error running registry setup:', error);
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
    
    logger.info(`Found regpath variable: ${regpathValue}`);
    logger.info(`Total lines in CMD file: ${lines.length}`);
    
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
      
      logger.debug(`[${processedCount}] Original: ${originalLine.substring(0, 80)}`);
      logger.debug(`[${processedCount}] After replace: ${trimmed.substring(0, 100)}`);
      
      // Parse REG ADD commands - more flexible pattern
      // Matches: REG ADD "path" /v "name" /t TYPE /d "data" /f [/reg:32]
      const regAddMatch = trimmed.match(/REG\s+ADD\s+"([^"]+)"\s+\/v\s+"([^"]+)"\s+\/t\s+(\S+)\s+\/d\s+(.+?)(?:\s+\/f|\s+$)/i);
      
      if (regAddMatch) {
        matchedCount++;
        logger.debug(`[${processedCount}] MATCHED!`);
        const keyPath = regAddMatch[1];
        const valueName = regAddMatch[2];
        const valueType = regAddMatch[3];
        let valueData = regAddMatch[4]?.trim();
        
        if (!keyPath || !valueName || !valueType || !valueData) {
          logger.debug(`Skipping line - missing data: ${trimmed}`);
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
    
    logger.info(`\n=== CMD Parsing Summary ===`);
    logger.info(`Total lines: ${lines.length}`);
    logger.info(`Skipped: ${skippedCount}`);
    logger.info(`Processed: ${processedCount}`);
    logger.info(`Matched: ${matchedCount}`);
    logger.info(`===========================\n`);
    
    logger.info(`Generated .reg file with ${regContent.split('\n').length} lines`);
    return regContent;
  }

  /**
   * Monitor a game container and notify when it stops
   * This runs asynchronously and updates the session status
   */
  async monitorGameContainer(
    containerId: string, 
    _sessionId: string,
    onStop?: (exitCode: number) => void | Promise<void>
  ): Promise<void> {
    try {
      const container = docker.getContainer(containerId);
      
      logger.info(`🔍 Monitoring game container: ${containerId.substring(0, 12)}`);
      
      // Capture logs in real-time in case container is auto-removed
      let capturedLogs: string[] = [];
      try {
        const stream = await container.logs({
          follow: true,
          stdout: true,
          stderr: true,
          tail: 100
        });
        
        stream.on('data', (chunk) => {
          capturedLogs.push(chunk.toString('utf8'));
          if (capturedLogs.length > 200) capturedLogs.shift(); // Keep last 200 chunks
        });
      } catch (err) {
        logger.warn(`Could not attach to container logs: ${err}`);
      }
      
      // Wait for container to finish (this blocks until container stops)
      const result = await container.wait();
      
      logger.info(`✓ Game container stopped: ${containerId.substring(0, 12)}`);
      logger.info(`  Exit code: ${result.StatusCode}`);
      
      // If exit code is non-zero, print the captured logs
      if (result.StatusCode !== 0) {
        logger.error(`=== CONTAINER LOGS (Last captured) ===`);
        logger.error(capturedLogs.join('').trim());
        logger.error(`======================================`);
        
        // Try to fetch from API as backup if captured logs are empty
        if (capturedLogs.length === 0) {
             try {
                const logs = await this.getContainerLogs(containerId, 50);
                logger.error(`=== CONTAINER LOGS (From API) ===\n${logs}\n=================================`);
             } catch (e) {
                logger.warn(`Could not fetch logs from API (container likely removed): ${e}`);
             }
        }
      }
      
      // Call the callback if provided
      if (onStop) {
        await onStop(result.StatusCode);
      }
    } catch (error) {
      logger.error('Error monitoring game container:', error);
    }
  }

  /**
   * Install a game using Docker with GUI support
   * This runs an installer (exe, msi, etc.) in a containerized environment
   * with X11/Wayland passthrough so the user sees the installation wizard
   */
  async installGame(options: GameInstallOptions): Promise<ContainerInfo> {
    const { installerPath, installPath, platform, sessionId, game, installerArgs } = options;

    // Ensure host path is detected
    await this.detectHostPath();

    logger.info(`Installing game with installer: ${installerPath}`);
    logger.info(`  Installation target: ${installPath}`);
    logger.info(`  Platform: ${platform.name} (${platform.type})`);
    logger.info(`  Container Image: ${platform.configuration.containerImage}`);
    logger.info(`  Game slug: ${game.slug || game.id}`);

    const installerIsInInstallersVolume = typeof installerPath === 'string' && installerPath.startsWith('/installers/');

    // Convert paths to host paths for Docker bind mounts (only needed when installer is a host/bind path)
    const hostInstallerPath = installerIsInInstallersVolume ? null : this.getHostPath(installerPath);
    // Option A canonical: installPath should be a container path under /installed
    const hostInstallPath = await this.normalizeInstalledPath(installPath);

    // Get display forwarding configuration
    const displayConfig = await this.getDisplayConfiguration();
    logger.info(`  Display mode: ${displayConfig.mode}`);

    // Use game slug (or ID if no slug) for Wine prefix directory
    const gameIdentifier = game.slug || game.id;
    const winePrefixPath = path.posix.join(hostInstallPath, `wineprefix-${gameIdentifier}`);
    
    logger.info(`  Wine prefix: ${winePrefixPath}`);

    // For Wine installations, ensure the Wine prefix directory exists with proper permissions
    // We'll create it with a permissive mode so Wine can use it
    if (platform.type === 'wine') {
      try {
        const fs = await import('fs-extra');
        // Ensure install root exists too
        await fs.ensureDir(hostInstallPath);
        // Create directory if it doesn't exist
        await fs.ensureDir(winePrefixPath);
        // Set permissions to 777 so Wine user in container can access it
        await fs.chmod(winePrefixPath, 0o777);
        logger.info(`  ✓ Wine prefix directory prepared with correct permissions`);
      } catch (error) {
        logger.warn(`  ⚠ Could not prepare Wine prefix directory:`, error);
        // Continue anyway - Wine will try to create it
      }
    }

    const installerContainerPath = installerIsInInstallersVolume
      ? installerPath
      : `/installer/${path.basename(installerPath)}`;

    // Prepare environment variables for installation
    const env = [
      `INSTALLER_PATH=${installerContainerPath}`,
      `INSTALL_TARGET=/install`,
      ...displayConfig.env
    ];

    // Optional installer args passed through to runner entrypoint
    if (installerArgs) {
      env.push(`INSTALLER_ARGS=${installerArgs}`);
    }

    // Pass PUID/PGID to runner if set in environment
    if (process.env.PUID) env.push(`PUID=${process.env.PUID}`);
    if (process.env.PGID) env.push(`PGID=${process.env.PGID}`);

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
      
      logger.info(`  Wine architecture: ${wineArch}`);
      logger.info(`  WINEDEBUG=${wineDebug}`);
    }

    try {
      const quoteForBash = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

      // Create installation container with GUI passthrough
      const container = await docker.createContainer({
        Image: platform.configuration.containerImage || 'dillinger/runner-wine:latest',
        name: `dillinger-install-${sessionId}`,
        Env: env,
        HostConfig: {
          AutoRemove: true, // Auto-remove container when installation completes
          Binds: [
            ...(installerIsInInstallersVolume
              ? []
              : [`${hostInstallerPath}:/installer/${path.basename(installerPath)}:ro`]), // Mount installer as read-only
            `${hostInstallPath}:/install:rw`, // Mount installation target as read-write
            `${winePrefixPath}:/wineprefix:rw`, // Game-specific Wine prefix (prevents interference between games)
            `dillinger_installers:/installers:rw`, // Helper volume for finding installers
            `dillinger_installed:/installed:rw`, // Points to where games are installed
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
        // Use default entrypoint but pass installer as command
        Cmd: platform.type === 'wine'
          ? ['wine', installerContainerPath]
          : ['/bin/bash', '-lc', quoteForBash(installerContainerPath)],
      });

      await container.start();
      
      const info = await container.inspect();

      logger.info(`✓ Installation container started: ${container.id}`);
      logger.info(`  Container ID: ${info.Id}`);
      logger.info(`  Status: ${info.State.Status}`);
      logger.info(`  The installation GUI should now be visible on your display`);

      return {
        containerId: info.Id,
        status: info.State.Status,
        createdAt: info.Created,
      };
    } catch (error) {
      logger.error('Error starting installation container:', error);
      throw new Error(`Failed to start installer: ${error}`);
    }
  }

  /**
   * Monitor an installation container and return completion status
   */
  async waitForInstallationComplete(containerId: string): Promise<{ success: boolean; exitCode: number }> {
    try {
      const container = docker.getContainer(containerId);
      
      // First check if container exists
      try {
        await container.inspect();
      } catch (inspectError: any) {
        if (inspectError.statusCode === 404) {
          logger.info(`⚠️  Installation container ${containerId} no longer exists (auto-removed)`);
          // Container was auto-removed, assume it finished (we don't know the exit code)
          // Treat this as a failure since we can't verify success
          return { success: false, exitCode: 1 };
        }
        throw inspectError;
      }
      
      // Wait for container to finish
      logger.info(`🔍 Monitoring installation container: ${containerId}`);
      const result = await container.wait();
      
      logger.info(`✓ Installation container finished with exit code: ${result.StatusCode}`);
      
      return {
        success: result.StatusCode === 0,
        exitCode: result.StatusCode
      };
    } catch (error: any) {
      if (error.statusCode === 404) {
        logger.info(`⚠️  Installation container ${containerId} no longer exists (auto-removed during wait)`);
        return { success: false, exitCode: 1 };
      }
      logger.error('Error monitoring installation:', error);
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
      const hostInstallPath = await this.normalizeInstalledPath(installPath);
      logger.info(`🔍 Scanning for game executables in: ${installPath}`);
      if (hostInstallPath !== installPath) {
        logger.info(`  Host path: ${hostInstallPath}`);
      }
      
      const executables: string[] = [];
      
      const scanDirectory = async (dirPath: string, depth: number = 0): Promise<void> => {
        // Limit recursion depth to avoid scanning too deep
        if (depth > 3) return;
        
        try {
          const items = await fs.readdir(dirPath, { withFileTypes: true });
          
          for (const item of items) {
            const itemPath = path.join(dirPath, item.name);
            const relativePath = path.relative(hostInstallPath, itemPath);
            
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
                  logger.info(`  Found executable: ${relativePath}`);
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
          logger.warn(`Could not scan directory ${dirPath}:`, err);
        }
      };
      
      await scanDirectory(hostInstallPath);
      
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
      
      logger.info(`✓ Found ${executables.length} potential game executables`);
      return executables;
      
    } catch (error) {
      logger.error('Error scanning for executables:', error);
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
      const hostInstallPath = await this.normalizeInstalledPath(installPath);
      logger.info(`🔍 Scanning for shortcuts in: ${installPath}`);
      if (hostInstallPath !== installPath) {
        logger.info(`  Host path: ${hostInstallPath}`);
      }
      
      const shortcuts: string[] = [];
      
      const scanDirectory = async (dirPath: string, depth: number = 0): Promise<void> => {
        // Limit recursion depth but allow deeper for shortcut scanning
        if (depth > 10) return;
        
        try {
          const items = await fs.readdir(dirPath, { withFileTypes: true });
          
          for (const item of items) {
            const itemPath = path.join(dirPath, item.name);
            const relativePath = path.relative(hostInstallPath, itemPath);
            
            if (item.isFile()) {
              const ext = path.extname(item.name).toLowerCase();
              if (ext === '.lnk') {
                shortcuts.push(relativePath);
                logger.info(`  Found shortcut: ${relativePath}`);
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
          logger.warn(`Could not scan directory ${dirPath}:`, err);
        }
      };
      
      await scanDirectory(hostInstallPath);
      
      logger.info(`✓ Found ${shortcuts.length} shortcut files`);
      return shortcuts;
      
    } catch (error) {
      logger.error('Error scanning for shortcuts:', error);
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
    logger.info(`🔗 Parsing shortcut: ${shortcutPath}`);
    
    try {
      const fs = await import('fs/promises');
      
      // Read the entire .lnk file
      const buffer = await fs.readFile(shortcutPath);
      
      // Verify it's a valid .lnk file (starts with magic bytes)
      if (buffer.length < 76 || buffer.readUInt32LE(0) !== 0x0000004C) {
        logger.warn('Invalid .lnk file format');
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
      
      logger.info(`✓ Parsed shortcut: ${result.target || 'No target found'}`);
      logger.info(`  Working dir: ${result.workingDirectory || 'None'}`);
      logger.info(`  Arguments: ${result.arguments || 'None'}`);
      
      return result.target ? result : null;
      
    } catch (error) {
      logger.error('Error parsing shortcut:', error);
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
      // Session ID extraction was previously used for cleanup but is no longer needed
      // since save volumes are now per-game rather than per-session
      if (cleanupVolume) {
        try {
          const info = await container.inspect();
          const containerName = info.Name.replace(/^\//, ''); // Remove leading slash
          // Verify this is a dillinger session container
          if (!containerName.match(/dillinger-session-(.+)/)) {
            logger.warn('Container does not appear to be a dillinger session');
          }
        } catch (err) {
          logger.warn('Could not inspect container for cleanup:', err);
        }
      }
      
      await container.stop();
      logger.info(`✓ Game container stopped: ${containerId}`);
      
      // Note: We don't clean up save volumes here anymore
      // Save volumes are game-based (dillinger_saves_<gameId>) and persist across sessions
      // They should only be deleted when the game itself is deleted
    } catch (error: any) {
      // 304 means container is already stopped - this is fine
      if (error.statusCode === 304) {
        logger.info(`ℹ Game container already stopped: ${containerId}`);
        return;
      }
      
      // 404 means container doesn't exist - also not really an error
      if (error.statusCode === 404) {
        logger.info(`ℹ Game container not found (may have been removed): ${containerId}`);
        return;
      }
      
      logger.error('Error stopping game container:', error);
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

      logger.info(`Found ${allContainers.length} containers using ${this.SESSION_VOLUME}`);

      for (const containerInfo of allContainers) {
        const container = docker.getContainer(containerInfo.Id);
        logger.info(`Cleaning up container: ${containerInfo.Names[0]} (${containerInfo.Id.substring(0, 12)})`);
        
        try {
          // Stop if running
          if (containerInfo.State === 'running') {
            await container.stop({ t: 2 }); // 2 second timeout
            logger.info(`  Stopped container`);
          }
          
          // Remove the container
          await container.remove({ force: true });
          logger.info(`  Removed container`);
        } catch (err: any) {
          logger.error(`  Failed to cleanup container ${containerInfo.Id}: ${err.message}`);
          // Continue with other containers even if one fails
        }
      }
    } catch (error: any) {
      logger.error('Error cleaning up volume containers:', error.message);
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
      logger.error('Error listing game containers:', error);
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
      
      // Check if TTY was enabled
      let isTty = false;
      try {
        const info = await container.inspect();
        isTty = info.Config.Tty;
      } catch (e) {
        // If container is gone, we can't inspect it. Assume false or try to parse anyway.
        // But if it's gone, logs() might fail too unless we're lucky.
      }

      // Get logs as buffer (follow: false returns Buffer)
      const logsBuffer = await container.logs({
        stdout: true,
        stderr: true,
        tail,
        timestamps: true,
        follow: false,
      });

      if (isTty) {
        // If Tty is enabled, logs are raw text
        return logsBuffer.toString('utf8');
      }

      // Docker's multiplexed stream format: 8-byte header per chunk
      // Header: [stream_type, 0, 0, 0, size1, size2, size3, size4]
      // stream_type: 1=stdout, 2=stderr
      const logs: string[] = [];
      let offset = 0;

      while (offset < logsBuffer.length) {
        // Safety check for buffer bounds
        if (offset + 8 > logsBuffer.length) break;

        // Read 8-byte header (stream type at byte 0, size at bytes 4-7)
        // Stream type: 0=stdin, 1=stdout, 2=stderr (not used here)
        const size = logsBuffer.readUInt32BE(offset + 4);
        
        // Safety check for payload bounds
        if (offset + 8 + size > logsBuffer.length) break;

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
      logger.error('Error getting container logs:', error);
      throw new Error(`Failed to get container logs: ${error}`);
    }
  }

  async inspectContainer(containerId: string): Promise<any> {
    try {
      const container = docker.getContainer(containerId);
      return await container.inspect();
    } catch (error) {
      if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
        throw new Error('Container not found');
      }
      logger.error('Error inspecting container:', error);
      throw new Error(`Failed to inspect container: ${error}`);
    }
  }

  async stopContainer(containerId: string): Promise<void> {
    try {
      const container = docker.getContainer(containerId);
      await container.stop();
    } catch (error: any) {
      if (error?.statusCode === 304) {
        return; // already stopped
      }
      if (error?.statusCode === 404) {
        throw new Error('Container not found');
      }
      logger.error('Error stopping container:', error);
      throw new Error(`Failed to stop container: ${error}`);
    }
  }

  async removeContainer(containerId: string, force: boolean = true): Promise<void> {
    try {
      const container = docker.getContainer(containerId);
      await container.remove({ force });
    } catch (error: any) {
      if (error?.statusCode === 404) {
        throw new Error('Container not found');
      }
      logger.error('Error removing container:', error);
      throw new Error(`Failed to remove container: ${error}`);
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
      logger.info(`Using X11 display: ${display}`);
      
      // Check if Xauthority file exists AND is actually a file (not a directory)
      // Docker creates directories when mounting non-existent files, so we must verify
      let xauthorityExists = false;
      try {
        const stat = statSync(xauthority);
        xauthorityExists = stat.isFile() && stat.size > 0;
      } catch {
        // File doesn't exist
      }
      
      const volumes = ['/tmp/.X11-unix:/tmp/.X11-unix:rw'];
      if (xauthorityExists) {
        volumes.push(`${xauthority}:/home/gameuser/.Xauthority:ro`);
        logger.info(`  Xauthority: ${xauthority}`);
      } else {
        logger.warn(`  ⚠ No valid Xauthority file found at ${xauthority}, X11 may require xhost +local:docker`);
      }
      
      // Add PulseAudio socket for audio support
      const userHome = process.env.HOME;
      if (xdgRuntimeDir && existsSync(`${xdgRuntimeDir}/pulse`)) {
        volumes.push(`${xdgRuntimeDir}/pulse:/run/user/1000/pulse:rw`);
        logger.info(`  ✓ PulseAudio socket available`);
        
        // Mount PulseAudio cookie if it exists
        const pulseCookie = `${userHome}/.config/pulse/cookie`;
        if (existsSync(pulseCookie)) {
          volumes.push(`${pulseCookie}:/home/gameuser/.config/pulse/cookie:ro`);
          logger.info(`  ✓ PulseAudio cookie available`);
        }
      } else {
        logger.warn(`  ⚠ No PulseAudio socket found at ${xdgRuntimeDir}/pulse`);
      }
      
      // Check if GPU device exists
      const devices = [];
      if (existsSync('/dev/dri')) {
        devices.push({ PathOnHost: '/dev/dri', PathInContainer: '/dev/dri', CgroupPermissions: 'rwm' });
        logger.info(`  ✓ GPU device available`);
      } else {
        logger.warn(`  ⚠ No GPU device (/dev/dri not found), software rendering only`);
      }

      // Check if sound device exists
      if (existsSync('/dev/snd')) {
        devices.push({ PathOnHost: '/dev/snd', PathInContainer: '/dev/snd', CgroupPermissions: 'rwm' });
        logger.info(`  ✓ Sound device available`);
      }
      
      // Add input devices for keyboard, mouse, and joystick support
      if (existsSync('/dev/input')) {
        devices.push({ PathOnHost: '/dev/input', PathInContainer: '/dev/input', CgroupPermissions: 'rwm' });
        logger.info(`  ✓ Input devices available (keyboard, mouse, joystick)`);

        // Also mount /proc/bus/input/devices so we can identify devices by name
        // Mount to /tmp/host-input-devices to avoid "inside /proc" mount errors
        if (existsSync('/proc/bus/input/devices')) {
          volumes.push('/proc/bus/input/devices:/tmp/host-input-devices:ro');
        }

        // Mount /run/udev to allow libudev to query device details (names, capabilities)
        if (existsSync('/run/udev')) {
          volumes.push('/run/udev:/run/udev:ro');
          logger.info(`  ✓ udev database mounted`);
        }
      }
      
      // Add explicit joystick devices (js0, js1, js2, etc.)
      // These need to be passed individually for proper access in containers
      for (let i = 0; i < 10; i++) {
        const jsDevice = `/dev/input/js${i}`;
        if (existsSync(jsDevice)) {
          devices.push({ PathOnHost: jsDevice, PathInContainer: jsDevice, CgroupPermissions: 'rwm' });
          logger.info(`  ✓ Joystick device available: ${jsDevice}`);
        }
      }
      
      // Add uinput for virtual input device creation (needed by some emulators)
      if (existsSync('/dev/uinput')) {
        devices.push({ PathOnHost: '/dev/uinput', PathInContainer: '/dev/uinput', CgroupPermissions: 'rwm' });
        logger.info(`  ✓ uinput device available`);
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
      logger.info(`Using Wayland display: ${waylandDisplay}`);
      
      // Check if GPU device exists
      const devices = [];
      if (existsSync('/dev/dri')) {
        devices.push({ PathOnHost: '/dev/dri', PathInContainer: '/dev/dri', CgroupPermissions: 'rwm' });
        logger.info(`  ✓ GPU device available`);
      } else {
        logger.warn(`  ⚠ No GPU device (/dev/dri not found), software rendering only`);
      }

      // Check if sound device exists
      if (existsSync('/dev/snd')) {
        devices.push({ PathOnHost: '/dev/snd', PathInContainer: '/dev/snd', CgroupPermissions: 'rwm' });
        logger.info(`  ✓ Sound device available`);
      }
      
      const volumes = [`${waylandSocket}:/run/user/1000/${waylandDisplay}:rw`];

      // Add input devices for keyboard, mouse, and joystick support
      if (existsSync('/dev/input')) {
        devices.push({ PathOnHost: '/dev/input', PathInContainer: '/dev/input', CgroupPermissions: 'rwm' });
        logger.info(`  ✓ Input devices available (keyboard, mouse, joystick)`);

        // Also mount /proc/bus/input/devices so we can identify devices by name
        // Mount to /tmp/host-input-devices to avoid "inside /proc" mount errors
        if (existsSync('/proc/bus/input/devices')) {
          volumes.push('/proc/bus/input/devices:/tmp/host-input-devices:ro');
        }

        // Mount /run/udev to allow libudev to query device details (names, capabilities)
        if (existsSync('/run/udev')) {
          volumes.push('/run/udev:/run/udev:ro');
          logger.info(`  ✓ udev database mounted`);
        }
      }
      
      // Add explicit joystick devices (js0, js1, js2, etc.)
      // These need to be passed individually for proper access in containers
      for (let i = 0; i < 10; i++) {
        const jsDevice = `/dev/input/js${i}`;
        if (existsSync(jsDevice)) {
          devices.push({ PathOnHost: jsDevice, PathInContainer: jsDevice, CgroupPermissions: 'rwm' });
          logger.info(`  ✓ Joystick device available: ${jsDevice}`);
        }
      }
      
      // Add uinput for virtual input device creation (needed by some emulators)
      if (existsSync('/dev/uinput')) {
        devices.push({ PathOnHost: '/dev/uinput', PathInContainer: '/dev/uinput', CgroupPermissions: 'rwm' });
        logger.info(`  ✓ uinput device available`);
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
        volumes,
        devices,
        securityOpt: []
      };
    }
    
    // No display available - headless mode
    logger.warn('⚠ No display environment detected (DISPLAY or WAYLAND_DISPLAY not set)');
    logger.warn('  Games with graphical output will not be visible');
    
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
      logger.error('Failed to get audio sinks:', error);
      return [];
    }
  }

  /**
   * Clean up stopped game session containers
   */
  async cleanupStoppedContainers(): Promise<{ removed: number; containers: string[] }> {
    try {
      const containers = await docker.listContainers({
        all: true,
        filters: {
          name: ['dillinger-session-'],
          status: ['exited', 'dead']
        }
      });

      const removed: string[] = [];
      
      for (const containerInfo of containers) {
        try {
          const container = docker.getContainer(containerInfo.Id);
          await container.remove({ v: true }); // Remove with volumes
          removed.push(containerInfo.Names[0]?.replace(/^\//, '') || containerInfo.Id);
          logger.info(`✓ Removed stopped container: ${containerInfo.Id.substring(0, 12)}`);
        } catch (err) {
          logger.error(`Failed to remove container ${containerInfo.Id}:`, err);
        }
      }

      return {
        removed: removed.length,
        containers: removed
      };
    } catch (error) {
      logger.error('Failed to cleanup stopped containers:', error);
      throw error;
    }
  }

  /**
   * Clean up orphaned Docker volumes (volumes not used by any container)
   */
  async cleanupOrphanedVolumes(): Promise<{ removed: number; volumes: string[] }> {
    try {
      // Get all volumes
      const volumeList = await docker.listVolumes();
      const allVolumes = volumeList.Volumes || [];

      // Get all containers (running and stopped)
      const containers = await docker.listContainers({ all: true });

      // Collect all volumes in use
      const volumesInUse = new Set<string>();
      for (const containerInfo of containers) {
        const container = docker.getContainer(containerInfo.Id);
        const inspect = await container.inspect();
        
        // Check mounts
        if (inspect.Mounts) {
          for (const mount of inspect.Mounts) {
            if (mount.Type === 'volume' && mount.Name) {
              volumesInUse.add(mount.Name);
            }
          }
        }
      }

      // Remove orphaned volumes (except system volumes)
      const removed: string[] = [];
      const protectedVolumes = ['dillinger_root', 'dillinger_installed', 'dillinger_installers'];

      for (const vol of allVolumes) {
        const volumeName = vol.Name;
        
        // Skip protected volumes
        if (protectedVolumes.includes(volumeName)) {
          continue;
        }

        // Skip volumes that are in use
        if (volumesInUse.has(volumeName)) {
          continue;
        }

        // Skip non-dillinger volumes
        if (!volumeName.startsWith('dillinger-session-')) {
          continue;
        }

        try {
          const volume = docker.getVolume(volumeName);
          await volume.remove();
          removed.push(volumeName);
          logger.info(`✓ Removed orphaned volume: ${volumeName}`);
        } catch (err) {
          logger.error(`Failed to remove volume ${volumeName}:`, err);
        }
      }

      return {
        removed: removed.length,
        volumes: removed
      };
    } catch (error) {
      logger.error('Failed to cleanup orphaned volumes:', error);
      throw error;
    }
  }
}
