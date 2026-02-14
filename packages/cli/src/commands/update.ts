import updateNotifier from 'update-notifier';
import { access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { compareVersions, fetchRemoteVersions, getLocalImageVersion } from '../utils/version.js';
import { getConfig } from '../utils/config.js';
import { ensureImage } from '../utils/docker.js';
import { log } from '../utils/ui.js';
import { confirm } from '../utils/prompts.js';

type UpdateOptions = {
  yes?: boolean;
};

function parseCliVersion(packageJsonRaw: string): string {
  const parsed = JSON.parse(packageJsonRaw) as { version: string };
  return parsed.version;
}

export async function notifyCliUpdates(packageJsonPath: string): Promise<void> {
  try {
    const configHome = process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config');
    await access(configHome, fsConstants.W_OK);

    const packageJsonRaw = await readFile(packageJsonPath, 'utf-8');
    const packageVersion = parseCliVersion(packageJsonRaw);
    updateNotifier({ pkg: { name: 'dillinger-gaming', version: packageVersion }, updateCheckInterval: 1000 * 60 * 60 * 6 }).notify();
  } catch {
    // non-blocking
  }
}

export async function updateCheckCommand(): Promise<void> {
  const config = getConfig();
  const remote = await fetchRemoteVersions();
  const localImage = await getLocalImageVersion(config.imageName);

  if (!remote) {
    log.error('Unable to fetch remote versioning.env');
    process.exit(1);
  }

  log.info(`Remote core version: ${remote.coreVersion}`);
  log.info(`Remote script version: ${remote.scriptVersion}`);
  log.info(`Local image version: ${localImage ?? 'not found'}`);

  if (!localImage || compareVersions(localImage, remote.coreVersion) < 0) {
    log.warn('Docker image update available.');
  } else {
    log.success('Docker image is up to date.');
  }
}

export async function updateApplyCommand(options: UpdateOptions): Promise<void> {
  const config = getConfig();
  const remote = await fetchRemoteVersions();

  if (!remote) {
    log.error('Unable to fetch remote versioning.env');
    process.exit(1);
  }

  const imageRef = `${config.imageName}:${remote.coreVersion}`;
  const proceed = options.yes ? true : await confirm(`Pull ${imageRef}?`, true);
  if (!proceed) {
    log.warn('Update cancelled.');
    return;
  }

  await ensureImage(imageRef);
  log.success(`Pulled ${imageRef}`);
}
