import { describe, expect, it } from 'vitest';
import { buildExtraRunnerMountPath, buildManagedDockerVolumeName } from '../src/utils/managed-volumes.js';

describe('buildManagedDockerVolumeName', () => {
  it('normalizes friendly names into Docker volume names', () => {
    expect(buildManagedDockerVolumeName('Screenshots SSD')).toBe('dillinger_screenshots_ssd');
  });

  it('rejects empty normalized names', () => {
    expect(() => buildManagedDockerVolumeName('***')).toThrow(/alphanumeric/i);
  });
});

describe('buildExtraRunnerMountPath', () => {
  it('maps a Docker volume name to a stable runner mount path', () => {
    expect(buildExtraRunnerMountPath('dillinger_screenshots_ssd')).toBe('/mnt/dillinger-volumes/dillinger_screenshots_ssd');
  });
});
