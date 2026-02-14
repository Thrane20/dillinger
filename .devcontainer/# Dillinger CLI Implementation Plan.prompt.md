# Dillinger CLI Implementation Plan

**Package:** `dillinger-launcher`  
**Published as:** `dillinger` (global CLI command)  
**Purpose:** Replace `start-dillinger.sh` with a user-friendly TypeScript CLI tool

---

## Overview

The `dillinger-launcher` package provides a globally installable CLI tool that simplifies managing the Dillinger game library platform. It replaces the bash script with:

- Interactive prompts for better UX
- Docker volume management with bind mount support
- Version checking and auto-update
- Colored, formatted output
- Cross-platform compatibility (Linux, macOS, Windows with WSL)

### Key Features Mapped from Bash Script

| Bash Script Feature | CLI Command | Notes |
|---------------------|-------------|-------|
| Start container with checks | `dillinger start` | Interactive version selection, prereq checks |
| Stop container | `dillinger stop` | Graceful or force stop |
| Restart container | `dillinger restart` | Combines stop + start |
| View logs | `dillinger logs [-f]` | Follow mode support |
| Check/pull updates | `dillinger update` | Compare local vs remote versions |
| Volume management | `dillinger volume <cmd>` | Create, list, remove, inspect, bind |
| Status check | `dillinger status` | Show container state, version, port |
| N/A (new) | `dillinger doctor` | Run all prerequisite checks |

---

## Package Structure

```
packages/dillinger-launcher/
├── package.json
├── tsconfig.json
├── README.md
└── src/
    ├── index.ts                  # CLI entry point (commander setup)
    ├── commands/
    │   ├── start.ts              # Start Dillinger container
    │   ├── stop.ts               # Stop container
    │   ├── restart.ts            # Restart container
    │   ├── status.ts             # Show status
    │   ├── logs.ts               # View logs
    │   ├── update.ts             # Check/install updates
    │   ├── volume.ts             # Volume management subcommands
    │   └── doctor.ts             # System diagnostics
    └── lib/
        ├── constants.ts          # Shared constants
        ├── docker.ts             # Docker operations wrapper
        ├── version.ts            # Version checking/comparison
        ├── volumes.ts            # Volume management helpers
        ├── ui.ts                 # Terminal UI helpers (spinners, colors)
        └── udev.ts               # Udev rules setup (Wolf)
```

---

## Implementation Steps

### 1. Create Package Structure

```bash
cd /workspaces/dillinger/packages
mkdir -p dillinger-launcher/src/{commands,lib}
cd dillinger-launcher
```

### 2. Package Configuration

**`package.json`:**

```json
{
  "name": "dillinger-launcher",
  "version": "0.1.0",
  "description": "CLI tool to launch and manage Dillinger game library platform",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "dillinger": "dist/index.js"
  },
  "files": [
    "dist",
    "README.md"
  ],
  "scripts": {
    "build": "tsc && chmod +x dist/index.js",
    "dev": "tsx src/index.ts",
    "clean": "rm -rf dist",
    "type-check": "tsc --noEmit",
    "prepublishOnly": "pnpm run build"
  },
  "keywords": [
    "dillinger",
    "gaming",
    "library",
    "docker",
    "cli"
  ],
  "author": "Dillinger Project",
  "license": "MIT",
  "dependencies": {
    "@inquirer/prompts": "^7.2.0",
    "chalk": "^5.3.0",
    "commander": "^12.1.0",
    "dockerode": "^4.0.2",
    "node-fetch": "^3.3.2",
    "ora": "^8.1.1",
    "semver": "^7.6.3"
  },
  "devDependencies": {
    "@types/dockerode": "^3.3.31",
    "@types/node": "^22.10.5",
    "@types/semver": "^7.5.8",
    "tsx": "^4.19.2",
    "typescript": "^5.9.3"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

**`tsconfig.json`:**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022",
    "lib": ["ES2022"],
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 3. Main Entry Point

**`src/index.ts`:**

```typescript
#!/usr/bin/env node

import { Command } from 'commander';
import { startCommand } from './commands/start.js';
import { stopCommand } from './commands/stop.js';
import { restartCommand } from './commands/restart.js';
import { statusCommand } from './commands/status.js';
import { logsCommand } from './commands/logs.js';
import { volumeCommand } from './commands/volume.js';
import { updateCommand } from './commands/update.js';
import { doctorCommand } from './commands/doctor.js';
import { VERSION } from './lib/constants.js';

const program = new Command();

program
  .name('dillinger')
  .description('CLI tool to launch and manage the Dillinger game library platform')
  .version(VERSION);

program
  .command('start')
  .description('Start Dillinger platform')
  .option('-p, --port <port>', 'Port to expose web interface', '3010')
  .option('--no-gpu', 'Disable GPU passthrough')
  .option('--no-audio', 'Disable audio passthrough')
  .option('--no-display', 'Disable X11 display passthrough')
  .option('--pull', 'Always pull the latest image before starting')
  .option('--version <version>', 'Use a specific version tag')
  .action(startCommand);

program
  .command('stop')
  .description('Stop Dillinger platform')
  .option('-f, --force', 'Force stop (kill immediately)')
  .action(stopCommand);

