/**
 * Server-side utility for resolving volume defaults to actual filesystem paths.
 * This is used by backend services like the DownloadManager to determine
 * where to save files based on user-configured volume preferences.
 */

import { JSONStorageService } from './storage';
import type { Volume } from '@dillinger/shared';

export interface VolumeDefaults {
  defaults: {
    installers: string;
    downloads: string;
    installed: string;
    roms: string;
  };
  volumeMetadata: Record<string, {
    storageType?: 'ssd' | 'platter' | 'archive';
  }>;
}

export type DefaultType = 'installers' | 'downloads' | 'installed' | 'roms';

/**
 * Get the current volume defaults configuration
 */
export async function getVolumeDefaults(): Promise<VolumeDefaults> {
  return {
    defaults: {
      installers: '/cache',
      downloads: '/cache',
      installed: '/installed',
      roms: '/roms',
    },
    volumeMetadata: {},
  };
}

/**
 * Get a volume by its ID
 */
export async function getVolumeById(volumeId: string): Promise<Volume | null> {
  const storage = JSONStorageService.getInstance();
  try {
    const volume = await storage.readEntity<Volume>('volumes', volumeId);
    return volume || null;
  } catch {
    return null;
  }
}

/**
 * Resolve a default type to the actual host path of the configured volume.
 * Returns the fallback path if no default is configured.
 * 
 * @param defaultType - The type of default to resolve (installers, downloads, installed, roms)
 * @param fallbackPath - The path to use if no default is configured
 * @returns The resolved host path
 */
export async function resolveDefaultPath(
  defaultType: DefaultType,
  fallbackPath: string
): Promise<string> {
  const defaults = await getVolumeDefaults();
  return defaults.defaults[defaultType] || fallbackPath;
}

/**
 * Get the default volume info for a specific purpose.
 * Returns both the volume ID and the volume object if found.
 */
export async function getDefaultVolume(
  defaultType: DefaultType
): Promise<{ volumeId: string | null; volume: Volume | null }> {
  const defaults = await getVolumeDefaults();
  return {
    volumeId: defaults.defaults[defaultType] || null,
    volume: null,
  };
}

/**
 * Get all configured volumes
 */
export async function getAllVolumes(): Promise<Volume[]> {
  const storage = JSONStorageService.getInstance();
  try {
    return await storage.listEntities<Volume>('volumes');
  } catch {
    return [];
  }
}
