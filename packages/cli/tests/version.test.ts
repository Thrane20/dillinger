import { afterEach, describe, expect, it, vi } from 'vitest';
import { compareVersions, fetchRemoteVersions } from '../src/utils/version.js';

describe('compareVersions', () => {
  it('returns negative when current is lower', () => {
    expect(compareVersions('0.3.0', '0.3.1')).toBeLessThan(0);
  });

  it('returns positive when current is higher', () => {
    expect(compareVersions('0.3.2', '0.3.1')).toBeGreaterThan(0);
  });
});

describe('fetchRemoteVersions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses versioning.env content', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      text: async () => 'DILLINGER_CORE_VERSION=0.3.1\nDILLINGER_START_SCRIPT_VERSION=0.3.0\n',
    } as Response);

    const result = await fetchRemoteVersions();

    expect(result).toEqual({
      coreVersion: '0.3.1',
      scriptVersion: '0.3.0',
    });
  });
});