program
  .command('restart')
  .description('Restart Dillinger platform')
  .action(restartCommand);

program
  .command('status')
  .description('Show Dillinger platform status')
  .action(statusCommand);

program
  .command('logs')
  .description('View Dillinger platform logs')
  .option('-f, --follow', 'Follow log output')
  .option('-n, --tail <lines>', 'Number of lines to show from the end', '100')
  .action(logsCommand);

program
  .command('update')
  .description('Update Dillinger to the latest version')
  .option('--check-only', 'Only check for updates without installing')
  .action(updateCommand);

program
  .command('doctor')
  .description('Run system diagnostics and check prerequisites')
  .action(doctorCommand);

// Volume management subcommands
const volume = program
  .command('volume')
  .description('Manage Docker volumes for Dillinger');

volume
  .command('list')
  .alias('ls')
  .description('List all Dillinger volumes')
  .action(volumeCommand.list);

volume
  .command('create <name>')
  .description('Create a new Docker volume')
  .option('-d, --driver <driver>', 'Volume driver', 'local')
  .option('-o, --option <key=value>', 'Driver-specific options (repeatable)', (val, prev) => [...(prev || []), val], [])
  .action(volumeCommand.create);

volume
  .command('remove <name>')
  .alias('rm')
  .description('Remove a Docker volume')
  .option('-f, --force', 'Force removal even if in use')
  .action(volumeCommand.remove);

volume
  .command('inspect <name>')
  .description('Show detailed volume information')
  .action(volumeCommand.inspect);

volume
  .command('bind <name> <hostPath>')
  .description('Create a volume bound to a host directory')
  .action(volumeCommand.bind);

program.parse();
```

### 4. Constants and Configuration

**`src/lib/constants.ts`:**

```typescript
export const VERSION = '0.1.0';

export const CONTAINER_NAME = 'dillinger';
export const IMAGE_NAME = 'ghcr.io/thrane20/dillinger/core';
export const DEFAULT_PORT = 3010;
export const VOLUME_NAME = 'dillinger_root';

export const VERSIONING_URL = 'https://raw.githubusercontent.com/Thrane20/dillinger/main/versioning.env';

export const WOLF_UDEV_RULES = `# Wolf Virtual Input Rules for Moonlight Game Streaming
# Installed by dillinger CLI
# See: https://games-on-whales.github.io/wolf/

# Allow Wolf to access /dev/uinput (for virtual joypad creation)
KERNEL=="uinput", SUBSYSTEM=="misc", MODE="0660", GROUP="input", OPTIONS+="static_node=uinput", TAG+="uaccess"

# Allow Wolf to access /dev/uhid (for DualSense emulation)
KERNEL=="uhid", GROUP="input", MODE="0660", TAG+="uaccess"

# Virtual Joypads created by Wolf - assign to seat9 to prevent conflicts
KERNEL=="hidraw*", ATTRS{name}=="Wolf PS5 (virtual) pad", GROUP="input", MODE="0660", ENV{ID_SEAT}="seat9"
SUBSYSTEMS=="input", ATTRS{name}=="Wolf X-Box One (virtual) pad", MODE="0660", ENV{ID_SEAT}="seat9"
SUBSYSTEMS=="input", ATTRS{name}=="Wolf PS5 (virtual) pad", MODE="0660", ENV{ID_SEAT}="seat9"
SUBSYSTEMS=="input", ATTRS{name}=="Wolf gamepad (virtual) motion sensors", MODE="0660", ENV{ID_SEAT}="seat9"
SUBSYSTEMS=="input", ATTRS{name}=="Wolf Nintendo (virtual) pad", MODE="0660", ENV{ID_SEAT}="seat9"
`;

export const UDEV_RULES_PATH = '/etc/udev/rules.d/85-wolf-virtual-inputs.rules';
```

### 5. UI Utilities

**`src/lib/ui.ts`:**

```typescript
import chalk from 'chalk';
import ora, { type Ora } from 'ora';

export const log = {
  header: (text: string) => {
    console.log('\n' + chalk.blue('═'.repeat(60)));
    console.log(chalk.blue(`  ${text}`));
    console.log(chalk.blue('═'.repeat(60)) + '\n');
  },
  success: (text: string) => console.log(chalk.green('✓ ') + text),
  error: (text: string) => console.log(chalk.red('✗ ') + text),
  warning: (text: string) => console.log(chalk.yellow('⚠ ') + text),
  info: (text: string) => console.log(chalk.blue('→ ') + text),
  plain: (text: string) => console.log(text),
};

export function spinner(text: string): Ora {
  return ora(text).start();
}
```

### 6. Docker Operations

**`src/lib/docker.ts`:**

```typescript
import Docker from 'dockerode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { CONTAINER_NAME, IMAGE_NAME } from './constants.js';
import { log, spinner } from './ui.js';

const execAsync = promisify(exec);
const docker = new Docker();

export interface ContainerStatus {
  exists: boolean;
  running: boolean;
  version?: string;
  image?: string;
  ports?: string[];
}

