'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AdjustmentsHorizontalIcon,
  ArrowDownTrayIcon,
  BugAntIcon,
  Cog6ToothIcon,
  PlayIcon,
  SignalIcon,
  StopIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import type { Game as SharedGame } from '@dillinger/shared';
import { formatLastPlayed, formatPlayTime } from './utils/timeFormat';
import ConfirmationModal from './components/ConfirmationModal';
import DownloadMonitor from './components/DownloadMonitor';
import LogPanel from './components/LogPanel';

interface DownloadStatus {
  gameId?: string;
  status?: string;
  progress?: {
    totalProgress?: number;
  };
}

interface Game extends Omit<SharedGame, 'installation'> {
  installation?: {
    status?: string;
    installPath?: string;
    installerPath?: string;
    installedAt?: string;
    installMethod?: 'manual' | 'automated';
    containerId?: string;
    error?: string;
    downloadProgress?: number;
    wineVersionId?: string;
  };
}

interface Session {
  id: string;
  gameId: string;
  status: string;
  containerId?: string;
}

type SortKey = 'title' | 'lastPlayed' | 'rating' | 'created';

const platformNames: Record<string, string> = {
  'linux-native': 'Linux',
  'windows-wine': 'Wine',
  proton: 'Proton',
  dosbox: 'DOSBox',
  scummvm: 'ScummVM',
  c64: 'C64',
  c128: 'C128',
  vic20: 'VIC-20',
  plus4: 'Plus/4',
  pet: 'PET',
  amiga: 'Amiga',
  amiga500: 'A500',
  amiga500plus: 'A500+',
  amiga600: 'A600',
  amiga1200: 'A1200',
  amiga3000: 'A3000',
  amiga4000: 'A4000',
  cd32: 'CD32',
  mame: 'Arcade',
  arcade: 'Arcade',
};

const platformGroups: Record<string, string[]> = {
  amiga: ['amiga', 'amiga500', 'amiga500plus', 'amiga600', 'amiga1200', 'amiga3000', 'amiga4000', 'cd32'],
  c64: ['c64', 'c128', 'vic20', 'plus4', 'pet'],
  mame: ['mame', 'arcade'],
};

function getPlatformName(id?: string) {
  return id ? platformNames[id] || id : 'Unknown';
}

function getGamePlatformIds(game: Game) {
  const ids = new Set<string>();
  if (game.defaultPlatformId) ids.add(game.defaultPlatformId);
  if (game.platformId) ids.add(game.platformId);
  for (const platform of game.platforms || []) ids.add(platform.platformId);
  return Array.from(ids);
}

function platformMatches(game: Game, selectedPlatform: string) {
  if (selectedPlatform === 'all') return true;
  const candidates = platformGroups[selectedPlatform] || [selectedPlatform];
  return getGamePlatformIds(game).some((id) => candidates.includes(id));
}

function getConfiguredPlatforms(game: Game) {
  return (game.platforms || []).filter((p) => {
    const emulatorPlatform = ['c64', 'c128', 'vic20', 'plus4', 'pet', 'amiga', 'amiga500', 'amiga500plus', 'amiga600', 'amiga1200', 'amiga3000', 'amiga4000', 'cd32'].includes(p.platformId);
    return p.filePath || p.settings?.launch?.command || (emulatorPlatform && p.filePath);
  });
}

function getRequiredRunner(platformId: string): string | null {
  if (['c64', 'c128', 'vic20', 'plus4', 'pet'].includes(platformId)) return 'vice';
  if (['arcade', 'mame', 'nes', 'snes', 'genesis'].includes(platformId)) return 'retroarch';
  if (['amiga', 'amiga500', 'amiga500plus', 'amiga600', 'amiga1200', 'amiga3000', 'amiga4000', 'cd32'].includes(platformId)) return 'fs-uae';
  if (platformId === 'windows-wine') return 'wine';
  if (platformId === 'linux-native') return 'linux-native';
  return null;
}

