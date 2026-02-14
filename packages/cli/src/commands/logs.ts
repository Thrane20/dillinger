import { getConfig } from '../utils/config.js';
import { getContainerStatus, streamLogs } from '../utils/docker.js';
import { log } from '../utils/ui.js';

export type LogsOptions = {
  follow?: boolean;
  tail?: string;
};

export async function logsCommand(options: LogsOptions): Promise<void> {
  const { containerName } = getConfig();
  const status = await getContainerStatus(containerName);

  if (!status.exists) {
    log.error('Dillinger container does not exist.');
    process.exit(1);
  }

  await streamLogs(containerName, Boolean(options.follow), options.tail ?? '100');
}
