import { getConfig } from '../utils/config.js';
import { getContainerStatus, removeContainer, stopContainer } from '../utils/docker.js';
import { log } from '../utils/ui.js';

export type StopOptions = {
  remove?: boolean;
};

export async function stopCommand(options: StopOptions): Promise<void> {
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
