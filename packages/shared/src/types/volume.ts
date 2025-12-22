import type { VersionedData } from './schema-version.js';

/**
 * Volume purpose categorization for organizing volumes
 */
export type VolumePurpose = 'installers' | 'installed' | 'roms' | 'other';

/**
 * Volume configuration for Docker volumes and bind mounts
 */
export interface Volume extends VersionedData {
  id: string;
  name: string;
  dockerVolumeName: string;
  hostPath: string;
  createdAt: string;
  type: 'docker' | 'bind';
  status: 'active' | 'error';
  lastVerified?: string;
  purpose: VolumePurpose;
}

/**
 * Index file for volumes
 */
export interface VolumesIndex extends VersionedData {
  count: number;
  lastUpdated: string;
  ids: string[];
}
