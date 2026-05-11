import { createSpinner, log } from '../utils/ui.js';
import {
  ensureImage,
  getContainerStatus,
  hasDockerPermissions,
  isDockerInstalled,
  isDockerRunning,
  removeContainer,
  runContainer,
} from '../utils/docker.js';
import { getConfig } from '../utils/config.js';
import { compareVersions, fetchRemoteVersions, getLocalImageVersion } from '../utils/version.js';
import { confirm } from '../utils/prompts.js';
import { createDockerVolume, volumeExists } from '../utils/volume.js';
import { hasUdevRulesInstalled, installUdevRules } from '../utils/udev.js';
import { startNativeCore } from '../utils/native.js';

export type StartOptions = {
  port?: string;
  detach?: boolean;
  noUpdateCheck?: boolean;
  gpu?: boolean;
  audio?: boolean;
  display?: boolean;
  input?: boolean;
  yes?: boolean;
  native?: boolean;
};

export function buildStartDockerArgs(
  containerName: string,
  volumeName: string,
  selectedImage: string,
  hostPort: number,
  options: StartOptions,
): string[] {
  const dockerArgs = [
    'run',
    '--name',
    containerName,
    '-p',
    `${hostPort}:3010`,
    '-v',
    '/var/run/docker.sock:/var/run/docker.sock',
    '-v',
    `${volumeName}:/data`,
    '--restart',
    'unless-stopped',
  ];

  if (options.gpu !== false) {
    dockerArgs.push('--device', '/dev/dri:/dev/dri');
  }

  if (options.input !== false) {
    dockerArgs.push('--device', '/dev/input:/dev/input');
  }

  if (options.audio !== false) {
    dockerArgs.push('--device', '/dev/snd:/dev/snd');
    dockerArgs.push('-e', `XDG_RUNTIME_DIR=${process.env.XDG_RUNTIME_DIR ?? ''}`);
    dockerArgs.push('-e', `PULSE_SERVER=${process.env.PULSE_SERVER ?? ''}`);
  }

  if (options.display !== false) {
    dockerArgs.push('-v', '/tmp/.X11-unix:/tmp/.X11-unix:rw');
    dockerArgs.push('-e', `DISPLAY=${process.env.DISPLAY ?? ':0'}`);

    if (process.env.XAUTHORITY) {
      dockerArgs.push('-v', `${process.env.XAUTHORITY}:/tmp/.Xauthority:ro`, '-e', 'XAUTHORITY=/tmp/.Xauthority');
    }
  }

  if (options.detach !== false) {
    dockerArgs.push('-d');
  }

  dockerArgs.push(selectedImage);
  return dockerArgs;
}

export async function startCommand(options: StartOptions): Promise<void> {
  const config = getConfig();
  const containerName = config.containerName;
  const volumeName = config.volumeName;
  const imageName = config.imageName;
  const hostPort = Number(options.port ?? config.port);

  if (options.native) {
    if (!Number.isInteger(hostPort) || hostPort <= 0) {
      log.error(`Invalid port: ${options.port ?? config.port}`);
      process.exit(1);
    }

    try {
      const status = await startNativeCore({ port: hostPort, volumeName });
      if (status.started) {
        log.success('Dillinger Core native runtime started');
      } else {
        log.warn('Dillinger Core native runtime was already running.');
      }
      log.info(`Data: ${status.dataPath ?? 'unknown'}`);
      log.info(`PID: ${status.pid ?? 'unknown'}`);
      log.info(`Logs: ${status.logFile}`);
      log.info(`Open http://localhost:${status.port ?? hostPort}`);
      if (status.runtime && !status.runtime.hasBundledNode) {
        log.warn('Using the current Node.js runtime because the native artifact does not include node/bin/node.');
      }
      return;
    } catch (error) {
      log.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  if (!(await isDockerInstalled())) {
    log.error('Docker is not installed.');
    process.exit(1);
  }
  if (!(await isDockerRunning())) {
    log.error('Docker daemon is not running.');
    process.exit(1);
  }
  if (!(await hasDockerPermissions())) {
    log.error('Docker permissions are missing for this user.');
    process.exit(1);
  }

  const udevInstalled = await hasUdevRulesInstalled();
  if (!udevInstalled) {
    const shouldInstall = await confirm('Install Wolf udev rules now?', true);
    if (shouldInstall) {
      await installUdevRules();
      log.success('Installed Wolf udev rules.');
    }
  }

  if (!(await volumeExists(volumeName))) {
    const volumeSpinner = createSpinner(`Creating volume ${volumeName}...`);
    await createDockerVolume(volumeName);
    volumeSpinner.succeed(`Created volume ${volumeName}`);
  }

  const status = await getContainerStatus(containerName);
  if (status.running) {
    log.warn(`Container ${containerName} is already running.`);
    return;
  }
  if (status.exists) {
    await removeContainer(containerName);
  }

  let selectedImage = `${imageName}:latest`;

  if (!options.noUpdateCheck) {
    const remote = await fetchRemoteVersions();
    const local = await getLocalImageVersion(imageName);

    if (remote?.coreVersion) {
      selectedImage = `${imageName}:${remote.coreVersion}`;

      if (local && compareVersions(local, remote.coreVersion) < 0) {
        const shouldUpdate = await confirm(
          `New image ${remote.coreVersion} found (local ${local}). Pull now?`,
          true,
        );
        if (!shouldUpdate && local) {
          selectedImage = `${imageName}:${local}`;
        }
      }
    } else if (local) {
      selectedImage = `${imageName}:${local}`;
    }
  }

  const pullSpinner = createSpinner(`Pulling ${selectedImage}...`);
  await ensureImage(selectedImage);
  pullSpinner.succeed(`Pulled ${selectedImage}`);

  const dockerArgs = buildStartDockerArgs(containerName, volumeName, selectedImage, hostPort, options);

  const runSpinner = createSpinner('Starting Dillinger container...');
  await runContainer(dockerArgs);
  runSpinner.succeed('Dillinger started');
  log.info(`Open http://localhost:${hostPort}`);
}