export async function isDockerInstalled(): Promise<boolean> {
  try {
    await execAsync('docker --version');
    return true;
  } catch {
    return false;
  }
}

export async function isDockerRunning(): Promise<boolean> {
  try {
    await docker.ping();
    return true;
  } catch {
    return false;
  }
}

export async function hasDockerPermissions(): Promise<boolean> {
  try {
    await docker.listContainers();
    return true;
  } catch {
    return false;
  }
}

export async function getContainerStatus(): Promise<ContainerStatus> {
  try {
    const container = docker.getContainer(CONTAINER_NAME);
    const info = await container.inspect();

    return {
      exists: true,
      running: info.State.Running,
      version: info.Config.Labels?.version,
      image: info.Config.Image,
      ports: Object.keys(info.NetworkSettings.Ports || {}),
    };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404) {
      return { exists: false, running: false };
    }
    throw error;
  }
}

export async function stopContainer(force = false): Promise<void> {
  const container = docker.getContainer(CONTAINER_NAME);
  
  if (force) {
    await container.kill();
  } else {
    await container.stop();
  }
}

export async function removeContainer(): Promise<void> {
  const container = docker.getContainer(CONTAINER_NAME);
  await container.remove();
}

export async function startContainer(options: {
  port: number;
  version: string;
  enableGpu: boolean;
  enableAudio: boolean;
  enableDisplay: boolean;
}): Promise<void> {
  const { port, version, enableGpu, enableAudio, enableDisplay } = options;

  const createOptions: Docker.ContainerCreateOptions = {
    name: CONTAINER_NAME,
    Image: `${IMAGE_NAME}:${version}`,
    ExposedPorts: {
      '3010/tcp': {},
    },
    HostConfig: {
      PortBindings: {
        '3010/tcp': [{ HostPort: port.toString() }],
      },
      Binds: [
        '/var/run/docker.sock:/var/run/docker.sock',
        'dillinger_root:/data',
      ],
      RestartPolicy: {
        Name: 'unless-stopped',
      },
    },
    Env: [],
  };

  // GPU passthrough
  if (enableGpu && createOptions.HostConfig) {
    createOptions.HostConfig.Devices = createOptions.HostConfig.Devices || [];
    createOptions.HostConfig.Devices.push({ PathOnHost: '/dev/dri', PathInContainer: '/dev/dri', CgroupPermissions: 'rwm' });
  }

  // X11 display passthrough
  if (enableDisplay && process.env.DISPLAY && createOptions.HostConfig && createOptions.Env) {
    createOptions.Env.push(`DISPLAY=${process.env.DISPLAY}`);
    createOptions.HostConfig.Binds?.push('/tmp/.X11-unix:/tmp/.X11-unix:rw');
    
    const xauth = process.env.XAUTHORITY || `${process.env.HOME}/.Xauthority`;
    try {
      const fs = await import('fs/promises');
      await fs.access(xauth);
      createOptions.Env.push('XAUTHORITY=/tmp/.Xauthority');
      createOptions.HostConfig.Binds?.push(`${xauth}:/tmp/.Xauthority:ro`);
    } catch {
      log.warning('No Xauthority file found - you may need: xhost +local:docker');
    }
  }

  // PulseAudio passthrough
  if (enableAudio && createOptions.HostConfig && createOptions.Env) {
    const xdgRuntime = process.env.XDG_RUNTIME_DIR || `/run/user/${process.getuid?.() || 1000}`;
    const pulseDir = `${xdgRuntime}/pulse`;
    
    try {
      const fs = await import('fs/promises');
      await fs.access(pulseDir);
      createOptions.Env.push(`XDG_RUNTIME_DIR=${xdgRuntime}`);
      createOptions.Env.push(`PULSE_SERVER=unix:${xdgRuntime}/pulse/native`);
      createOptions.HostConfig.Binds?.push(`${pulseDir}:${xdgRuntime}/pulse:rw`);
    } catch {
      log.warning(`No PulseAudio socket found at ${pulseDir}`);
    }
    
    // Sound device
    if (createOptions.HostConfig.Devices) {
      createOptions.HostConfig.Devices.push({ PathOnHost: '/dev/snd', PathInContainer: '/dev/snd', CgroupPermissions: 'rwm' });
    }
  }

  // Input devices
  if (createOptions.HostConfig?.Devices) {
    createOptions.HostConfig.Devices.push({ PathOnHost: '/dev/input', PathInContainer: '/dev/input', CgroupPermissions: 'rwm' });
  }

  const container = await docker.createContainer(createOptions);
  await container.start();
}

export async function pullImage(tag: string): Promise<void> {
  const image = `${IMAGE_NAME}:${tag}`;
  const stream = await docker.pull(image);
  
  await new Promise((resolve, reject) => {
    docker.modem.followProgress(stream, (err, res) => err ? reject(err) : resolve(res));
  });
}

