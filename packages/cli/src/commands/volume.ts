import { confirm } from '../utils/prompts.js';
import { getConfig } from '../utils/config.js';
import {
  backupVolume,
  createBindVolume,
  createDockerVolume,
  listVolumes,
  removeVolume,
  restoreVolume,
  verifyVolume,
} from '../utils/volume.js';
import { log } from '../utils/ui.js';

export async function volumeCreateCommand(options: { bind?: string }): Promise<void> {
  const { volumeName } = getConfig();

  if (options.bind) {
    await createBindVolume(volumeName, options.bind);
    log.success(`Created bind volume ${volumeName} -> ${options.bind}`);
    return;
  }

  await createDockerVolume(volumeName);
  log.success(`Created volume ${volumeName}`);
}

export async function volumeVerifyCommand(): Promise<void> {
  const { volumeName } = getConfig();
  const result = await verifyVolume(volumeName);
  if (result.ok) {
    log.success(`Volume ${volumeName} verified.`);
    return;
  }
  log.error(`Volume verification failed: ${result.reason ?? 'unknown reason'}`);
  process.exit(1);
}

export async function volumeBackupCommand(file: string): Promise<void> {
  const { volumeName } = getConfig();
  await backupVolume(volumeName, file);
  log.success(`Backed up ${volumeName} to ${file}`);
}

export async function volumeRestoreCommand(file: string): Promise<void> {
  const { volumeName } = getConfig();
  await restoreVolume(volumeName, file);
  log.success(`Restored ${volumeName} from ${file}`);
}

export async function volumeDestroyCommand(options: { force?: boolean }): Promise<void> {
  const { volumeName } = getConfig();
  const ok = options.force ? true : await confirm(`Remove volume ${volumeName}?`, false);
  if (!ok) {
    log.warn('Volume removal cancelled.');
    return;
  }

  await removeVolume(volumeName);
  log.success(`Removed ${volumeName}`);
}

export async function volumeListCommand(): Promise<void> {
  const volumes = await listVolumes('dillinger');
  if (volumes.length === 0) {
    log.warn('No dillinger volumes found.');
    return;
  }

  for (const name of volumes) {
    log.plain(name);
  }
}
