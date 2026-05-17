import fs from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { getConfig } from './config.js';
import { createBindVolume, volumeExists } from './volume.js';
import { getCoreBootstrapStatus, isCoreReachable } from './core-api.js';

export type ManagedVolumeStorageType = 'ssd' | 'platter' | 'archive';
export type ManagedVolumePurpose = 'core' | 'roms' | 'cache' | 'installed' | 'downloads' | 'installers';

export type ManagedVolumeRecord = {
  id: string;
  name: string;
  dockerVolumeName: string;
  hostPath: string;
  createdAt: string;
  type: 'docker' | 'bind';
  status: 'active' | 'error';
  purpose?: ManagedVolumePurpose;
  friendlyName?: string;
  storageType?: ManagedVolumeStorageType;
};

export type CreateManagedVolumeResult = {
  volume: ManagedVolumeRecord;
  dockerVolumeCreated: boolean;
  persistedVia: 'api' | 'local';
};

type ManagedVolumeMetadataStore = {
  volumes: Record<
    string,
    {
      friendlyName?: string;
      storageType?: ManagedVolumeStorageType;
      purpose?: ManagedVolumePurpose;
    }
  >;
};

export type UpsertManagedVolumeInput = {
  dockerVolumeName: string;
  hostPath: string;
  name: string;
  friendlyName?: string | null;
  storageType?: ManagedVolumeStorageType | null;
  purpose?: ManagedVolumePurpose | null;
  type?: 'docker' | 'bind';
};

export const EXTRA_RUNNER_VOLUME_ROOT = '/mnt/dillinger-volumes';

function sanitizeVolumeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function buildManagedDockerVolumeName(name: string): string {
  const slug = sanitizeVolumeSlug(name);
  if (!slug) {
    throw new Error('Volume name must contain at least one alphanumeric character.');
  }

  return `dillinger_${slug}`;
}

export function buildExtraRunnerMountPath(dockerVolumeName: string): string {
  const safeSegment = sanitizeVolumeSlug(dockerVolumeName) || 'volume';
  return path.posix.join(EXTRA_RUNNER_VOLUME_ROOT, safeSegment);
}

function getCliStateDir(): string {
  return path.join(homedir(), '.local', 'state', 'dillinger-gaming');
}

async function getLocalStorageRoot(): Promise<string> {
  const dir = path.join(getCliStateDir(), 'volumes');
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function getLocalVolumeMetadataPath(): Promise<string> {
  const dir = getCliStateDir();
  await fs.mkdir(dir, { recursive: true });
  return path.join(dir, 'volume-metadata.json');
}

async function updateLocalVolumeIndex(storageRoot: string, volumes: ManagedVolumeRecord[]): Promise<void> {
  await fs.writeFile(
    path.join(storageRoot, 'index.json'),
    JSON.stringify(
      {
        count: volumes.length,
        lastUpdated: new Date().toISOString(),
        ids: volumes.map((volume) => volume.id),
      },
      null,
      2,
    ),
    'utf8',
  );
}

async function listLocalManagedVolumes(): Promise<ManagedVolumeRecord[]> {
  const storageRoot = await getLocalStorageRoot();
  const metadata = await readLocalManagedVolumeMetadataStore();
  await fs.mkdir(storageRoot, { recursive: true });
  const entries = await fs.readdir(storageRoot, { withFileTypes: true });
  const volumes: ManagedVolumeRecord[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json') || entry.name === 'index.json') {
      continue;
    }

    const filePath = path.join(storageRoot, entry.name);
    const parsed = JSON.parse(await fs.readFile(filePath, 'utf8')) as Partial<ManagedVolumeRecord>;
    if (!parsed.id || !parsed.name || !parsed.dockerVolumeName || !parsed.hostPath) {
      continue;
    }

    volumes.push({
      id: parsed.id,
      name: parsed.name,
      dockerVolumeName: parsed.dockerVolumeName,
      hostPath: parsed.hostPath,
      createdAt: parsed.createdAt ?? new Date().toISOString(),
      type: parsed.type === 'bind' ? 'bind' : 'docker',
      status: parsed.status === 'error' ? 'error' : 'active',
      purpose: parsed.purpose,
      friendlyName: metadata.volumes[parsed.hostPath]?.friendlyName,
      storageType: metadata.volumes[parsed.hostPath]?.storageType,
    });
  }

  volumes.sort((left, right) => left.name.localeCompare(right.name));
  return volumes;
}

