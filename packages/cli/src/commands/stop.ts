import { getConfig } from '../utils/config.js';
import { getContainerStatus, removeContainer, stopContainer } from '../utils/docker.js';
import { stopNativeCore } from '../utils/native.js';
import { log } from '../utils/ui.js';

export type StopOptions = {
  remove?: boolean;
  native?: boolean;
};

export async function stopCommand(options: StopOptions): Promise<void> {
  if (options.native) {
    const status = await stopNativeCore();
    if (!status.pid) {
      log.warn('Native Dillinger Core is not running.');
      return;
    }
    if (status.stale) {
      log.warn(`Removed stale native pid file for PID ${status.pid}.`);
      return;
    }
    log.success('Native Dillinger Core stopped.');
    return;
  }

  const { containerName } = getConfig();
  const status = await getContainerStatus(containerName);

  if (!status.exists) {
    log.warn('Container does not exist.');
    return;
  }

  if (status.running) {
    await stopContainer(containerName);
    log.success('Container stopped.');
  } else {
    log.warn('Container is already stopped.');
  }

  if (options.remove) {
    await removeContainer(containerName);
    log.success('Container removed.');
  }
}
