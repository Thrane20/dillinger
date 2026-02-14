import semver from 'semver';
import { execa } from 'execa';
import { VERSIONING_URL } from './constants.js';

export type RemoteVersions = {
  coreVersion: string;
  scriptVersion: string;
};

export async function fetchRemoteVersions(): Promise<RemoteVersions | null> {
  try {
    const response = await fetch(VERSIONING_URL);
    if (!response.ok) {
      return null;
    }

    const content = await response.text();
    const lines = content.split('\n');

    const coreVersion = lines
      .find((line) => line.startsWith('DILLINGER_CORE_VERSION='))
      ?.split('=')[1]
      ?.trim()
      .replace(/^v/, '');

    const scriptVersion = lines
      .find((line) => line.startsWith('DILLINGER_START_SCRIPT_VERSION='))
      ?.split('=')[1]
      ?.trim()
      .replace(/^v/, '');

    if (!coreVersion || !scriptVersion) {
      return null;
    }

    return { coreVersion, scriptVersion };
  } catch {
    return null;
  }
}

export function compareVersions(currentVersion: string, nextVersion: string): number {
  const current = semver.coerce(currentVersion);
  const next = semver.coerce(nextVersion);

  if (!current || !next) {
    return 0;
  }

  return semver.compare(current, next);
}

export async function getLocalImageVersion(imageName: string): Promise<string | null> {
  try {
    const { stdout } = await execa('docker', ['images', '--format', '{{.Repository}}:{{.Tag}}', imageName]);
    const refs = stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((ref) => ref.split(':')[1])
      .filter((tag): tag is string => Boolean(tag && semver.coerce(tag)));

    if (refs.length === 0) {
      return null;
    }

    refs.sort((a, b) => semver.rcompare(semver.coerce(a)!, semver.coerce(b)!));
    return refs[0] ?? null;
  } catch {
    return null;
  }
}