async function writeLocalManagedVolume(volume: ManagedVolumeRecord): Promise<void> {
  const storageRoot = await getLocalStorageRoot();
  await fs.mkdir(storageRoot, { recursive: true });
  await fs.writeFile(path.join(storageRoot, `${volume.id}.json`), JSON.stringify(volume, null, 2), 'utf8');
  await updateLocalVolumeIndex(storageRoot, await listLocalManagedVolumes());
}

async function readLocalManagedVolumeMetadataStore(): Promise<ManagedVolumeMetadataStore> {
  const metadataPath = await getLocalVolumeMetadataPath();
  try {
    const parsed = JSON.parse(await fs.readFile(metadataPath, 'utf8')) as ManagedVolumeMetadataStore;
    return { volumes: parsed.volumes ?? {} };
  } catch {
    return { volumes: {} };
  }
}

async function writeLocalManagedVolumeMetadataStore(data: ManagedVolumeMetadataStore): Promise<void> {
  const metadataPath = await getLocalVolumeMetadataPath();
  await fs.mkdir(path.dirname(metadataPath), { recursive: true });
  await fs.writeFile(metadataPath, JSON.stringify({ volumes: data.volumes ?? {} }, null, 2), 'utf8');
}

async function listManagedVolumesViaApi(): Promise<ManagedVolumeRecord[]> {
  const [volumesResponse, metadataResponse] = await Promise.all([
    fetch(`http://127.0.0.1:${getConfig().port}/api/volumes`, {
      headers: { 'content-type': 'application/json' },
    }),
    fetch(`http://127.0.0.1:${getConfig().port}/api/volumes/metadata`, {
      headers: { 'content-type': 'application/json' },
    }),
  ]);

  if (!volumesResponse.ok) {
    throw new Error(`${volumesResponse.status} ${volumesResponse.statusText}`);
  }

  const payload = (await volumesResponse.json()) as { success?: boolean; data?: ManagedVolumeRecord[]; error?: string };
  if (payload.success === false) {
    throw new Error(payload.error ?? 'Failed to load managed volumes');
  }

  const metadataPayload = metadataResponse.ok
    ? ((await metadataResponse.json()) as { success?: boolean; data?: ManagedVolumeMetadataStore })
    : null;
  const metadata = metadataPayload?.data?.volumes ?? {};

  return (payload.data ?? []).map((volume) => ({
    ...volume,
    friendlyName: metadata[volume.hostPath]?.friendlyName,
    storageType: metadata[volume.hostPath]?.storageType,
  }));
}

async function persistManagedVolumeMetadataViaApi(input: UpsertManagedVolumeInput): Promise<void> {
  const response = await fetch(`http://127.0.0.1:${getConfig().port}/api/volumes/metadata`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      mountPath: input.hostPath,
      friendlyName: input.friendlyName ?? null,
      storageType: input.storageType ?? null,
      purpose: input.purpose ?? null,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `${response.status} ${response.statusText}`);
  }
}

