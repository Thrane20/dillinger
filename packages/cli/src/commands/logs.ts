import { getConfig } from '../utils/config.js';
import { getContainerStatus, streamLogs } from '../utils/docker.js';
import { streamNativeLogs } from '../utils/native.js';
import { log } from '../utils/ui.js';

export type LogsOptions = {
  follow?: boolean;
  tail?: string;
  native?: boolean;
};

export async function logsCommand(options: LogsOptions): Promise<void> {
  if (options.native) {
    await streamNativeLogs({ follow: Boolean(options.follow), tail: options.tail ?? '100' });
    return;
  }

  const { containerName } = getConfig();
  const status = await getContainerStatus(containerName);

  if (!status.exists) {
    log.error('Dillinger container does not exist.');
    process.exit(1);
  }

  await streamLogs(containerName, Boolean(options.follow), options.tail ?? '100');
}