export async function getContainerLogs(follow = false, tail = '100'): Promise<NodeJS.ReadableStream | string> {
  const container = docker.getContainer(CONTAINER_NAME);
  
  if (follow) {
    return container.logs({
      follow: true,
      stdout: true,
      stderr: true,
      tail,
    }) as unknown as NodeJS.ReadableStream;
  }
  
  const logs = await container.logs({
    stdout: true,
    stderr: true,
    tail,
  });
  
  return logs.toString();
}
```

### 7. Version Management

**`src/lib/version.ts`:**

```typescript
import fetch from 'node-fetch';
import semver from 'semver';
import { VERSIONING_URL, IMAGE_NAME } from './constants.js';
import Docker from 'dockerode';

const docker = new Docker();

export interface VersionInfo {
  core: string;
  script: string;
}

export async function fetchRemoteVersions(): Promise<VersionInfo | null> {
  try {
    const res = await fetch(VERSIONING_URL);
    if (!res.ok) return null;
    
    const text = await res.text();
    const lines = text.split('\n');
    
    const coreVersion = lines.find(l => l.startsWith('DILLINGER_CORE_VERSION='))?.split('=')[1]?.trim().replace(/^v/, '');
    const scriptVersion = lines.find(l => l.startsWith('DILLINGER_START_SCRIPT_VERSION='))?.split('=')[1]?.trim().replace(/^v/, '');
    
    if (!coreVersion || !scriptVersion) return null;
    
    return {
      core: coreVersion,
      script: scriptVersion,
    };
  } catch {
    return null;
  }
}

export async function getLocalImageVersion(): Promise<string | null> {
  try {
    const images = await docker.listImages({
      filters: { reference: [IMAGE_NAME] },
    });
    
    if (images.length === 0) return null;
    
    // Find the highest versioned tag
    const versionTags = images
      .flatMap(img => img.RepoTags || [])
      .filter(tag => tag.startsWith(IMAGE_NAME))
      .map(tag => tag.split(':')[1])
      .filter(tag => semver.valid(semver.coerce(tag)))
      .sort((a, b) => semver.rcompare(semver.coerce(a)!, semver.coerce(b)!));
    
    if (versionTags.length > 0) {
      return versionTags[0];
    }
    
    // Fallback: check labels
    const img = images[0];
    const inspect = await docker.getImage(img.Id).inspect();
    return inspect.Config.Labels?.version || null;
  } catch {
    return null;
  }
}

export function compareVersions(v1: string, v2: string): number {
  const clean1 = semver.coerce(v1);
  const clean2 = semver.coerce(v2);
  
  if (!clean1 || !clean2) return 0;
  
  return semver.compare(clean1, clean2);
}
```

### 8. Volume Management

**`src/lib/volumes.ts`:**

```typescript
import Docker from 'dockerode';

const docker = new Docker();

export interface VolumeInfo {
  name: string;
  driver: string;
  mountpoint: string;
  options?: Record<string, string>;
}

export async function listVolumes(filterPrefix?: string): Promise<VolumeInfo[]> {
  const result = await docker.listVolumes();
  const volumes = result.Volumes || [];
  
  return volumes
    .filter(v => !filterPrefix || v.Name.startsWith(filterPrefix))
    .map(v => ({
      name: v.Name,
      driver: v.Driver,
      mountpoint: v.Mountpoint,
      options: v.Options,
    }));
}

export async function createVolume(name: string, driver = 'local', options: Record<string, string> = {}): Promise<VolumeInfo> {
  const volume = await docker.createVolume({
    Name: name,
    Driver: driver,
    DriverOpts: options,
  });
  
  const inspect = await volume.inspect();
  
  return {
    name: inspect.Name,
    driver: inspect.Driver,
    mountpoint: inspect.Mountpoint,
    options: inspect.Options,
  };
}

export async function removeVolume(name: string, force = false): Promise<void> {
  const volume = docker.getVolume(name);
  await volume.remove({ force });
}

export async function inspectVolume(name: string): Promise<VolumeInfo> {
  const volume = docker.getVolume(name);
  const inspect = await volume.inspect();
  
  return {
    name: inspect.Name,
    driver: inspect.Driver,
    mountpoint: inspect.Mountpoint,
    options: inspect.Options,
  };
}

export async function createBindVolume(name: string, hostPath: string): Promise<VolumeInfo> {
  return createVolume(name, 'local', {
    type: 'none',
    device: hostPath,
    o: 'bind',
  });
}
```

### 9. Udev Rules Setup

**`src/lib/udev.ts`:**

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
import { access, writeFile, constants } from 'fs/promises';
import { WOLF_UDEV_RULES, UDEV_RULES_PATH } from './constants.js';
import { log } from './ui.js';

const execAsync = promisify(exec);

export async function udevRulesExist(): Promise<boolean> {
  try {
    await access(UDEV_RULES_PATH, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function installUdevRules(): Promise<void> {
  const canWrite = await checkWritePermission();
  
  if (!canWrite) {
    log.info('Installing udev rules requires root privileges');
    log.info('Running: sudo tee ...');
    
    try {
      await execAsync(`echo '${WOLF_UDEV_RULES}' | sudo tee ${UDEV_RULES_PATH} > /dev/null`);
      await execAsync('sudo udevadm control --reload-rules');
      await execAsync('sudo udevadm trigger');
      
      log.success('Wolf udev rules installed');
    } catch (error) {
      throw new Error(`Failed to install udev rules: ${error}`);
    }
  } else {
    await writeFile(UDEV_RULES_PATH, WOLF_UDEV_RULES);
    await execAsync('udevadm control --reload-rules');
    await execAsync('udevadm trigger');
    
    log.success('Wolf udev rules installed');
  }
}

async function checkWritePermission(): Promise<boolean> {
  try {
    await access('/etc/udev/rules.d', constants.W_OK);
    return true;
  } catch {
    return false;
  }
}
```

