import { confirm } from '../utils/prompts.js';
import { hasUdevRulesInstalled, installUdevRules } from '../utils/udev.js';
import { log } from '../utils/ui.js';

export async function udevCommand(options: { yes?: boolean }): Promise<void> {
  const installed = await hasUdevRulesInstalled();
  if (installed) {
    log.success('Wolf udev rules already installed');
    return;
  }

  const proceed = options.yes ? true : await confirm('Install Wolf udev rules?', true);
  if (!proceed) {
    log.warn('Skipped udev rules installation');
    return;
  }

  await installUdevRules();
  log.success('Wolf udev rules installed and reloaded');
}
