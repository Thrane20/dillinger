import { getConfig, resetConfig, setConfigValue, type CliConfig, configPath } from '../utils/config.js';
import { log } from '../utils/ui.js';

export function configShowCommand(): void {
  const config = getConfig();
  log.info(`Config file: ${configPath()}`);
  log.plain(JSON.stringify(config, null, 2));
}

export function configSetCommand(key: string, value: string): void {
  const current = getConfig();
  if (!(key in current)) {
    log.error(`Unknown config key: ${key}`);
    process.exit(1);
  }

  const typedKey = key as keyof CliConfig;
  let parsedValue: string | number | boolean = value;

  if (typedKey === 'port') {
    parsedValue = Number(value);
    if (!Number.isFinite(parsedValue) || parsedValue < 1 || parsedValue > 65535) {
      log.error('port must be a valid TCP port');
      process.exit(1);
    }
  }

  if (typedKey === 'autoUpdate') {
    parsedValue = value === 'true';
  }

  setConfigValue(typedKey, parsedValue as never);
  log.success(`Updated ${typedKey}`);
}

export function configResetCommand(): void {
  resetConfig();
  log.success('Config reset to defaults');
}
