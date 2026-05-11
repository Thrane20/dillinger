import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { clearStaleNativeState, getNativeStatus, parseBindVolumeHostPath, resolveNativeCoreDataPath } from '../src/utils/native.js';

afterEach(async () => {
  const stateDir = process.env.DILLINGER_NATIVE_STATE_DIR;
  delete process.env.DILLINGER_NATIVE_STATE_DIR;
  delete process.env.DILLINGER_CORE_PATH;
  if (stateDir) {
    await fs.rm(stateDir, { recursive: true, force: true });
  }
});

describe('resolveNativeCoreDataPath', () => {
  it('uses DILLINGER_CORE_PATH when provided', async () => {
    const dataPath = await fs.mkdtemp(path.join(tmpdir(), 'dillinger-core-path-test-'));
    await fs.rm(dataPath, { recursive: true, force: true });
    process.env.DILLINGER_CORE_PATH = dataPath;

    await expect(resolveNativeCoreDataPath('missing-volume')).resolves.toBe(dataPath);
    const stat = await fs.stat(dataPath);
    expect(stat.isDirectory()).toBe(true);
  });
});

describe('parseBindVolumeHostPath', () => {
  it('returns the host device path for bind-backed local volumes', () => {
    const result = parseBindVolumeHostPath({
      Mountpoint: '/var/lib/docker/volumes/dillinger_core/_data',
      Options: {
        type: 'none',
        device: '/srv/dillinger/core',
        o: 'bind',
      },
    });

    expect(result).toBe('/srv/dillinger/core');
  });

  it('rejects Docker-managed local volumes', () => {
    const result = parseBindVolumeHostPath({
      Mountpoint: '/var/lib/docker/volumes/dillinger_core/_data',
      Options: {},
    });

    expect(result).toBeNull();
  });

  it('detects and clears stale native pid files', async () => {
    const stateDir = await fs.mkdtemp(path.join(tmpdir(), 'dillinger-native-test-'));
    process.env.DILLINGER_NATIVE_STATE_DIR = stateDir;
    await fs.writeFile(path.join(stateDir, 'core.pid'), '99999999\n', 'utf8');

    await expect(getNativeStatus()).resolves.toMatchObject({
      running: false,
      stale: true,
      pid: 99999999,
    });

    await clearStaleNativeState();

    await expect(getNativeStatus()).resolves.toMatchObject({
      running: false,
      stale: false,
    });
  });
});
