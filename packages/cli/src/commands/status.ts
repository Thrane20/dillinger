import { getConfig } from '../utils/config.js';
import { getContainerStatus } from '../utils/docker.js';
import { log } from '../utils/ui.js';

export async function statusCommand(): Promise<void> {
  const { containerName } = getConfig();
  const status = await getContainerStatus(containerName);

  if (!status.exists) {
    log.warn('Dillinger container is not created.');
    return;
  }

  log.plain(`Container: ${containerName}`);
  log.plain(`State: ${status.running ? 'running' : 'stopped'}`);
  if (status.status) {
    log.plain(`Status: ${status.status}`);
  }
  if (status.image) {
    log.plain(`Image: ${status.image}`);
  }
  if (status.uptime) {
    log.plain(`Started: ${status.uptime}`);
  }
  if (status.ports?.length) {
    log.plain(`Ports: ${status.ports.join(', ')}`);
  }
}