async function persistManagedVolumeViaApi(input: UpsertManagedVolumeInput, existingId?: string): Promise<ManagedVolumeRecord> {
  const response = await fetch(
    `http://127.0.0.1:${getConfig().port}/api/volumes${existingId ? `/${encodeURIComponent(existingId)}` : ''}`,
    {
      method: existingId ? 'PUT' : 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: input.name,
        hostPath: input.hostPath,
        type: input.type ?? 'docker',
        purpose: input.purpose ?? null,
        linkExisting: true,
        dockerVolumeName: input.dockerVolumeName,
        status: 'active',
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as { success?: boolean; data?: ManagedVolumeRecord; error?: string };
  if (payload.success === false || !payload.data) {
    throw new Error(payload.error ?? 'Failed to persist managed volume');
  }

  await persistManagedVolumeMetadataViaApi(input);
  return {
    ...payload.data,
    friendlyName: input.friendlyName ?? undefined,
    storageType: input.storageType ?? undefined,
  };
}

async function upsertLocalManagedVolume(input: UpsertManagedVolumeInput, existing?: ManagedVolumeRecord): Promise<ManagedVolumeRecord> {
  const volume: ManagedVolumeRecord = {
    id: existing?.id ?? randomUUID(),
    name: input.name.trim(),
    dockerVolumeName: input.dockerVolumeName,
    hostPath: path.resolve(input.hostPath),
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    type: input.type ?? existing?.type ?? 'docker',
    status: 'active',
    purpose: input.purpose ?? undefined,
    friendlyName: input.friendlyName ?? undefined,
    storageType: input.storageType ?? undefined,
  };

  await writeLocalManagedVolume(volume);

  const metadata = await readLocalManagedVolumeMetadataStore();
  const metadataEntry = metadata.volumes[volume.hostPath] ?? {};
  if (input.friendlyName !== undefined) {
    metadataEntry.friendlyName = input.friendlyName ?? undefined;
  }
  if (input.storageType !== undefined) {
    metadataEntry.storageType = input.storageType ?? undefined;
  }
  if (input.purpose !== undefined) {
    metadataEntry.purpose = input.purpose ?? undefined;
  }
  if (Object.values(metadataEntry).some(Boolean)) {
    metadata.volumes[volume.hostPath] = metadataEntry;
  } else {
    delete metadata.volumes[volume.hostPath];
  }
  await writeLocalManagedVolumeMetadataStore(metadata);

  return volume;
}

export async function upsertManagedVolume(input: UpsertManagedVolumeInput): Promise<{ volume: ManagedVolumeRecord; persistedVia: 'api' | 'local'; adopted: boolean }> {
  const normalizedHostPath = path.resolve(input.hostPath);
  const currentVolumes = await listManagedVolumes().catch(() => []);
  const existingManagedVolume = currentVolumes.find(
    (volume) => volume.dockerVolumeName === input.dockerVolumeName || volume.hostPath === normalizedHostPath,
  );

  const normalizedInput: UpsertManagedVolumeInput = {
    ...input,
    hostPath: normalizedHostPath,
  };

  if (await isCoreReachable()) {
    const volume = await persistManagedVolumeViaApi(normalizedInput, existingManagedVolume?.id);
    return {
      volume,
      persistedVia: 'api',
      adopted: !existingManagedVolume,
    };
  }

  const volume = await upsertLocalManagedVolume(normalizedInput, existingManagedVolume);
  return {
    volume,
    persistedVia: 'local',
    adopted: !existingManagedVolume,
  };
}

export async function listManagedVolumes(): Promise<ManagedVolumeRecord[]> {
  if (await isCoreReachable()) {
    return listManagedVolumesViaApi();
  }

  return listLocalManagedVolumes();
}

export async function createManagedBindVolume(name: string, hostPath: string): Promise<CreateManagedVolumeResult> {
  const dockerVolumeName = buildManagedDockerVolumeName(name);
  const normalizedHostPath = path.resolve(hostPath);
  const existingManagedVolume = (await listManagedVolumes().catch(() => []))
    .find((volume) => volume.dockerVolumeName === dockerVolumeName || volume.hostPath === normalizedHostPath);
  const alreadyExists = await volumeExists(dockerVolumeName);

  if (!alreadyExists) {
    await createBindVolume(dockerVolumeName, normalizedHostPath);
  }

  if (existingManagedVolume) {
    return {
      volume: existingManagedVolume,
      dockerVolumeCreated: !alreadyExists,
      persistedVia: await isCoreReachable() ? 'api' : 'local',
    };
  }

  const volume: ManagedVolumeRecord = {
    id: randomUUID(),
    name: name.trim(),
    dockerVolumeName,
    hostPath: normalizedHostPath,
    createdAt: new Date().toISOString(),
    type: 'docker',
    status: 'active',
  };

  if (await isCoreReachable()) {
    await persistManagedVolumeViaApi({
      dockerVolumeName: volume.dockerVolumeName,
      hostPath: volume.hostPath,
      name: volume.name,
      type: volume.type,
    });
    return {
      volume,
      dockerVolumeCreated: !alreadyExists,
      persistedVia: 'api',
    };
  }

  await upsertLocalManagedVolume({
    dockerVolumeName: volume.dockerVolumeName,
    hostPath: volume.hostPath,
    name: volume.name,
    type: volume.type,
  });
  return {
    volume,
    dockerVolumeCreated: !alreadyExists,
    persistedVia: 'local',
  };
}

export async function getManagedVolumePersistenceHint(): Promise<string> {
  if (await isCoreReachable()) {
    const bootstrap = await getCoreBootstrapStatus();
    return `Persisting managed volumes through Dillinger Core (${bootstrap.runtime}).`;
  }

  try {
    const storageRoot = await getLocalStorageRoot();
    return `Persisting managed volumes directly in ${storageRoot}.`;
  } catch (error) {
    return error instanceof Error ? error.message : 'Unable to resolve Dillinger Core storage.';
  }
}
