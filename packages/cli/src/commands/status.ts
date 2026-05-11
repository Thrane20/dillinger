import { getConfig } from '../utils/config.js';
import { getContainerStatus } from '../utils/docker.js';
import { clearStaleNativeState, getNativeStatus } from '../utils/native.js';
import { log } from '../utils/ui.js';

export type StatusOptions = {
  native?: boolean;
};

export async function statusCommand(options: StatusOptions = {}): Promise<void> {
  if (options.native) {
    const status = await getNativeStatus();
    if (status.stale) {
      await clearStaleNativeState();
      log.warn(`Native Dillinger Core had a stale pid file for PID ${status.pid}.`);
      return;
    }
    if (!status.running) {
      log.warn('Native Dillinger Core is not running.');
      log.plain(`PID file: ${status.pidFile}`);
      log.plain(`Logs: ${status.logFile}`);
      return;
    }

    log.plain('Runtime: native');
    log.plain(`State: running`);
    log.plain(`PID: ${status.pid}`);
    if (status.port) log.plain(`Port: ${status.port}`);
    if (status.dataPath) log.plain(`Data: ${status.dataPath}`);
    if (status.startedAt) log.plain(`Started: ${status.startedAt}`);
    log.plain(`Logs: ${status.logFile}`);
    return;
  }

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
