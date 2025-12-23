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

export async function ensureDillingerRootScaffold(): Promise<void> {
  const storage = JSONStorageService.getInstance();
  await storage.ensureDirectories();

  const dillingerRoot = storage.getDillingerRoot();

  await Promise.all([
    fs.ensureDir(path.join(dillingerRoot, 'bios')),
    fs.ensureDir(path.join(dillingerRoot, 'logs')),
    fs.ensureDir(path.join(dillingerRoot, 'saves')),
    fs.ensureDir(path.join(dillingerRoot, 'storage', 'cache')),
    fs.ensureDir(path.join(dillingerRoot, 'storage', 'installer_cache')),
    fs.ensureDir(path.join(dillingerRoot, 'storage', 'online-sources')),
    fs.ensureDir(path.join(dillingerRoot, 'storage', 'platform-configs', 'arcade')),
  ]);

  // Ensure settings.json exists (and is valid JSON).
  await SettingsService.getInstance().initialize();

  // Ensure download-state.json exists so the UI can rely on it being present.
  const downloadStatePath = path.join(dillingerRoot, 'storage', 'download-state.json');
  if (!(await fs.pathExists(downloadStatePath))) {
    await fs.writeJson(downloadStatePath, DEFAULT_DOWNLOAD_STATE, { spaces: 2 });
  }

  // Seed RetroArch master config if missing.
  // The template is baked into the image at packages/dillinger-core/assets/defaults/retroarch.cfg.
  const retroarchConfigPath = path.join(
    dillingerRoot,
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
    const templatePath = path.resolve(
      process.cwd(),
      'packages',
      'dillinger-core',
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

  // Seed default platform configurations if the platforms directory is empty.
  // Platform configs define how to launch games for each platform (Wine, VICE, RetroArch, etc.)
  await seedPlatformConfigs(dillingerRoot);

  // Write an explicit marker so the UI can reliably detect completion even if
  // other services create directories like /data/logs during startup.
  const markerPath = path.join(dillingerRoot, BOOTSTRAP_MARKER_RELATIVE_PATH);
  await fs.ensureDir(path.dirname(markerPath));
  await fs.writeFile(markerPath, new Date().toISOString(), 'utf8');
}

/**
 * Seed default platform configurations from bundled templates.
 * Only seeds platforms that don't already exist in the user's storage.
 */
async function seedPlatformConfigs(dillingerRoot: string): Promise<void> {
  const platformsDir = path.join(dillingerRoot, 'storage', 'platforms');
  await fs.ensureDir(platformsDir);

  // Path to bundled platform configs (baked into Docker image under assets/defaults)
  const templateDir = path.resolve(
    process.cwd(),
    'packages',
    'dillinger-core',
    'assets',
    'defaults',
    'platforms'
  );

  if (!(await fs.pathExists(templateDir))) {
    console.warn('Platform templates not found at:', templateDir);
    return;
  }

  try {
    const templateFiles = await fs.readdir(templateDir);
    const jsonFiles = templateFiles.filter(f => f.endsWith('.json'));

    for (const file of jsonFiles) {
      const destPath = path.join(platformsDir, file);
      
      // Only seed if the platform config doesn't already exist
      if (!(await fs.pathExists(destPath))) {
        const srcPath = path.join(templateDir, file);
        await fs.copy(srcPath, destPath);
        console.log(`Seeded platform config: ${file}`);
      }
    }
  } catch (error) {
    console.error('Error seeding platform configs:', error);
  }
}

export function getScaffoldPreview(): { directories: string[]; files: string[] } {
  // Paths are relative to DILLINGER_ROOT (typically /data in the container)
  return {
    directories: [
      'storage/games',
      'storage/platforms',
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
      'storage/platforms/*.json (default platform configs)',
    ],
  };
}

export async function isDillingerRootInitialized(): Promise<boolean> {
  const storage = JSONStorageService.getInstance();
  const dillingerRoot = storage.getDillingerRoot();

  const markerPath = path.join(dillingerRoot, BOOTSTRAP_MARKER_RELATIVE_PATH);
  return fs.pathExists(markerPath);
}
