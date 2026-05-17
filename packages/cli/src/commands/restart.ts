import { getConfig } from '../utils/config.js';
import { stopCommand } from './stop.js';
import { startCommand } from './start.js';

export async function restartCommand(): Promise<void> {
  const { port } = getConfig();
  await stopCommand({ remove: true });
  await startCommand({ port: String(port), detach: true });
}
