/**
 * Server-side utility for resolving volume defaults to actual filesystem paths.
 * This is used by backend services like the DownloadManager to determine
 * where to save files based on user-configured volume preferences.
 */

import path from 'path';
import fs from 'fs/promises';
import { JSONStorageService } from './storage';
import type { Volume } from '@dillinger/shared';

export interface VolumeDefaults {
  defaults: {
    installers: string | null;
    downloads: string | null;
    installed: string | null;
    roms: string | null;
  };
  volumeMetadata: Record<string, {
    storageType?: 'ssd' | 'platter' | 'archive';
  }>;
}

export type DefaultType = 'installers' | 'downloads' | 'installed' | 'roms';

const DILLINGER_ROOT = process.env.DILLINGER_ROOT || '/data';
const DEFAULTS_FILE = path.join(DILLINGER_ROOT, 'storage', 'volume-defaults.json');

/**
 * Get the current volume defaults configuration
 */
export async function getVolumeDefaults(): Promise<VolumeDefaults> {
  try {
    const content = await fs.readFile(DEFAULTS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    // Return empty defaults if file doesn't exist
    return {
      defaults: {
        installers: null,
        downloads: null,
        installed: null,
        roms: null,
      },
      volumeMetadata: {},
    };
  }
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
  try {
    const defaults = await getVolumeDefaults();
    const volumeId = defaults.defaults[defaultType];
    
    if (!volumeId) {
      return fallbackPath;
    }
    
    const volume = await getVolumeById(volumeId);
    if (!volume) {
      console.warn(`[VolumeDefaults] Volume ${volumeId} not found for ${defaultType}, using fallback`);
      return fallbackPath;
    }
    
    return volume.hostPath;
  } catch (error) {
    console.error(`[VolumeDefaults] Error resolving ${defaultType} path:`, error);
    return fallbackPath;
  }
}

/**
 * Get the default volume info for a specific purpose.
 * Returns both the volume ID and the volume object if found.
 */
export async function getDefaultVolume(
  defaultType: DefaultType
): Promise<{ volumeId: string | null; volume: Volume | null }> {
  try {
    const defaults = await getVolumeDefaults();
    const volumeId = defaults.defaults[defaultType];
    
    if (!volumeId) {
      return { volumeId: null, volume: null };
    }
    
    const volume = await getVolumeById(volumeId);
    return { volumeId, volume };
  } catch (error) {
    console.error(`[VolumeDefaults] Error getting ${defaultType} volume:`, error);
    return { volumeId: null, volume: null };
  }
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
