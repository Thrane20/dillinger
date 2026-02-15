import path from 'path';
import fs from 'fs/promises';
import Docker from 'dockerode';

type FirstClassVolumeCategory = 'core' | 'roms' | 'cache' | 'installed';

const FIRST_CLASS_VOLUMES = {
  core: { mountPath: '/data' },
  roms: { mountPath: '/roms' },
  cache: { mountPath: '/cache' },
};

function parseFirstClassVolume(volumeName: string): {
  category: FirstClassVolumeCategory;
  suffix?: string;
} | null {
  if (volumeName === 'dillinger_core') return { category: 'core' };
  if (volumeName === 'dillinger_roms') return { category: 'roms' };
  if (volumeName === 'dillinger_cache') return { category: 'cache' };
  const installedMatch = volumeName.match(/^dillinger_installed_(.+)$/);
  if (installedMatch) {
    return { category: 'installed', suffix: installedMatch[1] };
  }
  return null;
}

const DILLINGER_CORE_PATH = process.env.DILLINGER_CORE_PATH || '/data';
const VOLUME_METADATA_FILE = path.join(DILLINGER_CORE_PATH, 'storage', 'volume-metadata.json');
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

export interface VolumeMetadata {
  friendlyName?: string;
  storageType?: 'ssd' | 'platter' | 'archive';
}

export interface VolumeMetadataStore {
  volumes: Record<string, VolumeMetadata>;
}

export interface FirstClassDetectedVolume {
  mountPath: string;
  device: string;
  fsType: string;
  isSystem: boolean;
  friendlyName?: string;
  storageType?: 'ssd' | 'platter' | 'archive';
  dockerVolumeName?: string;
  firstClassCategory: FirstClassVolumeCategory | null;
}

export interface FirstClassStatus {
  core: { present: boolean; mountPath: string; dockerVolumeName: string };
  roms: { present: boolean; mountPath: string; dockerVolumeName: string };
  cache: { present: boolean; mountPath: string; dockerVolumeName: string };
  installed: {
    present: boolean;
    expectedPrefix: string;
    mounts: Array<{ dockerVolumeName: string; suffix: string; mountPath: string }>;
  };
}

async function getVolumeMetadata(): Promise<VolumeMetadataStore> {
  try {
    const content = await fs.readFile(VOLUME_METADATA_FILE, 'utf-8');
    const parsed = JSON.parse(content) as VolumeMetadataStore;
    return {
      volumes: parsed.volumes || {},
    };
  } catch {
    return { volumes: {} };
  }
}

function isSystemPath(mountPath: string): boolean {
  const SYSTEM_PATHS = ['/proc', '/sys', '/dev', '/run', '/etc', '/var/run', '/tmp/.X11-unix'];
  const SYSTEM_PREFIXES = ['/proc/', '/sys/', '/dev/'];
  if (SYSTEM_PATHS.includes(mountPath)) return true;
  return SYSTEM_PREFIXES.some((prefix) => mountPath.startsWith(prefix));
}

async function getMountInfoVolumeLookup(): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  try {
    const mountInfo = await fs.readFile('/proc/self/mountinfo', 'utf-8');
    for (const line of mountInfo.split('\n')) {
      if (!line.trim()) continue;
      const parts = line.split(' ');
      if (parts.length < 10) continue;
      const mountPath = parts[4];
      const separatorIndex = parts.indexOf('-');
      if (separatorIndex === -1) continue;
      const source = parts[separatorIndex + 2] || '';
      const match = source.match(/\/var\/lib\/docker\/volumes\/([^/]+)\/_data/);
      if (match) {
        result.set(mountPath, match[1]);
      }
    }
  } catch {
    // Ignore; docker volume names may be unavailable for bind mounts
  }
  return result;
}

async function getDockerVolumeNames(): Promise<Set<string>> {
  try {
    const result = await docker.listVolumes();
    const names = (result?.Volumes || []).map((v) => v.Name).filter(Boolean);
    return new Set(names);
  } catch {
    return new Set<string>();
  }
}

