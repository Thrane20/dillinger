import { access } from 'node:fs/promises';
import { getConfig } from '../utils/config.js';
import {
  checkNetworkReachable,
  hasDockerPermissions,
  isDockerInstalled,
  isDockerRunning,
} from '../utils/docker.js';
import { verifyVolume } from '../utils/volume.js';
import { log } from '../utils/ui.js';

async function checkPath(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function printCheck(name: string, ok: boolean, hint?: string): void {
  if (ok) {
    log.success(name);
  } else {
    log.error(name);
    if (hint) {
      log.info(`  ${hint}`);
    }
  }
}

export async function doctorCommand(): Promise<void> {
  const config = getConfig();
  const dockerInstalled = await isDockerInstalled();
  const dockerRunning = dockerInstalled ? await isDockerRunning() : false;
  const dockerPerms = dockerRunning ? await hasDockerPermissions() : false;

  printCheck('Docker installed', dockerInstalled, 'Install Docker from docs.docker.com/get-docker');
  printCheck('Docker daemon running', dockerRunning, 'Start Docker service');
  printCheck('Docker permissions', dockerPerms, 'Add user to docker group');

  const gpu = await checkPath('/dev/dri');
  const pulse = Boolean(process.env.XDG_RUNTIME_DIR) && (await checkPath(`${process.env.XDG_RUNTIME_DIR}/pulse/native`));
  const display = Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);

  printCheck('GPU device available', gpu, 'GPU passthrough disabled if missing');
  printCheck('Audio socket available', pulse, 'PulseAudio may not be available');
  printCheck('Display environment available', display, 'Set DISPLAY or WAYLAND_DISPLAY');

  const volume = await verifyVolume(config.volumeName);
  printCheck('Volume integrity', volume.ok, volume.reason);

  const ghcr = await checkNetworkReachable('ghcr.io');
  printCheck('Network access to ghcr.io', ghcr, 'Check DNS/network connectivity');
}
