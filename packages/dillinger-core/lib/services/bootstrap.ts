import fs from 'fs-extra';
import path from 'path';

import { JSONStorageService } from './storage';
import { SettingsService } from './settings';

const DEFAULT_DOWNLOAD_STATE = {
  activeDownloads: [],
  queue: [],
  cancelled: [],
};

const BOOTSTRAP_MARKER_RELATIVE_PATH = path.join('storage', '.dillinger_bootstrap_complete');

export async function ensureDillingerCoreScaffold(): Promise<void> {
  const storage = JSONStorageService.getInstance();
  await storage.ensureDirectories();

  const dillingerCorePath = storage.getDillingerCorePath();

  await Promise.all([
    fs.ensureDir(path.join(dillingerCorePath, 'bios')),
    fs.ensureDir(path.join(dillingerCorePath, 'logs')),
    fs.ensureDir(path.join(dillingerCorePath, 'saves')),
    fs.ensureDir(path.join(dillingerCorePath, 'storage', 'cache')),
    fs.ensureDir(path.join(dillingerCorePath, 'storage', 'installer_cache')),
    fs.ensureDir(path.join(dillingerCorePath, 'storage', 'online-sources')),
    fs.ensureDir(path.join(dillingerCorePath, 'storage', 'platform-configs', 'arcade')),
  ]);

  // Ensure settings.json exists (and is valid JSON).
  await SettingsService.getInstance().initialize();

  // Ensure download-state.json exists so the UI can rely on it being present.
  const downloadStatePath = path.join(dillingerCorePath, 'storage', 'download-state.json');
  if (!(await fs.pathExists(downloadStatePath))) {
    await fs.writeJson(downloadStatePath, DEFAULT_DOWNLOAD_STATE, { spaces: 2 });
  }

  // Seed RetroArch master config if missing.
  // The template is baked into the image at packages/dillinger-core/assets/defaults/retroarch.cfg.
  const retroarchConfigPath = path.join(
    dillingerCorePath,
    'storage',
    'platform-configs',
    'arcade',
    'retroarch.cfg'
  );

  const shouldSeedRetroarch = await (async () => {
    if (!(await fs.pathExists(retroarchConfigPath))) return true;
    try {
      const stats = await fs.stat(retroarchConfigPath);
      return stats.size === 0;
    } catch {
      return true;
    }
  })();

  if (shouldSeedRetroarch) {
    // In standalone mode, process.cwd() is already /app/packages/dillinger-core
    const templatePath = path.resolve(
      process.cwd(),
      'assets',
      'defaults',
      'retroarch.cfg'
    );

    await fs.ensureDir(path.dirname(retroarchConfigPath));

    if (await fs.pathExists(templatePath)) {
      await fs.copy(templatePath, retroarchConfigPath, { overwrite: true });
    } else {
      // Fallback: keep the file present even if the template wasn't bundled.
      await fs.writeFile(retroarchConfigPath, '', 'utf8');
    }
  }

  // NOTE: Platform configs are now read directly from bundled defaults at runtime,
  // with user overrides in /data/storage/platforms/ taking precedence.
  // No seeding is needed - this ensures upgrades automatically get new platform configs.

  // Write an explicit marker so the UI can reliably detect completion even if
  // other services create directories like /data/logs during startup.
  const markerPath = path.join(dillingerCorePath, BOOTSTRAP_MARKER_RELATIVE_PATH);
  await fs.ensureDir(path.dirname(markerPath));
  await fs.writeFile(markerPath, new Date().toISOString(), 'utf8');
}

export function getScaffoldPreview(): { directories: string[]; files: string[] } {
  // Paths are relative to DILLINGER_CORE_PATH (typically /data in the container)
  return {
    directories: [
      'storage/games',
      'storage/platforms', // For user overrides only; defaults are read from bundled assets
      'storage/sessions',
      'storage/collections',
      'storage/metadata',
      'storage/volumes',
      'storage/cache',
      'storage/installer_cache',
      'storage/online-sources',
      'storage/platform-configs/arcade',
      'bios',
      'logs',
      'saves',
    ],
    files: [
      'storage/settings.json',
      'storage/download-state.json',
      'storage/platform-configs/arcade/retroarch.cfg',
      // Note: Platform configs are now read from bundled defaults; user overrides go in storage/platforms/
    ],
  };
}

export async function isDillingerCoreInitialized(): Promise<boolean> {
  const storage = JSONStorageService.getInstance();
  const dillingerCorePath = storage.getDillingerCorePath();

  const markerPath = path.join(dillingerCorePath, BOOTSTRAP_MARKER_RELATIVE_PATH);
  return fs.pathExists(markerPath);
}

export async function ensureDillingerRootScaffold(): Promise<void> {
  return ensureDillingerCoreScaffold();
}

export async function isDillingerRootInitialized(): Promise<boolean> {
  return isDillingerCoreInitialized();
}
