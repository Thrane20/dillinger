import fs from 'fs-extra';
import path from 'path';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const TIME_BUFFER_MS = 5000;

const encodePathSegments = (relativePath: string): string =>
  relativePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

async function collectScreenshotCandidates(
  baseDir: string,
  emulatorHomeDir: string,
  results: Map<string, number>
): Promise<void> {
  if (!await fs.pathExists(baseDir)) {
    return;
  }

  const entries = await fs.readdir(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(baseDir, entry.name);

    if (entry.isDirectory()) {
      await collectScreenshotCandidates(fullPath, emulatorHomeDir, results);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) {
      continue;
    }

    const relativePath = path
      .relative(emulatorHomeDir, fullPath)
      .split(path.sep)
      .join('/');

    if (relativePath.startsWith('..')) {
      continue;
    }

    const stats = await fs.stat(fullPath);
    const existing = results.get(relativePath);
    if (existing === undefined || stats.mtimeMs > existing) {
      results.set(relativePath, stats.mtimeMs);
    }
  }
}

export async function collectSessionScreenshots(options: {
  dillingerRoot: string;
  gameId: string;
  gameIdentifier: string;
  startTime: string;
  endTime: string;
}): Promise<string[]> {
  const { dillingerRoot, gameId, gameIdentifier, startTime, endTime } = options;
  const emulatorHomeDir = path.join(dillingerRoot, 'emulator-homes', gameIdentifier);

  if (!await fs.pathExists(emulatorHomeDir)) {
    return [];
  }

  const retroarchScreenshotsDir = path.join(emulatorHomeDir, '.config', 'retroarch', 'screenshots');
  const candidates = new Map<string, number>();

  await collectScreenshotCandidates(retroarchScreenshotsDir, emulatorHomeDir, candidates);
  await collectScreenshotCandidates(emulatorHomeDir, emulatorHomeDir, candidates);

  const startMs = new Date(startTime).getTime();
  const endMs = new Date(endTime).getTime();

  return Array.from(candidates.entries())
    .filter(([, mtime]) => mtime >= startMs - TIME_BUFFER_MS && mtime <= endMs + TIME_BUFFER_MS)
    .sort((a, b) => b[1] - a[1])
    .map(([relativePath]) => `/api/games/${gameId}/screenshots/${encodePathSegments(relativePath)}`);
}