### 10. Commands

**`src/commands/start.ts`:**

```typescript
import { confirm } from '@inquirer/prompts';
import { log, spinner } from '../lib/ui.js';
import { 
  isDockerInstalled, 
  isDockerRunning, 
  hasDockerPermissions,
  getContainerStatus,
  startContainer,
  stopContainer,
  removeContainer,
  pullImage,
} from '../lib/docker.js';
import { fetchRemoteVersions, getLocalImageVersion, compareVersions } from '../lib/version.js';
import { udevRulesExist, installUdevRules } from '../lib/udev.js';
import { DEFAULT_PORT } from '../lib/constants.js';

interface StartOptions {
  port: string;
  gpu: boolean;
  audio: boolean;
  display: boolean;
  pull: boolean;
  version?: string;
}

export async function startCommand(options: StartOptions): Promise<void> {
  log.header('Dillinger Launcher');

  // Check prerequisites
  if (!await isDockerInstalled()) {
    log.error('Docker is not installed!');
    log.info('Install Docker: https://docs.docker.com/get-docker/');
    process.exit(1);
  }
  log.success('Docker is installed');

  if (!await isDockerRunning()) {
    log.error('Docker daemon is not running!');
    log.info('Start Docker with: sudo systemctl start docker');
    process.exit(1);
  }
  log.success('Docker daemon is running');

  if (!await hasDockerPermissions()) {
    log.warning('Docker permission issue detected');
    log.info('Add yourself to the docker group: sudo usermod -aG docker $USER');
    log.info('Then log out and log back in');
    process.exit(1);
  }
  log.success('Docker permissions OK');

  // Check udev rules
  if (!await udevRulesExist()) {
    log.info('Wolf udev rules not found (needed for Moonlight gamepad support)');
    const install = await confirm({ message: 'Install Wolf udev rules?', default: true });
    if (install) {
      await installUdevRules();
    }
  } else {
    log.success('Wolf udev rules installed');
  }

  // Version selection
  let targetVersion = options.version;
  
  if (!targetVersion) {
    const spin = spinner('Checking versions...');
    const remoteVersions = await fetchRemoteVersions();
    const localVersion = await getLocalImageVersion();
    spin.stop();

    if (remoteVersions) {
      log.info(`Latest on GitHub: ${remoteVersions.core}`);
    }
    
    if (localVersion) {
      log.info(`Highest local version: ${localVersion}`);
    } else {
      log.info('No local images found');
    }

    if (!localVersion && !remoteVersions) {
      log.error('No local image and cannot reach GitHub');
      process.exit(1);
    }

    if (!localVersion) {
      targetVersion = remoteVersions!.core;
      const spin2 = spinner(`Pulling ${targetVersion}...`);
      await pullImage(targetVersion);
      spin2.succeed(`Pulled version ${targetVersion}`);
    } else if (!remoteVersions) {
      targetVersion = localVersion;
      log.warning(`Cannot reach GitHub, using local version ${localVersion}`);
    } else if (compareVersions(remoteVersions.core, localVersion) > 0) {
      log.warning(`A newer version is available on GitHub!`);
      log.info(`Local: ${localVersion} → GitHub: ${remoteVersions.core}`);
      
      const upgrade = await confirm({ 
        message: `Upgrade to ${remoteVersions.core}?`, 
        default: true 
      });
      
      if (upgrade) {
        const spin2 = spinner(`Pulling ${remoteVersions.core}...`);
        await pullImage(remoteVersions.core);
        spin2.succeed(`Pulled version ${remoteVersions.core}`);
        targetVersion = remoteVersions.core;
      } else {
        targetVersion = localVersion;
      }
    } else {
      targetVersion = localVersion;
      log.success(`Using latest version ${localVersion}`);
    }
  }

  // Check existing container
  const status = await getContainerStatus();
  
  if (status.exists) {
    if (status.running) {
      log.warning('Container is already running');
      
      if (status.version !== targetVersion) {
        log.info(`Running version (${status.version}) differs from target (${targetVersion})`);
        const restart = await confirm({ 
          message: `Restart with version ${targetVersion}?`, 
          default: true 
        });
        
        if (restart) {
          const spin = spinner('Stopping container...');
          await stopContainer();
          spin.text = 'Removing old container...';
          await removeContainer();
          spin.succeed('Removed old container');
        } else {
          log.info(`Dillinger is accessible at: http://localhost:${status.ports?.[0]?.split('/')[0] || DEFAULT_PORT}`);
          return;
        }
      } else {
        log.success(`Already running version ${status.version}`);
        log.info(`Dillinger is accessible at: http://localhost:${status.ports?.[0]?.split('/')[0] || DEFAULT_PORT}`);
        return;
      }
    } else {
      log.info('Container exists but is stopped');
      
      if (status.version !== targetVersion) {
        const recreate = await confirm({ 
          message: `Remove old container and start version ${targetVersion}?`, 
          default: true 
        });
        
        if (recreate) {
          await removeContainer();
          log.success('Old container removed');
        } else {
          log.info('Keeping existing container');
          return;
        }
      }
    }
  }

  // Start container
  const spin = spinner('Starting Dillinger...');
  
  try {
    await startContainer({
      port: parseInt(options.port, 10),
      version: targetVersion,
      enableGpu: options.gpu,
      enableAudio: options.audio,
      enableDisplay: options.display,
    });
    
    spin.succeed('Dillinger started successfully!');
    
    log.header('Dillinger Started');
    log.success(`Access the web interface at: http://localhost:${options.port}`);
    log.info('Container management:');
    log.plain(`  dillinger logs       # View logs`);
    log.plain(`  dillinger logs -f    # Follow logs`);
    log.plain(`  dillinger restart    # Restart`);
    log.plain(`  dillinger stop       # Stop`);
  } catch (error) {
    spin.fail('Failed to start container');
    log.error(String(error));
    process.exit(1);
  }
}
```

**`src/commands/stop.ts`:**

```typescript
import { log, spinner } from '../lib/ui.js';
import { getContainerStatus, stopContainer, removeContainer } from '../lib/docker.js';