function getGogIdFromGame(game: { id: string; slug?: string }): string | null {
  const extractGogId = (str: string): string | null => {
    if (!str.startsWith('gog-')) return null;
    const withoutPrefix = str.replace('gog-', '');
    const gogIdMatch = withoutPrefix.match(/(\d{10})$/);
    if (gogIdMatch) return gogIdMatch[1];
    return /^\d+$/.test(withoutPrefix) ? withoutPrefix : null;
  };
  return extractGogId(game.id) || (game.slug ? extractGogId(game.slug) : null);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function GamesPage() {
  const router = useRouter();
  const [bootstrapChecked, setBootstrapChecked] = useState(false);
  const [isInitialized, setIsInitialized] = useState(true);
  const [bootstrapPreview, setBootstrapPreview] = useState<{ directories: string[]; files: string[] } | null>(null);
  const [bootstrapDillingerRoot, setBootstrapDillingerRoot] = useState('/data');
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const [sessions, setSessions] = useState<Record<string, Session>>({});
  const [runners, setRunners] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('title');
  const [gridColumns, setGridColumns] = useState(4);
  const [debugDialogOpenForGameId, setDebugDialogOpenForGameId] = useState<string | null>(null);
  const [streamDebugDialogOpenForGameId, setStreamDebugDialogOpenForGameId] = useState<string | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ gameId: string; gameTitle: string; hasDownload: boolean; downloadProgress: number } | null>(null);
  const [cacheConfirmModal, setCacheConfirmModal] = useState<{ game: Game; cacheSize: number; fileCount: number } | null>(null);
  const [wineVersionMismatchModal, setWineVersionMismatchModal] = useState<{
    gameId: string;
    gameTitle: string;
    installVersion: string;
    currentVersion: string;
    launchMode: 'local' | 'streaming';
    platformId?: string;
    launchOptions?: { keepContainer?: boolean; keepAlive?: boolean };
  } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSelectedPlatform(params.get('platform') || 'all');
    setFilterText(params.get('q') || '');
    const savedColumns = localStorage.getItem('gridColumns');
    if (savedColumns) setGridColumns(parseInt(savedColumns, 10));
  }, []);

  useEffect(() => {
    const checkBootstrap = async () => {
      try {
        const res = await fetch('/api/bootstrap/status', { cache: 'no-store' });
        if (!res.ok) throw new Error(`bootstrap status failed: ${res.status}`);
        const data = await res.json();
        setIsInitialized(!!data.initialized);
        setBootstrapPreview(data.preview || null);
        if (typeof data.dillingerRoot === 'string') setBootstrapDillingerRoot(data.dillingerRoot);
      } catch {
        setIsInitialized(true);
      } finally {
        setBootstrapChecked(true);
      }
    };
    void checkBootstrap();
  }, []);

  useEffect(() => {
    if (!bootstrapChecked || !isInitialized) return;
    void loadGames();
    void loadRunners();
  }, [bootstrapChecked, isInitialized]);

  useEffect(() => {
    if (!bootstrapChecked || !isInitialized) return;
    const pollInterval = setInterval(() => void loadGames(true), 5000);
    return () => clearInterval(pollInterval);
  }, [bootstrapChecked, isInitialized]);

  useEffect(() => {
    const runningSessions = Object.entries(sessions).filter(([, session]) => session.status === 'running');
    if (runningSessions.length === 0) return;
    const pollInterval = setInterval(async () => {
      for (const [gameId, session] of runningSessions) {
        try {
          const response = await fetch(`/api/launch/${gameId}/sessions`);
          if (!response.ok) continue;
          const data = await response.json();
          const currentSession = data.success && data.sessions?.find((s: Session) => s.id === session.id);
          if (currentSession && currentSession.status !== 'running') {
            setSessions((prev) => {
              const next = { ...prev };
              delete next[gameId];
              return next;
            });
          }
        } catch (err) {
          console.error(`Error polling session for game ${gameId}:`, err);
        }
      }
    }, 3000);
    return () => clearInterval(pollInterval);
  }, [sessions]);

  const filteredGames = useMemo(() => {
    const searchLower = filterText.trim().toLowerCase();
    const filtered = games.filter((game) => {
      const matchesText = !searchLower || game.title.toLowerCase().includes(searchLower) || game.metadata?.developer?.toLowerCase().includes(searchLower);
      return matchesText && platformMatches(game, selectedPlatform);
    });

    return filtered.sort((a, b) => {
      if (sortKey === 'lastPlayed') {
        return new Date(b.metadata?.lastPlayed || 0).getTime() - new Date(a.metadata?.lastPlayed || 0).getTime();
      }
      if (sortKey === 'rating') {
        return (b.metadata?.rating || 0) - (a.metadata?.rating || 0);
      }
      if (sortKey === 'created') {
        return new Date(b.created || 0).getTime() - new Date(a.created || 0).getTime();
      }
      return a.title.localeCompare(b.title);
    });
  }, [filterText, games, selectedPlatform, sortKey]);

  async function loadRunners() {
    try {
      const response = await fetch('/api/runners');
      const data = await response.json();
      if (data.success) {
        const runnerMap: Record<string, boolean> = {};
        data.runners.forEach((runner: { id: string; installed: boolean }) => {
          runnerMap[runner.id] = runner.installed;
        });
        setRunners(runnerMap);
      }
    } catch (err) {
      console.error('Failed to load runners:', err);
    }
  }

  async function loadGames(silent = false) {
    try {
      const response = await fetch('/api/games');
      if (!response.ok) {
        if (!silent) setError('Failed to load games from API');
        return;
      }
      const data = await response.json();
      if (!data.success) return;

      const activeDownloadsByGameId = new Map<string, DownloadStatus>();
      try {
        const downloadsResponse = await fetch('/api/online-sources/gog/downloads');
        if (downloadsResponse.ok) {
          const downloadsData = await downloadsResponse.json();
          for (const dl of downloadsData.downloads || []) {
            if (dl?.gameId) activeDownloadsByGameId.set(dl.gameId, dl);
          }
        }
      } catch {
        // Download aggregation is optional for the base library render.
      }

      const gamesWithDownloadStatus = (data.data || []).map((game: Game) => {
        const dlStatus = activeDownloadsByGameId.get(game.id);
        if (!dlStatus) return game;
        if (dlStatus.status === 'failed' || dlStatus.status === 'paused') {
          return { ...game, installation: { ...game.installation, status: 'download_cancelled', downloadProgress: dlStatus.progress?.totalProgress ?? 0 } };
        }
        if (dlStatus.status === 'downloading' || dlStatus.status === 'queued') {
          return { ...game, installation: { ...game.installation, status: 'downloading', downloadProgress: dlStatus.progress?.totalProgress ?? 0 } };
        }
        return game;
      });

      setGames(gamesWithDownloadStatus);
      if (!silent) setError(null);
    } catch (err) {
      if (!silent) setError(`Failed to load games: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function runBootstrap() {
    setIsBootstrapping(true);
    setError(null);
    try {
      const res = await fetch('/api/bootstrap/run', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Bootstrap failed (${res.status})`);
      }
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bootstrap failed');
      setIsBootstrapping(false);
    }
  }

  async function deleteGame(gameId: string) {
    const game = games.find((g) => g.id === gameId);
    if (!game) return;
    try {
      const cacheResponse = await fetch(`/api/online-sources/gog/downloads/${gameId}/cache`);
      const cacheData = await cacheResponse.json();
      if (cacheData.success && (cacheData.hasActiveDownload || cacheData.cacheExists)) {
        setDeleteConfirmModal({ gameId, gameTitle: game.title, hasDownload: cacheData.hasActiveDownload, downloadProgress: cacheData.downloadProgress || 0 });
        return;
      }
    } catch {
      // Fall through to normal confirmation.
    }
    if (!confirm('Are you sure you want to delete this game from your library?')) return;
    await performDeleteGame(gameId, false);
  }

  async function performDeleteGame(gameId: string, deleteCache: boolean) {
    try {
      if (deleteCache) await fetch(`/api/online-sources/gog/downloads/${gameId}/cache`, { method: 'DELETE' });
      const response = await fetch(`/api/games/${gameId}`, { method: 'DELETE' });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setGames((prev) => prev.filter((g) => g.id !== gameId));
          setSessions((prev) => {
            const next = { ...prev };
            delete next[gameId];
            return next;
          });
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete game');
      }
    } catch (err) {
      setError(`Failed to delete game: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  async function resumeDownload(game: Game) {
    const gogId = getGogIdFromGame(game);
    if (!gogId) {
      setError('Cannot resume: GOG ID not found');
      return;
    }
    try {
      const cacheResponse = await fetch(`/api/online-sources/gog/downloads/${game.id}/cache`);
      const cacheData = await cacheResponse.json();
      if (cacheData.success && cacheData.hasActiveDownload) {
        await performResumeDownload(game);
        return;
      }
      if (cacheData.success && cacheData.cacheExists && cacheData.fileCount > 0) {
        setCacheConfirmModal({ game, cacheSize: cacheData.cacheSize, fileCount: cacheData.fileCount });
        return;
      }
      await performResumeDownload(game);
    } catch {
      await performResumeDownload(game);
    }
  }

  async function performResumeDownload(game: Game, clearCache = false) {
    const gogId = getGogIdFromGame(game);
    if (!gogId) {
      setError('Cannot resume: GOG ID not found');
      return;
    }
    try {
      if (clearCache) {
        await fetch(`/api/online-sources/gog/downloads/${game.id}/cache`, { method: 'DELETE' });
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      const response = await fetch(`/api/online-sources/gog/games/${gogId}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: game.id, title: game.title }),
      });
      if (response.ok) {
        setGames((prev) => prev.map((g) => (g.id === game.id ? { ...g, installation: { ...g.installation, status: 'downloading' } } : g)));
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to resume download');
      }
    } catch (err) {
      setError(`Failed to resume download: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  async function restartDownload(game: Game) {
    const gogId = getGogIdFromGame(game);
    if (!gogId) {
      setError('Cannot restart: GOG ID not found');
      return;
    }
    if (!confirm('This will delete any existing downloaded files and start fresh. Continue?')) return;
    try {
      await fetch(`/api/games/${game.id}/download`, { method: 'DELETE' });
      await new Promise((resolve) => setTimeout(resolve, 500));
      const response = await fetch(`/api/online-sources/gog/games/${gogId}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: game.id, title: game.title }),
      });
      if (response.ok) {
        setGames((prev) => prev.map((g) => (g.id === game.id ? { ...g, installation: { ...g.installation, status: 'downloading', downloadProgress: 0 } } : g)));
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to restart download');
      }
    } catch (err) {
      setError(`Failed to restart download: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  async function launchGame(
    gameId: string,
    mode: 'local' | 'streaming' = 'local',
    platformId?: string,
    options?: { keepContainer?: boolean; keepAlive?: boolean },
    skipVersionCheck?: boolean
  ) {
    const game = games.find((g) => g.id === gameId);
    if (game && !skipVersionCheck) {
      const platform = platformId || game.defaultPlatformId;
      const isWinePlatform = platform === 'windows-wine' || platform?.includes('wine');
      if (isWinePlatform) {
        const installVersion = game.installation?.wineVersionId || 'unknown';
        const currentVersion = game.settings?.wine?.version || 'system';
        if (installVersion !== 'unknown' && installVersion !== currentVersion) {
          setWineVersionMismatchModal({ gameId, gameTitle: game.title, installVersion, currentVersion, launchMode: mode, platformId, launchOptions: options });
          return;
        }
      }
    }
    await performLaunchGame(gameId, mode, platformId, options);
  }

  async function performLaunchGame(gameId: string, mode: 'local' | 'streaming' = 'local', platformId?: string, options?: { keepContainer?: boolean; keepAlive?: boolean }) {
    setLaunching((prev) => ({ ...prev, [gameId]: true }));
    setError(null);
    try {
      const response = await fetch(`/api/launch/${gameId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, platformId, keepContainer: options?.keepContainer === true, keepAlive: options?.keepAlive === true }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.session) {
          setSessions((prev) => ({ ...prev, [gameId]: data.session }));
          if (options?.keepContainer === true || options?.keepAlive === true) router.push(`/debug/${gameId}/${data.session.id}`);
        }
      } else {
        const errorData = await response.json();
        if (mode === 'streaming' && errorData.validation?.issues?.length) {
          const issues = errorData.validation.issues.map((issue: { message?: string }) => issue.message).filter(Boolean).join('; ');
          setError(`Streaming graph validation failed: ${issues}`);
        } else {
          setError(errorData.error || 'Failed to launch game');
        }
      }
    } catch (err) {
      setError(`Failed to launch game: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLaunching((prev) => ({ ...prev, [gameId]: false }));
    }
  }

  async function stopGame(gameId: string) {
    const session = sessions[gameId];
    if (!session) return;
    setLaunching((prev) => ({ ...prev, [gameId]: true }));
    setError(null);
    try {
      const response = await fetch(`/api/launch/${gameId}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSessions((prev) => {
            const next = { ...prev };
            delete next[gameId];
            return next;
          });
          await loadGames();
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to stop game');
      }
    } catch (err) {
      setError(`Failed to stop game: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLaunching((prev) => ({ ...prev, [gameId]: false }));
    }
  }

  if (!bootstrapChecked || loading) {
    return (
      <div className="workbench-window">
        <div className="workbench-titlebar">BOOT_SEQUENCE</div>
        <div className="workbench-body flex min-h-[360px] items-center justify-center">
          <div className="terminal-log w-full max-w-2xl">Checking Dillinger storage at {bootstrapDillingerRoot}...</div>
        </div>
      </div>
    );
  }

  if (!isInitialized) {
    const preview = bootstrapPreview || { directories: [], files: [] };
    return (
      <div className="mx-auto max-w-3xl workbench-window">
        <div className="workbench-titlebar">FIRST_RUN.BOOTSTRAP</div>
        <div className="workbench-body space-y-5">
          <h1 className="font-display text-3xl font-black uppercase text-primary">Initialize Core Volume</h1>
          <p className="text-sm text-muted">The mounted core volume is empty. Dillinger can scaffold the base folders and config files under <span className="font-mono text-text">{bootstrapDillingerRoot}</span>.</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="terminal-log">
              <div className="mb-2 text-warning">Directories</div>
              {preview.directories.map((d) => <div key={d}>{d}</div>)}
            </div>
            <div className="terminal-log">
              <div className="mb-2 text-warning">Files</div>
              {preview.files.map((f) => <div key={f}>{f}</div>)}
            </div>
          </div>
          {error && <div className="border-2 border-danger bg-danger-soft p-3 text-sm text-danger">{error}</div>}
          <div className="flex justify-end gap-3">
            <button onClick={() => router.refresh()} disabled={isBootstrapping} className="pixel-button">Re-check</button>
            <button onClick={runBootstrap} disabled={isBootstrapping} className="pixel-button pixel-button-success">{isBootstrapping ? 'Scaffolding...' : 'OK'}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="workbench-window">
        <div className="workbench-titlebar">
          <span>FILTER_GADGETS.LIB</span>
          <span>{filteredGames.length}/{games.length} MODULES</span>
        </div>
        <div className="workbench-body grid gap-3 xl:grid-cols-[1fr_180px_220px]">
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted">Search Index</span>
            <input value={filterText} onChange={(e) => setFilterText(e.target.value)} placeholder="Search by title or developer" className="workbench-field w-full" />
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted">Sort Stack</span>
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="workbench-field w-full">
              <option value="title">Title</option>
              <option value="lastPlayed">Last Played</option>
              <option value="rating">Rating</option>
              <option value="created">Added</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted">VIEW_SCALE {gridColumns}</span>
            <input
              type="range"
              min="2"
              max="6"
              step="1"
              value={gridColumns}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                setGridColumns(value);
                localStorage.setItem('gridColumns', String(value));
              }}
              className="w-full accent-primary"
            />
          </label>
        </div>
      </section>

      {error && (
        <div className="workbench-window border-danger">
          <div className="workbench-titlebar bg-danger-soft text-danger">ALERT.WINDOW</div>
          <div className="workbench-body text-sm text-danger">
            {error}
            {error.startsWith('Streaming graph validation failed') && (
              <button onClick={() => router.push('/settings#streaming')} className="ml-3 underline">Open streaming settings</button>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-4 2xl:grid-cols-[1fr_320px]">
        <section className="workbench-window">
          <div className="workbench-titlebar">
            <span>VOLUME: {selectedPlatform === 'all' ? 'ALL_PLATFORMS' : getPlatformName(selectedPlatform).toUpperCase()}_TITLES</span>
            <Link href="/games/add" className="text-accent hover:text-success">ADD_MODULE</Link>
          </div>
          <div className="workbench-body">
            {filteredGames.length === 0 ? (
              <div className="terminal-log min-h-[240px]">No matching game modules. Clear filters or add a new game.</div>
            ) : (
              <div
                className="grid gap-3"
                style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${gridColumns >= 5 ? 150 : gridColumns >= 4 ? 180 : 230}px, 1fr))` }}
              >
                {filteredGames.map((game) => {
                  const configuredPlatforms = getConfiguredPlatforms(game);
                  const isConfigured = configuredPlatforms.length > 0;
                  const requiredRunner = configuredPlatforms[0] ? getRequiredRunner(configuredPlatforms[0].platformId) : null;
                  const isRunnerAvailable = !requiredRunner || runners[requiredRunner] === true;
                  const session = sessions[game.id];
                  const isRunning = session?.status === 'running';
                  const isLaunching = launching[game.id];
                  const platformBadges = getGamePlatformIds(game).slice(0, 3);
                  const installStatus = game.installation?.status;
                  const image = game.metadata?.primaryImage || game.metadata?.coverArt;

                  return (
                    <article key={game.id} id={`game-${game.id}`} className="group relative border-2 border-neutral bg-background transition-colors hover:border-primary">
                      <Link href={`/games/${game.id}`} className="block">
                        <div className="relative aspect-[3/4] overflow-hidden border-b-2 border-neutral bg-black">
                          {image ? (
                            <Image src={image} alt={game.title} fill unoptimized sizes="(min-width: 1536px) 16vw, (min-width: 1024px) 22vw, 50vw" className="object-cover transition-transform duration-200 group-hover:scale-105" />
                          ) : (
                            <div className="flex h-full items-center justify-center p-4 text-center text-xs uppercase text-muted">No Media</div>
                          )}
                          <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                            {!isConfigured && <span className="status-pill border-warning text-warning">Config</span>}
                            {!isRunnerAvailable && isConfigured && <span className="status-pill border-danger text-danger">Runner</span>}
                            {isRunning && <span className="status-pill border-success text-success">Running</span>}
                          </div>
                          <div className="absolute inset-x-0 bottom-0 hidden border-t-2 border-primary bg-background/92 p-2 group-hover:block">
                            <div className="grid grid-cols-5 gap-1">
                              <ActionButton label="Launch" icon={<PlayIcon className="h-4 w-4" />} disabled={!isConfigured || !isRunnerAvailable || isLaunching} onClick={() => launchGame(game.id, 'local')} />
                              <ActionButton label="Stream" icon={<SignalIcon className="h-4 w-4" />} disabled={!isConfigured || isLaunching} onClick={() => launchGame(game.id, 'streaming')} />
                              <Link href={`/games/${game.id}/edit`} title="Configure" className="pixel-button min-h-8 px-1"><Cog6ToothIcon className="h-4 w-4" /></Link>
                              <Link href={`/games/${game.id}`} title="Details" className="pixel-button min-h-8 px-1"><AdjustmentsHorizontalIcon className="h-4 w-4" /></Link>
                              <button title="Delete" onClick={(e) => { e.preventDefault(); void deleteGame(game.id); }} className="pixel-button pixel-button-danger min-h-8 px-1"><TrashIcon className="h-4 w-4" /></button>
                            </div>
                          </div>
                        </div>
                      </Link>
                      <div className="space-y-2 p-3">
                        <Link href={`/games/${game.id}`} className="line-clamp-2 min-h-[2.5rem] font-display text-sm font-black uppercase text-text hover:text-primary">{game.title}</Link>
                        <div className="flex flex-wrap gap-1">
                          {platformBadges.map((id) => <span key={id} className="status-pill">{getPlatformName(id)}</span>)}
                        </div>
                        <div className="text-[11px] uppercase text-muted">
                          {game.metadata?.developer || game.metadata?.publisher || 'Unknown Publisher'}
                        </div>
                        {game.metadata?.playCount ? (
                          <div className="text-[11px] text-muted">Last: {game.metadata.lastPlayed ? formatLastPlayed(game.metadata.lastPlayed) : 'Unknown'} · {formatPlayTime(game.metadata.playTime || 0)}</div>
                        ) : (
                          <div className="text-[11px] text-muted">Never played</div>
                        )}
                        {installStatus === 'downloading' && (
                          <div>
                            <div className="mb-1 flex justify-between text-[10px] uppercase text-primary"><span>Downloading</span><span>{game.installation?.downloadProgress || 0}%</span></div>
                            <div className="h-2 border border-primary bg-black"><div className="h-full bg-primary" style={{ width: `${game.installation?.downloadProgress || 0}%` }} /></div>
                          </div>
                        )}
                        {installStatus === 'download_cancelled' && (
                          <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => resumeDownload(game)} className="pixel-button min-h-8"><ArrowDownTrayIcon className="h-4 w-4" />Resume</button>
                            <button onClick={() => restartDownload(game)} className="pixel-button pixel-button-warning min-h-8">Restart</button>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {isRunning ? (
                            <button onClick={() => stopGame(game.id)} disabled={isLaunching} className="pixel-button pixel-button-danger col-span-2"><StopIcon className="h-4 w-4" />Stop</button>
                          ) : (
                            <>
                              <button onClick={() => launchGame(game.id, 'local')} disabled={!isConfigured || !isRunnerAvailable || isLaunching} className="pixel-button pixel-button-success"><PlayIcon className="h-4 w-4" />Run</button>
                              <button onClick={() => launchGame(game.id, 'streaming')} disabled={!isConfigured || isLaunching} className="pixel-button"><SignalIcon className="h-4 w-4" />Stream</button>
                            </>
                          )}
                          <button onClick={() => setDebugDialogOpenForGameId(game.id)} disabled={!isConfigured || isLaunching} className="pixel-button"><BugAntIcon className="h-4 w-4" />Debug</button>
                          <button onClick={() => setStreamDebugDialogOpenForGameId(game.id)} disabled={!isConfigured || isLaunching} className="pixel-button"><SignalIcon className="h-4 w-4" />Dbg Stream</button>
                        </div>
                      </div>

                      {debugDialogOpenForGameId === game.id && (
                        <DebugMenu
                          title="Start Debugging"
                          onClose={() => setDebugDialogOpenForGameId(null)}
                          onStart={() => {
                            setDebugDialogOpenForGameId(null);
                            void launchGame(game.id, 'local', undefined, { keepContainer: true, keepAlive: true });
                          }}
                        />
                      )}
                      {streamDebugDialogOpenForGameId === game.id && (
                        <DebugMenu
                          title="Start Stream Debugging"
                          onClose={() => setStreamDebugDialogOpenForGameId(null)}
                          onStart={() => {
                            setStreamDebugDialogOpenForGameId(null);
                            void launchGame(game.id, 'streaming', undefined, { keepContainer: true, keepAlive: true });
                          }}
                        />
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="workbench-window">
            <div className="workbench-titlebar">DOWNLOAD_QUEUE</div>
            <div className="workbench-body"><DownloadMonitor /></div>
          </div>
          <div className="workbench-window">
            <div className="workbench-titlebar">CONTAINER_LOG</div>
            <div className="workbench-body"><LogPanel /></div>
          </div>
        </aside>
      </div>

      {deleteConfirmModal && (
        <ConfirmationModal
          title={deleteConfirmModal.hasDownload ? 'Download In Progress' : 'Delete Game'}
          message={deleteConfirmModal.hasDownload ? `"${deleteConfirmModal.gameTitle}" has a download in progress (${deleteConfirmModal.downloadProgress}% complete).\n\nWhat would you like to do with the downloaded files?` : `Are you sure you want to delete "${deleteConfirmModal.gameTitle}" from your library?\n\nNote: There are partially downloaded files for this game.`}
          confirmText="Keep Files"
          cancelText="Cancel"
          destructive={false}
          extraButtons={[{ text: 'Delete Files', variant: 'destructive', onClick: () => { void performDeleteGame(deleteConfirmModal.gameId, true); setDeleteConfirmModal(null); } }]}
          onConfirm={() => { void performDeleteGame(deleteConfirmModal.gameId, false); setDeleteConfirmModal(null); }}
          onCancel={() => setDeleteConfirmModal(null)}
        />
      )}

      {cacheConfirmModal && (
        <ConfirmationModal
          title="Existing Download Files Found"
          message={`Found ${cacheConfirmModal.fileCount} file(s) (${formatBytes(cacheConfirmModal.cacheSize)}) from a previous download.\n\nWould you like to use them, or start fresh?`}
          confirmText="Use Existing"
          cancelText="Cancel"
          extraButtons={[{ text: 'Start Fresh', variant: 'secondary', onClick: () => { void performResumeDownload(cacheConfirmModal.game, true); setCacheConfirmModal(null); } }]}
          onConfirm={() => { void performResumeDownload(cacheConfirmModal.game, false); setCacheConfirmModal(null); }}
          onCancel={() => setCacheConfirmModal(null)}
        />
      )}

      {wineVersionMismatchModal && (
        <ConfirmationModal
          title="Wine Version Mismatch"
          message={`"${wineVersionMismatchModal.gameTitle}" was installed with Wine version "${wineVersionMismatchModal.installVersion}" but you're trying to run it with "${wineVersionMismatchModal.currentVersion}".\n\nRunning with a different Wine version than the one used during installation may cause issues.`}
          confirmText="Run Anyway"
          cancelText="Cancel"
          onConfirm={() => {
            void performLaunchGame(wineVersionMismatchModal.gameId, wineVersionMismatchModal.launchMode, wineVersionMismatchModal.platformId, wineVersionMismatchModal.launchOptions);
            setWineVersionMismatchModal(null);
          }}
          onCancel={() => setWineVersionMismatchModal(null)}
        />
      )}
    </div>
  );
}

function ActionButton({ label, icon, disabled, onClick }: { label: string; icon: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className="pixel-button min-h-8 px-1"
    >
      {icon}
    </button>
  );
}

function DebugMenu({ title, onClose, onStart }: { title: string; onClose: () => void; onStart: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-2 top-2 z-50 w-72 workbench-window">
        <div className="workbench-titlebar">{title}</div>
        <div className="workbench-body space-y-3">
          <p className="text-xs text-muted">Keeps the container alive for logs and inspection.</p>
          <div className="flex gap-2">
            <button onClick={onStart} className="pixel-button pixel-button-success flex-1">Start</button>
            <button onClick={onClose} className="pixel-button flex-1">Cancel</button>
          </div>
        </div>
      </div>
    </>
  );
}
