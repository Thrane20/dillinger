import Conf from 'conf';
import { tmpdir } from 'node:os';
import { CLI_CONFIG_NAME, DEFAULTS } from './constants.js';

export type CliConfig = {
  port: number;
  imageName: string;
  autoUpdate: boolean;
  volumeName: string;
  containerName: string;
};

function createConfigStore(): Conf<CliConfig> {
  const defaults = {
    port: DEFAULTS.port,
    imageName: DEFAULTS.imageName,
    autoUpdate: DEFAULTS.autoUpdate,
    volumeName: DEFAULTS.volumeName,
    containerName: DEFAULTS.containerName,
  };

  try {
    return new Conf<CliConfig>({
      projectName: CLI_CONFIG_NAME,
      defaults,
    });
  } catch {
    return new Conf<CliConfig>({
      projectName: CLI_CONFIG_NAME,
      cwd: tmpdir(),
      defaults,
    });
  }
}

const config = createConfigStore();

export function getConfig(): CliConfig {
  return {
    port: config.get('port'),
    imageName: config.get('imageName'),
    autoUpdate: config.get('autoUpdate'),
    volumeName: config.get('volumeName'),
    containerName: config.get('containerName'),
  };
}

export function setConfigValue<K extends keyof CliConfig>(key: K, value: CliConfig[K]): void {
  config.set(key, value);
}

export function resetConfig(): void {
  config.clear();
}

export function configPath(): string {
  return config.path;
}