interface StopOptions {
  force: boolean;
}

export async function stopCommand(options: StopOptions): Promise<void> {
  const status = await getContainerStatus();
  
  if (!status.exists) {
    log.warning('Dillinger container does not exist');
    return;
  }
  
  if (!status.running) {
    log.warning('Dillinger container is not running');
    return;
  }
  
  const spin = spinner(options.force ? 'Force stopping...' : 'Stopping gracefully...');
  
  try {
    await stopContainer(options.force);
    spin.succeed('Dillinger stopped');
  } catch (error) {
    spin.fail('Failed to stop container');
    log.error(String(error));
    process.exit(1);
  }
}
```

**`src/commands/restart.ts`:**

```typescript
import { log, spinner } from '../lib/ui.js';
import { getContainerStatus, stopContainer } from '../lib/docker.js';
import Docker from 'dockerode';
import { CONTAINER_NAME } from '../lib/constants.js';

const docker = new Docker();

export async function restartCommand(): Promise<void> {
  const status = await getContainerStatus();
  
  if (!status.exists) {
    log.error('Dillinger container does not exist');
    log.info('Run: dillinger start');
    process.exit(1);
  }
  
  const spin = spinner('Restarting Dillinger...');
  
  try {
    const container = docker.getContainer(CONTAINER_NAME);
    await container.restart();
    spin.succeed('Dillinger restarted');
    log.info(`Access at: http://localhost:${status.ports?.[0]?.split('/')[0] || 3010}`);
  } catch (error) {
    spin.fail('Failed to restart container');
    log.error(String(error));
    process.exit(1);
  }
}
```

**`src/commands/status.ts`:**

```typescript
import { log } from '../lib/ui.js';
import { getContainerStatus } from '../lib/docker.js';
import chalk from 'chalk';

export async function statusCommand(): Promise<void> {
  const status = await getContainerStatus();
  
  if (!status.exists) {
    log.warning('Dillinger container does not exist');
    log.info('Run: dillinger start');
    return;
  }
  
  log.header('Dillinger Status');
  
  console.log(`${chalk.bold('State:')} ${status.running ? chalk.green('Running') : chalk.yellow('Stopped')}`);
  console.log(`${chalk.bold('Version:')} ${status.version || 'unknown'}`);
  console.log(`${chalk.bold('Image:')} ${status.image || 'unknown'}`);
  
  if (status.ports && status.ports.length > 0) {
    console.log(`${chalk.bold('Ports:')} ${status.ports.join(', ')}`);
    const webPort = status.ports.find(p => p.includes('3010'))?.split('/')[0];
    if (webPort) {
      console.log(`${chalk.bold('Web UI:')} http://localhost:${webPort}`);
    }
  }
}
```

**`src/commands/logs.ts`:**

```typescript
import { log } from '../lib/ui.js';
import { getContainerStatus, getContainerLogs } from '../lib/docker.js';

interface LogsOptions {
  follow: boolean;
  tail: string;
}

export async function logsCommand(options: LogsOptions): Promise<void> {
  const status = await getContainerStatus();
  
  if (!status.exists) {
    log.error('Dillinger container does not exist');
    process.exit(1);
  }
  
  try {
    const logs = await getContainerLogs(options.follow, options.tail);
    
    if (typeof logs === 'string') {
      console.log(logs);
    } else {
      logs.pipe(process.stdout);
    }
  } catch (error) {
    log.error(`Failed to get logs: ${error}`);
    process.exit(1);
  }
}
```

**`src/commands/update.ts`:**

```typescript
import { confirm } from '@inquirer/prompts';
import { log, spinner } from '../lib/ui.js';
import { fetchRemoteVersions, getLocalImageVersion, compareVersions } from '../lib/version.js';
import { pullImage } from '../lib/docker.js';