export async function detectFirstClassVolumes(): Promise<{
  volumes: FirstClassDetectedVolume[];
  firstClassStatus: FirstClassStatus;
}> {
  const [mountsContent, metadata, mountToVolumeName, dockerVolumeNames] = await Promise.all([
    fs.readFile('/proc/mounts', 'utf-8'),
    getVolumeMetadata(),
    getMountInfoVolumeLookup(),
    getDockerVolumeNames(),
  ]);

  const lines = mountsContent.trim().split('\n');
  const seen = new Set<string>();
  const volumes: FirstClassDetectedVolume[] = [];

  for (const line of lines) {
    const parts = line.split(' ');
    if (parts.length < 4) continue;

    const [device, mountPath, fsType] = parts;
    if (seen.has(mountPath)) continue;
    seen.add(mountPath);

    if (isSystemPath(mountPath)) continue;
    if (
      [
        'proc',
        'sysfs',
        'devpts',
        'tmpfs',
        'cgroup',
        'cgroup2',
        'securityfs',
        'pstore',
        'debugfs',
        'tracefs',
        'fusectl',
        'mqueue',
        'hugetlbfs',
        'autofs',
        'devtmpfs',
        'configfs',
        'bpf',
      ].includes(fsType)
    ) {
      continue;
    }

    const dockerVolumeName = mountToVolumeName.get(mountPath);
    const parsedFirstClass = dockerVolumeName ? parseFirstClassVolume(dockerVolumeName) : null;
    const mountPathFallbackCategory: FirstClassVolumeCategory | null =
      mountPath === '/data'
        ? 'core'
        : mountPath === '/roms'
          ? 'roms'
          : mountPath === '/cache'
            ? 'cache'
            : mountPath === '/installed' || mountPath.startsWith('/installed/')
              ? 'installed'
              : null;
    const meta = metadata.volumes[mountPath] || {};

    volumes.push({
      mountPath,
      device,
      fsType,
      isSystem: mountPath === '/data',
      friendlyName: meta.friendlyName,
      storageType: meta.storageType,
      dockerVolumeName,
      firstClassCategory: parsedFirstClass?.category ?? mountPathFallbackCategory,
    });
  }

  volumes.sort((a, b) => {
    if (a.mountPath === '/data') return -1;
    if (b.mountPath === '/data') return 1;
    return a.mountPath.localeCompare(b.mountPath);
  });

  const findByVolume = (name: string) => volumes.find((v) => v.dockerVolumeName === name);
  const findByMountPath = (mountPath: string) => volumes.find((v) => v.mountPath === mountPath);
  const installedMounts = volumes
    .filter((v) =>
      v.dockerVolumeName?.startsWith('dillinger_installed_') ||
      v.mountPath === '/installed' ||
      v.mountPath.startsWith('/installed/')
    )
    .map((v) => {
      if (v.dockerVolumeName?.startsWith('dillinger_installed_')) {
        const parsed = parseFirstClassVolume(v.dockerVolumeName);
        return {
          dockerVolumeName: v.dockerVolumeName,
          suffix: parsed?.suffix || v.mountPath.split('/')[2] || 'default',
          mountPath: v.mountPath,
        };
      }

      const fallbackSuffix = v.mountPath.split('/')[2] || 'default';
      return {
        dockerVolumeName: `bind:${v.mountPath}`,
        suffix: fallbackSuffix,
        mountPath: v.mountPath,
      };
    });

  const installedVolumeNames = Array.from(dockerVolumeNames).filter((name) =>
    name.startsWith('dillinger_installed_')
  );
  const installedVolumeNameSet = new Set(installedMounts.map((m) => m.dockerVolumeName));
  for (const volumeName of installedVolumeNames) {
    if (installedVolumeNameSet.has(volumeName)) continue;
    const parsed = parseFirstClassVolume(volumeName);
    const suffix = parsed?.suffix || volumeName.replace(/^dillinger_installed_/, '') || 'default';
    installedMounts.push({
      dockerVolumeName: volumeName,
      suffix,
      mountPath: `/installed/${suffix}`,
    });
  }

  const coreMatch = findByVolume('dillinger_core');
  const romsMatch = findByVolume('dillinger_roms');
  const cacheMatch = findByVolume('dillinger_cache');
  const corePathMatch = findByMountPath('/data');
  const romsPathMatch = findByMountPath('/roms');
  const cachePathMatch = findByMountPath('/cache');
  const coreVolumeExists = dockerVolumeNames.has('dillinger_core');
  const romsVolumeExists = dockerVolumeNames.has('dillinger_roms');
  const cacheVolumeExists = dockerVolumeNames.has('dillinger_cache');

  return {
    volumes,
    firstClassStatus: {
      core: {
        present: !!(coreMatch || corePathMatch || coreVolumeExists),
        mountPath: coreMatch?.mountPath || corePathMatch?.mountPath || FIRST_CLASS_VOLUMES.core.mountPath,
        dockerVolumeName: 'dillinger_core',
      },
      roms: {
        present: !!(romsMatch || romsPathMatch || romsVolumeExists),
        mountPath: romsMatch?.mountPath || romsPathMatch?.mountPath || FIRST_CLASS_VOLUMES.roms.mountPath,
        dockerVolumeName: 'dillinger_roms',
      },
      cache: {
        present: !!(cacheMatch || cachePathMatch || cacheVolumeExists),
        mountPath: cacheMatch?.mountPath || cachePathMatch?.mountPath || FIRST_CLASS_VOLUMES.cache.mountPath,
        dockerVolumeName: 'dillinger_cache',
      },
      installed: {
        present: installedMounts.length > 0 || installedVolumeNames.length > 0,
        expectedPrefix: 'dillinger_installed_',
        mounts: installedMounts,
      },
    },
  };
}

export async function getVolumeMetadataStore(): Promise<VolumeMetadataStore> {
  return await getVolumeMetadata();
}

export async function saveVolumeMetadataStore(data: VolumeMetadataStore): Promise<void> {
  const dir = path.dirname(VOLUME_METADATA_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(VOLUME_METADATA_FILE, JSON.stringify({ volumes: data.volumes || {} }, null, 2));
}
