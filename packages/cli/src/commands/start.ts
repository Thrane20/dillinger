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
import { createDockerVolume, listVolumes, volumeExists } from '../utils/volume.js';
import { hasUdevRulesInstalled, installUdevRules } from '../utils/udev.js';

export type StartOptions = {
  port?: string;
  detach?: boolean;
  noUpdateCheck?: boolean;
  gpu?: boolean;
  audio?: boolean;
  display?: boolean;
  input?: boolean;
  yes?: boolean;
};

/** Volumes to always ensure exist and mount into the container. */
const STANDARD_VOLUMES: Array<{ name: string; mount: string }> = [
  { name: 'dillinger_roms', mount: '/roms' },
  { name: 'dillinger_cache', mount: '/cache' },
];

/** Prefix for Wine install-root volumes. */
const INSTALLED_VOLUME_PREFIX = 'dillinger_installed_';

export function buildStartDockerArgs(
  containerName: string,
  coreVolumeName: string,
  selectedImage: string,
  hostPort: number,
  options: StartOptions,
  extraVolumes: Array<{ name: string; mount: string }> = [],
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
    `${coreVolumeName}:/data`,
    '--restart',
    'unless-stopped',
  ];

  for (const vol of extraVolumes) {
    dockerArgs.push('-v', `${vol.name}:${vol.mount}`);
  }

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

/** Ensure a standard volume exists, creating it if necessary. */
async function ensureStandardVolume(name: string): Promise<void> {
  if (!(await volumeExists(name))) {
    const spinner = createSpinner(`Creating volume ${name}...`);
    await createDockerVolume(name);
    spinner.succeed(`Created volume ${name}`);
  }
}

/** Discover all dillinger_installed_* volumes and return mount descriptors. */
async function discoverInstalledVolumes(): Promise<Array<{ name: string; mount: string }>> {
  const names = await listVolumes(INSTALLED_VOLUME_PREFIX);
  return names.map((name) => ({
    name,
    mount: `/installed/${name.slice(INSTALLED_VOLUME_PREFIX.length)}`,
  }));
}

export async function startCommand(options: StartOptions): Promise<void> {
  const config = getConfig();
  const containerName = config.containerName;
  const volumeName = config.volumeName;
  const imageName = config.imageName;
  const hostPort = Number(options.port ?? config.port);

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

  // Ensure the core volume exists.
  if (!(await volumeExists(volumeName))) {
    const volumeSpinner = createSpinner(`Creating volume ${volumeName}...`);
    await createDockerVolume(volumeName);
    volumeSpinner.succeed(`Created volume ${volumeName}`);
  }

  // Ensure standard volumes (roms, cache) exist.
  for (const vol of STANDARD_VOLUMES) {
    await ensureStandardVolume(vol.name);
  }

  // Collect all volumes to mount: standard + any existing installed roots.
  const installedVolumes = await discoverInstalledVolumes();
  const extraVolumes = [...STANDARD_VOLUMES, ...installedVolumes];

  if (installedVolumes.length > 0) {
    log.info(`Mounting ${installedVolumes.length} Wine install volume(s): ${installedVolumes.map((v) => v.name).join(', ')}`);
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

  const dockerArgs = buildStartDockerArgs(containerName, volumeName, selectedImage, hostPort, options, extraVolumes);

  const runSpinner = createSpinner('Starting Dillinger container...');
  await runContainer(dockerArgs);
  runSpinner.succeed('Dillinger started');
  log.info(`Open http://localhost:${hostPort}`);
}