interface UpdateOptions {
  checkOnly: boolean;
}

export async function updateCommand(options: UpdateOptions): Promise<void> {
  const spin = spinner('Checking for updates...');
  
  const remoteVersions = await fetchRemoteVersions();
  const localVersion = await getLocalImageVersion();
  
  spin.stop();
  
  if (!remoteVersions) {
    log.error('Failed to fetch remote versions');
    process.exit(1);
  }
  
  log.info(`Latest on GitHub: ${remoteVersions.core}`);
  
  if (localVersion) {
    log.info(`Highest local version: ${localVersion}`);
  } else {
    log.info('No local images found');
  }
  
  if (!localVersion || compareVersions(remoteVersions.core, localVersion) > 0) {
    log.warning('An update is available!');
    log.info(`${localVersion || 'none'} → ${remoteVersions.core}`);
    
    if (options.checkOnly) {
      return;
    }
    
    const upgrade = await confirm({ 
      message: `Update to ${remoteVersions.core}?`, 
      default: true 
    });
    
    if (upgrade) {
      const spin2 = spinner(`Pulling ${remoteVersions.core}...`);
      await pullImage(remoteVersions.core);
      spin2.succeed(`Updated to ${remoteVersions.core}`);
      log.info('Restart Dillinger to use the new version: dillinger restart');
    }
  } else {
    log.success('You are running the latest version');
  }
}
```

**`src/commands/volume.ts`:**

```typescript
import { log } from '../lib/ui.js';
import { 
  listVolumes, 
  createVolume, 
  removeVolume, 
  inspectVolume,
  createBindVolume,
} from '../lib/volumes.js';
import chalk from 'chalk';

export const volumeCommand = {
  async list() {
    const volumes = await listVolumes('dillinger');
    
    if (volumes.length === 0) {
      log.info('No Dillinger volumes found');
      return;
    }
    
    log.header('Dillinger Volumes');
    
    for (const vol of volumes) {
      console.log(`${chalk.bold(vol.name)}`);
      console.log(`  Driver: ${vol.driver}`);
      console.log(`  Mount: ${vol.mountpoint}`);
      if (vol.options && Object.keys(vol.options).length > 0) {
        console.log(`  Options: ${JSON.stringify(vol.options)}`);
      }
      console.log();
    }
  },

  async create(name: string, options: { driver: string; option: string[] }) {
    const opts: Record<string, string> = {};
    
    for (const opt of options.option) {
      const [key, value] = opt.split('=');
      if (key && value) {
        opts[key] = value;
      }
    }
    
    try {
      const volume = await createVolume(name, options.driver, opts);
      log.success(`Volume created: ${volume.name}`);
      log.info(`Mount point: ${volume.mountpoint}`);
    } catch (error) {
      log.error(`Failed to create volume: ${error}`);
      process.exit(1);
    }
  },

  async remove(name: string, options: { force: boolean }) {
    try {
      await removeVolume(name, options.force);
      log.success(`Volume removed: ${name}`);
    } catch (error) {
      log.error(`Failed to remove volume: ${error}`);
      process.exit(1);
    }
  },

  async inspect(name: string) {
    try {
      const volume = await inspectVolume(name);
      
      log.header(`Volume: ${volume.name}`);
      console.log(`${chalk.bold('Driver:')} ${volume.driver}`);
      console.log(`${chalk.bold('Mount Point:')} ${volume.mountpoint}`);
      
      if (volume.options && Object.keys(volume.options).length > 0) {
        console.log(`${chalk.bold('Options:')}`);
        for (const [key, value] of Object.entries(volume.options)) {
          console.log(`  ${key}: ${value}`);
        }
      }
    } catch (error) {
      log.error(`Failed to inspect volume: ${error}`);
      process.exit(1);
    }
  },

  async bind(name: string, hostPath: string) {
    try {
      const volume = await createBindVolume(name, hostPath);
      log.success(`Bind volume created: ${volume.name}`);
      log.info(`Host path: ${hostPath}`);
      log.info(`Mount point: ${volume.mountpoint}`);
    } catch (error) {
      log.error(`Failed to create bind volume: ${error}`);
      process.exit(1);
    }
  },
};
```

**`src/commands/doctor.ts`:**

```typescript
import { log } from '../lib/ui.js';
import { 
  isDockerInstalled, 
  isDockerRunning, 
  hasDockerPermissions,
} from '../lib/docker.js';
import { udevRulesExist } from '../lib/udev.js';
import { access, constants } from 'fs/promises';
import chalk from 'chalk';

