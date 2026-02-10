import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import { Dirent } from 'fs';
import path from 'path';
import { JSONStorageService } from '@/lib/services/storage';

const storage = JSONStorageService.getInstance();
const SESSIONS_DIR = path.join(storage.getStoragePath(), 'sessions');
const GAMES_DIR = path.join(storage.getStoragePath(), 'games');
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

const screenshotsCache = new Map<string, string[]>();

const encodePathSegments = (relativePath: string): string =>
  relativePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function collectScreenshotPaths(
  baseDir: string,
  emulatorHomeDir: string,
  results: Set<string>
): Promise<void> {
  if (!await pathExists(baseDir)) {
    return;
  }

  const entries = await fs.readdir(baseDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(baseDir, entry.name);

    if (entry.isDirectory()) {
      await collectScreenshotPaths(fullPath, emulatorHomeDir, results);
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

    if (!relativePath.startsWith('..')) {
      results.add(relativePath);
    }
  }
}

async function getGameScreenshots(gameId: string): Promise<string[]> {
  if (screenshotsCache.has(gameId)) {
    return screenshotsCache.get(gameId) || [];
  }

  const emulatorHomeDir = path.join(storage.getDillingerRoot(), 'emulator-homes', gameId);
  const retroarchScreenshotsDir = path.join(emulatorHomeDir, '.config', 'retroarch', 'screenshots');

  const screenshotPaths = new Set<string>();

  if (await pathExists(emulatorHomeDir)) {
    await collectScreenshotPaths(retroarchScreenshotsDir, emulatorHomeDir, screenshotPaths);
    await collectScreenshotPaths(emulatorHomeDir, emulatorHomeDir, screenshotPaths);
  }

  const urls = Array.from(screenshotPaths)
    .map((relativePath) => `/api/games/${gameId}/screenshots/${encodePathSegments(relativePath)}`);

  screenshotsCache.set(gameId, urls);
  return urls;
}

function safeJsonParse(raw: string, fileName: string): SessionData | null {
  try {
    return JSON.parse(raw) as SessionData;
  } catch (error) {
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const trimmed = raw.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(trimmed) as SessionData;
      } catch {
        console.error(`Failed to parse session file ${fileName} after trim.`);
      }
    }
    console.error(`Failed to parse session file ${fileName}:`, error);
    return null;
  }
}

interface SessionData {
  id: string;
  gameId: string;
  platformId?: string;
  status: string;
  performance?: {
    startTime: string;
    endTime?: string;
  };
  containerId?: string;
  screenshots?: string[];
}

export async function GET(_request: NextRequest) {
  try {
    // Read all session files
    const dirEntries = await fs.readdir(SESSIONS_DIR, { withFileTypes: true }).catch(() => [] as Dirent[]);
    const sessionFiles: string[] = [];

    for (const entry of dirEntries) {
      if (entry.isFile()) {
        if (entry.name.endsWith('.json') && entry.name !== 'index.json') {
          sessionFiles.push(entry.name);
        }
        continue;
      }

      if (entry.isDirectory()) {
        const subdir = path.join(SESSIONS_DIR, entry.name);
        const subFiles = await fs.readdir(subdir).catch(() => [] as string[]);
        subFiles
          .filter((file) => file.endsWith('.json') && file !== 'index.json')
          .forEach((file) => sessionFiles.push(path.join(entry.name, file)));
      }
    }
    
    const sessions = await Promise.all(
      sessionFiles
        .filter(file => file.endsWith('.json') && file !== 'index.json')
        .map(async (file) => {
          try {
            const sessionPath = path.join(SESSIONS_DIR, file);
            const raw = await fs.readFile(sessionPath, 'utf-8');
            const sessionData = safeJsonParse(raw, file);
            if (!sessionData) {
              return null;
            }
            
            // Calculate duration from performance data
            let duration = 0;
            let startTime = '';
            let endTime = '';
            
            if (sessionData.performance?.startTime) {
              startTime = sessionData.performance.startTime;
              endTime = sessionData.performance.endTime || new Date().toISOString();
              
              const start = new Date(startTime).getTime();
              const end = new Date(endTime).getTime();
              duration = (end - start) / 1000 / 60; // Convert to minutes
            }
            
            // Get game metadata
            let gameTitle = sessionData.gameId;
            let gamePrimaryImage: string | undefined;
            
            try {
              const gamePath = path.join(GAMES_DIR, `${sessionData.gameId}.json`);
              const gameData = JSON.parse(await fs.readFile(gamePath, 'utf-8'));
              gameTitle = gameData.title || gameData.id;
              gamePrimaryImage = gameData.metadata?.primaryImage;
            } catch (err) {
              // Game file not found or couldn't be read
              console.error(`Failed to load game metadata for ${sessionData.gameId}:`, err);
            }
            
            // Map status
            let status: 'running' | 'completed' | 'crashed' = 'completed';
            if (sessionData.status === 'running' || sessionData.status === 'active') {
              status = 'running';
            } else if (sessionData.status === 'crashed' || sessionData.status === 'error') {
              status = 'crashed';
            }
            
            const screenshots = sessionData.screenshots && sessionData.screenshots.length > 0
              ? sessionData.screenshots
              : await getGameScreenshots(sessionData.gameId);

            return {
              id: sessionData.id,
              gameId: sessionData.gameId,
              gameTitle,
              gamePrimaryImage,
              startTime,
              endTime: sessionData.performance?.endTime,
              duration,
              status,
              platform: sessionData.platformId,
              screenshots,
            };
          } catch (err) {
            console.error(`Failed to parse session file ${file}:`, err);
            return null;
          }
        })
    );
    
    // Filter out null entries and sort by start time (newest first)
    const validSessions = sessions
      .filter((s): s is NonNullable<typeof s> => s !== null && !!s.startTime)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    
    return NextResponse.json({ sessions: validSessions });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions', sessions: [] },
      { status: 500 }
    );
  }
}
