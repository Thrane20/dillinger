import { execa } from 'execa';

export async function createDockerVolume(volumeName: string): Promise<void> {
  await execa('docker', ['volume', 'create', volumeName], { stdio: 'inherit' });
}

export async function createBindVolume(volumeName: string, hostPath: string): Promise<void> {
  await execa(
    'docker',
    [
      'volume',
      'create',
      '--driver',
      'local',
      '--opt',
      'type=none',
      '--opt',
      `device=${hostPath}`,
      '--opt',
      'o=bind',
      volumeName,
    ],
    { stdio: 'inherit' },
  );
}

export async function inspectVolume(volumeName: string): Promise<Record<string, unknown>> {
  const { stdout } = await execa('docker', ['volume', 'inspect', volumeName]);
  const parsed = JSON.parse(stdout) as Array<Record<string, unknown>>;
  return parsed[0] ?? {};
}

export async function volumeExists(volumeName: string): Promise<boolean> {
  try {
    await execa('docker', ['volume', 'inspect', volumeName]);
    return true;
  } catch {
    return false;
  }
}

export async function removeVolume(volumeName: string): Promise<void> {
  await execa('docker', ['volume', 'rm', volumeName], { stdio: 'inherit' });
}

export async function listVolumes(prefix?: string): Promise<string[]> {
  const { stdout } = await execa('docker', ['volume', 'ls', '--format', '{{.Name}}']);
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => (prefix ? line.startsWith(prefix) : line.length > 0));
}

export async function backupVolume(volumeName: string, outputFile: string): Promise<void> {
  await execa(
    'docker',
    [
      'run',
      '--rm',
      '-v',
      `${volumeName}:/source:ro`,
      '-v',
      `${process.cwd()}:/backup`,
      'alpine',
      'sh',
      '-c',
      `tar -czf /backup/${outputFile} -C /source .`,
    ],
    { stdio: 'inherit' },
  );
}

export async function restoreVolume(volumeName: string, inputFile: string): Promise<void> {
  await execa(
    'docker',
    [
      'run',
      '--rm',
      '-v',
      `${volumeName}:/target`,
      '-v',
      `${process.cwd()}:/backup`,
      'alpine',
      'sh',
      '-c',
      `tar -xzf /backup/${inputFile} -C /target`,
    ],
    { stdio: 'inherit' },
  );
}

export async function verifyVolume(volumeName: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    const details = await inspectVolume(volumeName);
    if (!details.Name) {
      return { ok: false, reason: 'Volume metadata missing' };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: String(error) };
  }
}