export async function doctorCommand(): Promise<void> {
  log.header('Dillinger System Diagnostics');
  
  let allGood = true;
  
  // Docker installation
  if (await isDockerInstalled()) {
    console.log(`${chalk.green('✓')} Docker is installed`);
  } else {
    console.log(`${chalk.red('✗')} Docker is not installed`);
    log.info('  Install: https://docs.docker.com/get-docker/');
    allGood = false;
  }
  
  // Docker daemon
  if (await isDockerRunning()) {
    console.log(`${chalk.green('✓')} Docker daemon is running`);
  } else {
    console.log(`${chalk.red('✗')} Docker daemon is not running`);
    log.info('  Start: sudo systemctl start docker');
    allGood = false;
  }
  
  // Docker permissions
  if (await hasDockerPermissions()) {
    console.log(`${chalk.green('✓')} Docker permissions OK`);
  } else {
    console.log(`${chalk.yellow('⚠')} Docker permission issue`);
    log.info('  Fix: sudo usermod -aG docker $USER');
    log.info('  Then log out and log back in');
  }
  
  // GPU availability
  try {
    await access('/dev/dri', constants.R_OK);
    console.log(`${chalk.green('✓')} GPU device found (/dev/dri)`);
  } catch {
    console.log(`${chalk.yellow('⚠')} No GPU device found`);
    log.info('  GPU passthrough will be disabled');
  }
  
  // Display server
  if (process.env.DISPLAY) {
    console.log(`${chalk.green('✓')} X11 display available (${process.env.DISPLAY})`);
  } else {
    console.log(`${chalk.yellow('⚠')} No X11 DISPLAY set`);
    log.info('  GUI games will not have display passthrough');
  }
  
  // Audio
  const xdgRuntime = process.env.XDG_RUNTIME_DIR || `/run/user/${process.getuid?.() || 1000}`;
  const pulseDir = `${xdgRuntime}/pulse`;
  
  try {
    await access(pulseDir, constants.R_OK);
    console.log(`${chalk.green('✓')} PulseAudio socket found`);
  } catch {
    console.log(`${chalk.yellow('⚠')} No PulseAudio socket found`);
    log.info('  Audio in games may not work');
  }
  
  // Udev rules
  if (await udevRulesExist()) {
    console.log(`${chalk.green('✓')} Wolf udev rules installed`);
  } else {
    console.log(`${chalk.yellow('⚠')} Wolf udev rules not installed`);
    log.info('  Moonlight gamepad support may not work');
    log.info('  Install with: dillinger start (will prompt)');
  }
  
  console.log();
  
  if (allGood) {
    log.success('All systems ready!');
  } else {
    log.warning('Some issues detected - see above for fixes');
  }
}
```

### 11. README

**`README.md`:**

```markdown
# Dillinger Launcher

A command-line interface for managing the Dillinger game library platform.

## Installation

```bash
# Global install
npm install -g dillinger-launcher

# Or with pnpm
pnpm add -g dillinger-launcher
```

## Usage

```bash
# Start Dillinger
dillinger start

# Check status
dillinger status

# View logs
dillinger logs
dillinger logs -f    # Follow mode

# Stop/restart
dillinger stop
dillinger restart

# Update to latest version
dillinger update

# Volume management
dillinger volume list
dillinger volume create my-games-volume
dillinger volume bind my-games /path/to/games
dillinger volume inspect my-games-volume
dillinger volume remove my-games-volume

# System diagnostics
dillinger doctor
```

## Options

### Start Options

- `-p, --port <port>` - Port to expose web interface (default: 3010)
- `--no-gpu` - Disable GPU passthrough
- `--no-audio` - Disable audio passthrough
- `--no-display` - Disable X11 display passthrough
- `--pull` - Always pull the latest image before starting
- `--version <version>` - Use a specific version tag

### Stop Options

- `-f, --force` - Force stop (kill immediately)

### Logs Options

- `-f, --follow` - Follow log output
- `-n, --tail <lines>` - Number of lines to show from the end (default: 100)

### Update Options

- `--check-only` - Only check for updates without installing

## Development

```bash
# Clone and install
git clone https://github.com/Thrane20/dillinger.git
cd dillinger/packages/dillinger-launcher
pnpm install

# Build
pnpm build

# Run locally
pnpm dev start

# Test built CLI
./dist/index.js --help
```

## License

MIT
```

---

## Build and Test

### Build the Package

```bash
cd /workspaces/dillinger/packages/dillinger-launcher
pnpm install
pnpm build
```

### Test Locally

```bash
# Link globally for testing
npm link

# Or use dist directly
./dist/index.js --help
./dist/index.js start
```

### Add to Workspace

Update `/workspaces/dillinger/pnpm-workspace.yaml`:

```yaml
packages:
  - 'packages/*'
  - 'packages/dillinger-launcher'  # If not already covered by packages/*
```

Update root `package.json` scripts:

```json
{
  "scripts": {
    "build:launcher": "pnpm --filter=dillinger-launcher run build",
    "dev:launcher": "pnpm --filter=dillinger-launcher run dev"
  }
}
```

---

## Publishing

### 1. Update Version

```bash
cd packages/dillinger-launcher
npm version patch  # or minor/major
```

### 2. Build and Publish

```bash
pnpm build
npm publish --access public
```

### 3. Users Can Install

```bash
npm install -g dillinger-launcher
dillinger start
```

---

## Notes

- The CLI uses `dockerode` which requires access to the Docker socket
- Some operations (like udev rule installation) may require `sudo`
- Volume bind mounts use the `local` driver with `type=none` and `o=bind` options
- Version comparison uses semantic versioning via the `semver` package
- Interactive prompts use `@inquirer/prompts` for a modern UX
