import { execa } from 'execa';

export type ContainerStatus = {
  exists: boolean;
  running: boolean;
  status?: string;
  image?: string;
  ports?: string[];
  uptime?: string;
};

export type DockerVolumeStatus = {
  name: string;
  driver: string;
  mountpoint: string;
  hostPath: string | null;
  isBind: boolean;
};

export async function isDockerInstalled(): Promise<boolean> {
  try {
    await execa('docker', ['--version']);
    return true;
  } catch {
    return false;
  }
}

export async function isDockerRunning(): Promise<boolean> {
  try {
    await execa('docker', ['info']);
    return true;
  } catch {
    return false;
  }
}

export async function hasDockerPermissions(): Promise<boolean> {
  try {
    await execa('docker', ['ps']);
    return true;
  } catch {
    return false;
  }
}

export async function containerExists(containerName: string): Promise<boolean> {
  try {
    await execa('docker', ['inspect', containerName]);
    return true;
  } catch {
    return false;
  }
}

export async function getContainerStatus(containerName: string): Promise<ContainerStatus> {
  const exists = await containerExists(containerName);
  if (!exists) {
    return { exists: false, running: false };
  }

  const format = [
    '{{.State.Running}}',
    '{{.State.Status}}',
    '{{.Config.Image}}',
    '{{.State.StartedAt}}',
    '{{json .NetworkSettings.Ports}}',
  ].join('|');

  const { stdout } = await execa('docker', ['inspect', '--format', format, containerName]);
  const [runningRaw, statusRaw, image, startedAtRaw, portsRaw] = stdout.split('|');
  const running = runningRaw === 'true';
  const portsObj = JSON.parse(portsRaw ?? '{}') as Record<string, Array<{ HostPort: string }> | null>;

  const ports = Object.entries(portsObj)
    .filter(([, bindings]) => Array.isArray(bindings) && bindings.length > 0)
    .map(([containerPort, bindings]) => `${bindings?.[0]?.HostPort ?? '?'}->${containerPort}`);

  return {
    exists,
    running,
    status: statusRaw,
    image,
    uptime: startedAtRaw,
    ports,
  };
}

export async function ensureImage(imageRef: string): Promise<void> {
  await execa('docker', ['pull', imageRef], { stdio: 'inherit' });
}

export async function runContainer(args: string[]): Promise<void> {
  await execa('docker', args, { stdio: 'inherit' });
}

export async function stopContainer(containerName: string): Promise<void> {
  await execa('docker', ['stop', containerName], { stdio: 'inherit' });
}

export async function removeContainer(containerName: string): Promise<void> {
  await execa('docker', ['rm', '-f', containerName], { stdio: 'inherit' });
}

export async function streamLogs(containerName: string, follow: boolean, tail: string): Promise<void> {
  const args = ['logs', '--tail', tail];
  if (follow) {
    args.push('--follow');
  }
  args.push(containerName);
  await execa('docker', args, { stdio: 'inherit' });
}

export async function checkNetworkReachable(host: string): Promise<boolean> {
  try {
    await execa('getent', ['hosts', host]);
    return true;
  } catch {
    return false;
  }
}

export async function listDockerVolumesDetailed(): Promise<DockerVolumeStatus[]> {
  const { stdout: namesStdout } = await execa('docker', ['volume', 'ls', '--format', '{{.Name}}']);
  const names = namesStdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));

  if (names.length === 0) {
    return [];
  }

  const { stdout: inspectStdout } = await execa('docker', ['volume', 'inspect', ...names]);
  const parsed = JSON.parse(inspectStdout) as Array<{
    Name?: string;
    Driver?: string;
    Mountpoint?: string;
    Options?: Record<string, string>;
  }>;

  return parsed.map((volume) => {
    const options = volume.Options ?? {};
    const hostPath = options.type === 'none' && options.o?.split(',').includes('bind') ? options.device ?? null : null;

    return {
      name: volume.Name ?? 'unknown',
      driver: volume.Driver ?? 'unknown',
      mountpoint: volume.Mountpoint ?? '',
      hostPath,
      isBind: Boolean(hostPath),
    };
  });
}
