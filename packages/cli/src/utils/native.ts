import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { closeSync, existsSync, openSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';
import { inspectVolume, volumeExists } from './volume.js';

export type NativeRuntimeStatus = {
  running: boolean;
  stale: boolean;
  started?: boolean;
  pid?: number;
  pidFile: string;
  logFile: string;
  port?: number;
  dataPath?: string;
  startedAt?: string;
};

type NativeMetadata = {
  pid: number;
  port: number;
  dataPath: string;
  command: string[];
  startedAt: string;
};

type CoreRuntime = {
  root: string;
  serverPath: string;
  nodePath: string;
  hasBundledNode: boolean;
};

const DEFAULT_NATIVE_ARTIFACT = 'dillinger-core-linux-x64';
const PROCESS_EXIT_TIMEOUT_MS = 8_000;

export function getNativeStateDir(): string {
  return process.env.DILLINGER_NATIVE_STATE_DIR
    ? path.resolve(process.env.DILLINGER_NATIVE_STATE_DIR)
    : path.join(homedir(), '.local', 'state', 'dillinger-gaming', 'native');
}

export function getNativePidFile(): string {
  return path.join(getNativeStateDir(), 'core.pid');
}

export function getNativeLogFile(): string {
  return path.join(getNativeStateDir(), 'core.log');
}

function getNativeMetadataFile(): string {
  return path.join(getNativeStateDir(), 'core.json');
}

function isPidRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function readMetadata(): Promise<NativeMetadata | null> {
  try {
    return JSON.parse(await fs.readFile(getNativeMetadataFile(), 'utf8')) as NativeMetadata;
  } catch {
    return null;
  }
}

async function readPid(): Promise<number | undefined> {
  const metadata = await readMetadata();
  if (metadata?.pid) {
    return metadata.pid;
  }

  try {
    const raw = await fs.readFile(getNativePidFile(), 'utf8');
    const pid = Number(raw.trim());
    return Number.isInteger(pid) && pid > 0 ? pid : undefined;
  } catch {
    return undefined;
  }
}

export async function getNativeStatus(): Promise<NativeRuntimeStatus> {
  const metadata = await readMetadata();
  const pid = metadata?.pid ?? (await readPid());
  const running = pid ? isPidRunning(pid) : false;
  const stale = Boolean(pid && !running);

  return {
    running,
    stale,
    pid,
    pidFile: getNativePidFile(),
    logFile: getNativeLogFile(),
    port: metadata?.port,
    dataPath: metadata?.dataPath,
    startedAt: metadata?.startedAt,
  };
}

export async function clearStaleNativeState(): Promise<void> {
  const status = await getNativeStatus();
  if (!status.stale) {
    return;
  }

  await Promise.allSettled([fs.rm(getNativePidFile(), { force: true }), fs.rm(getNativeMetadataFile(), { force: true })]);
}

function getCliRootDir(): string {
  const thisFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(thisFile), '..', '..');
}

function getWorkspaceRootCandidates(): string[] {
  const cwd = process.cwd();
  const cliRoot = getCliRootDir();

  return [
    cwd,
    path.resolve(cwd, '..'),
    path.resolve(cwd, '..', '..'),
    path.resolve(cliRoot, '..', '..'),
    path.resolve(cliRoot, '..', '..', '..'),
  ];
}

function getRuntimeCandidates(): string[] {
  const candidates = [
    process.env.DILLINGER_NATIVE_ARTIFACT,
    process.env.DILLINGER_NATIVE_CORE_DIR,
    path.join(getCliRootDir(), 'native', DEFAULT_NATIVE_ARTIFACT),
    ...getWorkspaceRootCandidates().flatMap((root) => [
      path.join(root, 'release', 'native', DEFAULT_NATIVE_ARTIFACT),
      path.join(root, 'packages', 'dillinger-core', '.next', 'standalone'),
    ]),
  ];

  return candidates.filter((candidate): candidate is string => Boolean(candidate));
}

