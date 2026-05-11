import { getConfig } from '../utils/config.js';
import { stopCommand } from './stop.js';
import { startCommand } from './start.js';

export type RestartOptions = {
  native?: boolean;
};

export async function restartCommand(options: RestartOptions = {}): Promise<void> {
  const { port } = getConfig();
  if (options.native) {
    await stopCommand({ native: true });
    await startCommand({ port: String(port), detach: true, native: true });
    return;
  }

  await stopCommand({ remove: true });
  await startCommand({ port: String(port), detach: true });
}
