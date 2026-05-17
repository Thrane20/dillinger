import { NextResponse } from 'next/server';
import Docker from 'dockerode';
import os from 'os';
import { JSONStorageService } from '@/lib/services/storage';
import type { Volume } from '@dillinger/shared';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const storage = JSONStorageService.getInstance();

type CoreMount = {
  type: string;
  name?: string;
  source: string;
  destination: string;
  mode?: string;
  rw: boolean;
  driver?: string;
  managedVolume?: {
    id: string;
    name: string;
    dockerVolumeName: string;
    hostPath: string;
    purpose?: Volume['purpose'];
    status: Volume['status'];
  } | null;
  resolvedHostPath?: string | null;
};

type InspectMount = {
  Type?: string;
  Name?: string;
  Source?: string;
  Destination?: string;
  Mode?: string;
  RW?: boolean;
  Driver?: string;
};

type ContainerInspect = {
  Id?: string;
  Name?: string;
  Config?: {
    Hostname?: string;
    Image?: string;
  };
  Mounts?: InspectMount[];
};

function byLongestPath(volumes: Volume[]): Volume[] {
  return [...volumes].sort((left, right) => right.hostPath.length - left.hostPath.length);
}

function findManagedVolume(mount: InspectMount, volumes: Volume[]): Volume | null {
  const mountName = mount.Name || '';
  if (mountName) {
    const byDockerName = volumes.find((volume) => volume.dockerVolumeName === mountName);
    if (byDockerName) return byDockerName;
  }

  const source = mount.Source || '';
  const destination = mount.Destination || '';
  for (const volume of byLongestPath(volumes)) {
    if (
      source === volume.hostPath ||
      source.startsWith(`${volume.hostPath}/`) ||
      destination === volume.hostPath ||
      destination.startsWith(`${volume.hostPath}/`)
    ) {
      return volume;
    }
  }

  return null;
}

function resolvedHostPath(mount: InspectMount, volume: Volume | null): string | null {
  if (!volume) return mount.Source || null;
  const destination = mount.Destination || '';
  if (destination === volume.hostPath || destination.startsWith(`${volume.hostPath}/`)) {
    return volume.hostPath + destination.substring(volume.hostPath.length);
  }
  return volume.hostPath || mount.Source || null;
}

async function inspectCurrentCoreContainer(): Promise<ContainerInspect> {
  const hostname = os.hostname();

  try {
    return (await docker.getContainer(hostname).inspect()) as ContainerInspect;
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode && statusCode !== 404) {
      throw error;
    }
  }

  const containers = await docker.listContainers({ all: true });
  for (const containerInfo of containers) {
    const inspect = (await docker.getContainer(containerInfo.Id).inspect()) as ContainerInspect;
    if (inspect.Config?.Hostname === hostname) {
      return inspect;
    }
  }

  for (const containerInfo of containers) {
    const inspect = (await docker.getContainer(containerInfo.Id).inspect()) as ContainerInspect;
    const hasCoreVolume = inspect.Mounts?.some(
      (mount) => mount.Name === 'dillinger_core' && mount.Destination === '/data',
    );
    if (hasCoreVolume) {
      return inspect;
    }
  }

  throw new Error(`Could not find the running Dillinger Core container for hostname "${hostname}"`);
}

export async function GET() {
  try {
    const [inspect, volumes] = await Promise.all([
      inspectCurrentCoreContainer(),
      storage.listEntities<Volume>('volumes').catch(() => []),
    ]);

    const mounts: CoreMount[] = ((inspect.Mounts || []) as InspectMount[]).map((mount) => {
      const managed = findManagedVolume(mount, volumes);
      return {
        type: mount.Type || '',
        name: mount.Name,
        source: mount.Source || '',
        destination: mount.Destination || '',
        mode: mount.Mode,
        rw: Boolean(mount.RW),
        driver: mount.Driver,
        managedVolume: managed
          ? {
              id: managed.id,
              name: managed.name,
              dockerVolumeName: managed.dockerVolumeName,
              hostPath: managed.hostPath,
              purpose: managed.purpose,
              status: managed.status,
            }
          : null,
        resolvedHostPath: resolvedHostPath(mount, managed),
      };
    });

    mounts.sort((left, right) => left.destination.localeCompare(right.destination));

    return NextResponse.json({
      success: true,
      data: {
        container: {
          id: inspect.Id,
          name: inspect.Name?.replace(/^\//, '') || os.hostname(),
          image: inspect.Config?.Image,
        },
        mounts,
      },
    });
  } catch (error) {
    console.error('Failed to inspect Dillinger Core mounts:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to inspect Dillinger Core mounts',
      },
      { status: 500 },
    );
  }
}