function findExistingServer(root: string): string | null {
  const candidates = [
    path.join(root, 'app', 'packages', 'dillinger-core', 'server.js'),
    path.join(root, 'packages', 'dillinger-core', 'server.js'),
    path.join(root, 'server.js'),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function hasStandaloneAssets(serverPath: string): boolean {
  const serverDir = path.dirname(serverPath);
  return existsSync(path.join(serverDir, '.next', 'static'));
}

export function findNativeCoreRuntime(): CoreRuntime {
  for (const rootCandidate of getRuntimeCandidates()) {
    const root = path.resolve(rootCandidate);
    const serverPath = findExistingServer(root);
    if (!serverPath) {
      continue;
    }
    if (root.includes(`${path.sep}.next${path.sep}standalone`) && !hasStandaloneAssets(serverPath)) {
      continue;
    }

    const bundledNode = path.join(root, 'node', 'bin', 'node');
    return {
      root,
      serverPath,
      nodePath: existsSync(bundledNode) ? bundledNode : process.execPath,
      hasBundledNode: existsSync(bundledNode),
    };
  }

  throw new Error(
    [
      'Native Dillinger Core artifact was not found.',
      'Build one with `pnpm build:native-core`, or set DILLINGER_NATIVE_ARTIFACT to the artifact directory.',
    ].join(' '),
  );
}

export function parseBindVolumeHostPath(volume: Record<string, unknown>): string | null {
  const options = (volume.Options ?? {}) as Record<string, unknown>;
  const mountpoint = typeof volume.Mountpoint === 'string' ? volume.Mountpoint : null;
  const device = typeof options.device === 'string' ? options.device : null;
  const type = typeof options.type === 'string' ? options.type : null;
  const opts = typeof options.o === 'string' ? options.o : '';
  const isBind = type === 'none' && opts.split(',').includes('bind') && Boolean(device);

  if (!isBind) {
    return null;
  }

  return path.resolve(device ?? mountpoint ?? '');
}

export async function resolveNativeCoreDataPath(volumeName: string): Promise<string> {
  if (process.env.DILLINGER_CORE_PATH) {
    const dataPath = path.resolve(process.env.DILLINGER_CORE_PATH);
    await fs.mkdir(dataPath, { recursive: true });
    return dataPath;
  }

  if (!(await volumeExists(volumeName))) {
    throw new Error(
      `Docker volume ${volumeName} does not exist. Create a bind-backed volume with: dillinger-gaming volume create --bind /path/to/dillinger-data`,
    );
  }

  const volume = await inspectVolume(volumeName);
  const hostPath = parseBindVolumeHostPath(volume);
  if (!hostPath) {
    throw new Error(
      [
        `Docker volume ${volumeName} is not bind-backed, so native Core cannot access it directly.`,
        `Create a bind-backed volume with: dillinger-gaming volume create --bind /path/to/dillinger-data`,
        `Keep using Docker Core with: dillinger-gaming start`,
      ].join('\n'),
    );
  }

  await fs.mkdir(hostPath, { recursive: true });
  return hostPath;
}

function getRuntimeRootForCwd(runtime: CoreRuntime): string {
  if (runtime.serverPath.startsWith(path.join(runtime.root, 'app') + path.sep)) {
    return path.join(runtime.root, 'app');
  }
  return runtime.root;
}

async function writeNativeMetadata(metadata: NativeMetadata): Promise<void> {
  await fs.mkdir(getNativeStateDir(), { recursive: true });
  await fs.writeFile(getNativePidFile(), `${metadata.pid}\n`, 'utf8');
  await fs.writeFile(getNativeMetadataFile(), JSON.stringify(metadata, null, 2), 'utf8');
}

export async function startNativeCore(options: { port: number; volumeName: string }): Promise<NativeRuntimeStatus & { runtime?: CoreRuntime }> {
  await clearStaleNativeState();

  const current = await getNativeStatus();
  if (current.running) {
    return { ...current, started: false };
  }

  const dataPath = await resolveNativeCoreDataPath(options.volumeName);
  const runtime = findNativeCoreRuntime();
  const stateDir = getNativeStateDir();
  await fs.mkdir(stateDir, { recursive: true });

  const logFile = getNativeLogFile();
  await fs.appendFile(logFile, `\n[${new Date().toISOString()}] Starting Dillinger Core native runtime\n`, 'utf8');
  const logFd = openSync(logFile, 'a');

  const child = spawn(runtime.nodePath, [runtime.serverPath], {
    cwd: getRuntimeRootForCwd(runtime),
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      NEXT_TELEMETRY_DISABLED: '1',
      PORT: String(options.port),
      HOSTNAME: '0.0.0.0',
      DILLINGER_CORE_PATH: dataPath,
      DILLINGER_RUNTIME: 'native',
    },
  });
  closeSync(logFd);

  child.unref();

  const metadata = {
    pid: child.pid ?? 0,
    port: options.port,
    dataPath,
    command: [runtime.nodePath, runtime.serverPath],
    startedAt: new Date().toISOString(),
  };
  await writeNativeMetadata(metadata);

  return { ...(await getNativeStatus()), started: true, runtime };
}

async function waitForExit(pid: number, timeoutMs: number): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (!isPidRunning(pid)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return !isPidRunning(pid);
}

export async function stopNativeCore(): Promise<NativeRuntimeStatus> {
  const status = await getNativeStatus();
  if (!status.pid || status.stale) {
    await clearStaleNativeState();
    return status;
  }

  process.kill(status.pid, 'SIGTERM');
  const exited = await waitForExit(status.pid, PROCESS_EXIT_TIMEOUT_MS);
  if (!exited && isPidRunning(status.pid)) {
    process.kill(status.pid, 'SIGKILL');
    await waitForExit(status.pid, 2_000);
  }

  await Promise.allSettled([fs.rm(getNativePidFile(), { force: true }), fs.rm(getNativeMetadataFile(), { force: true })]);
  return { ...(await getNativeStatus()), pid: status.pid };
}

export async function streamNativeLogs(options: { follow: boolean; tail: string }): Promise<void> {
  const logFile = getNativeLogFile();
  await fs.mkdir(path.dirname(logFile), { recursive: true });
  if (!existsSync(logFile)) {
    await fs.writeFile(logFile, '', 'utf8');
  }

  if (options.follow) {
    await execa('tail', ['-n', options.tail, '-f', logFile], { stdio: 'inherit' });
    return;
  }

  await execa('tail', ['-n', options.tail, logFile], { stdio: 'inherit' });
}
