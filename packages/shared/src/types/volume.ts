import type { VersionedData } from './schema-version.js';

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
}

/**
 * Index file for volumes
 */
export interface VolumesIndex extends VersionedData {
  count: number;
  lastUpdated: string;
  ids: string[];
}
