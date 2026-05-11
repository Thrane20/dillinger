'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  BugAntIcon,
  Cog6ToothIcon,
  PlayIcon,
  SignalIcon,
  StopIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import type { Game as SharedGame } from '@dillinger/shared';
import ConfirmationModal from '../../components/ConfirmationModal';
import { formatLastPlayed, formatPlayTime } from '../../utils/timeFormat';

interface Game extends Omit<SharedGame, 'installation'> {
  installation?: {
    status?: string;
    wineVersionId?: string;
    downloadProgress?: number;
  };
}

interface Session {
  id: string;
  gameId: string;
  status: string;
  containerId?: string;
}

const platformNames: Record<string, string> = {
  'linux-native': 'Linux',
  'windows-wine': 'Wine',
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

function getPlatformName(id?: string) {
  return id ? platformNames[id] || id : 'Unknown';
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

export default function GameDetailPage({ gameId }: { gameId: string }) {
  const router = useRouter();
  const [game, setGame] = useState<Game | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [runners, setRunners] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentMedia, setCurrentMedia] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [wineVersionMismatchModal, setWineVersionMismatchModal] = useState<{
    installVersion: string;
    currentVersion: string;
    launchMode: 'local' | 'streaming';
    launchOptions?: { keepContainer?: boolean; keepAlive?: boolean };
  } | null>(null);

  useEffect(() => {
    void loadGame();
    void loadRunners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  useEffect(() => {
    if (!session || session.status !== 'running') return;
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/launch/${gameId}/sessions`);
        if (!response.ok) return;
        const data = await response.json();
        const currentSession = data.success && data.sessions?.find((s: Session) => s.id === session.id);
        if (currentSession && currentSession.status !== 'running') setSession(null);
      } catch (err) {
        console.error('Failed to poll session:', err);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [gameId, session]);

  const configuredPlatforms = useMemo(() => (game ? getConfiguredPlatforms(game) : []), [game]);
  const requiredRunner = configuredPlatforms[0] ? getRequiredRunner(configuredPlatforms[0].platformId) : null;
  const isRunnerAvailable = !requiredRunner || runners[requiredRunner] === true;
  const isConfigured = configuredPlatforms.length > 0;
  const isRunning = session?.status === 'running';
  const media = useMemo(() => {
    if (!game) return [];
    return [game.metadata?.primaryImage, ...(game.metadata?.screenshots || [])].filter(Boolean) as string[];
  }, [game]);
  const activeImage = media[currentMedia] || game?.metadata?.coverArt || null;

  async function loadGame() {
    setLoading(true);
    try {
      const response = await fetch(`/api/games/${gameId}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Game not found');
      setGame(data.data);
      try {
        const sessionsResponse = await fetch(`/api/launch/${gameId}/sessions`);
        if (sessionsResponse.ok) {
          const sessionsData = await sessionsResponse.json();
          const runningSession = sessionsData.success && sessionsData.sessions?.find((s: Session) => s.status === 'running');
          setSession(runningSession || null);
        }
      } catch {
        // Detail page remains usable without session status.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load game');
    } finally {
      setLoading(false);
    }
  }

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

  async function launchGame(mode: 'local' | 'streaming', options?: { keepContainer?: boolean; keepAlive?: boolean }, skipVersionCheck?: boolean) {
    if (!game) return;
    if (!skipVersionCheck) {
      const platform = game.defaultPlatformId;
      const isWinePlatform = platform === 'windows-wine' || platform?.includes('wine');
      if (isWinePlatform) {
        const installVersion = game.installation?.wineVersionId || 'unknown';
        const currentVersion = game.settings?.wine?.version || 'system';
        if (installVersion !== 'unknown' && installVersion !== currentVersion) {
          setWineVersionMismatchModal({ installVersion, currentVersion, launchMode: mode, launchOptions: options });
          return;
        }
      }
    }

    setLaunching(true);
    setError(null);
    try {
      const response = await fetch(`/api/launch/${game.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, keepContainer: options?.keepContainer === true, keepAlive: options?.keepAlive === true }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        if (mode === 'streaming' && data.validation?.issues?.length) {
          const issues = data.validation.issues.map((issue: { message?: string }) => issue.message).filter(Boolean).join('; ');
          throw new Error(`Streaming graph validation failed: ${issues}`);
        }
        throw new Error(data.error || 'Failed to launch game');
      }
      setSession(data.session);
      if (options?.keepContainer === true || options?.keepAlive === true) router.push(`/debug/${game.id}/${data.session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to launch game');
    } finally {
      setLaunching(false);
    }
  }

  async function stopGame() {
    if (!game || !session) return;
    setLaunching(true);
    setError(null);
    try {
      const response = await fetch(`/api/launch/${game.id}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to stop game');
      setSession(null);
      await loadGame();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop game');
    } finally {
      setLaunching(false);
    }
  }

  async function deleteGame() {
    if (!game) return;
    try {
      const response = await fetch(`/api/games/${game.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to delete game');
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete game');
    }
  }

  if (loading) {
    return (
      <div className="workbench-window">
        <div className="workbench-titlebar">LOADING_EXEC_CONTEXT</div>
        <div className="workbench-body terminal-log">Reading game module {gameId}...</div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="workbench-window border-danger">
        <div className="workbench-titlebar bg-danger-soft text-danger">MODULE_NOT_FOUND</div>
        <div className="workbench-body space-y-4">
          <p className="text-danger">{error || 'Game not found'}</p>
          <Link href="/" className="pixel-button">Return to Library</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-wide text-muted">
        <div className="flex items-center gap-2">
          <Link href="/" className="inline-flex items-center gap-1 text-primary hover:text-accent">
            <ArrowLeftIcon className="h-4 w-4" />
            LIBRARY
          </Link>
          <span>/</span>
          <span>{getPlatformName(game.defaultPlatformId || configuredPlatforms[0]?.platformId)}</span>
          <span>/</span>
          <span className="text-text">{game.title}</span>
        </div>
        <Link href={`/games/${game.id}/edit`} className="pixel-button">
          <Cog6ToothIcon className="h-4 w-4" />
          Configure
        </Link>
      </div>

      {error && (
        <div className="workbench-window border-danger">
          <div className="workbench-titlebar bg-danger-soft text-danger">ALERT.WINDOW</div>
          <div className="workbench-body text-sm text-danger">{error}</div>
        </div>
      )}

      <section className="workbench-window">
        <div className="workbench-titlebar">
          <span>EXECUTING: {game.title}</span>
          <span className={isRunning ? 'text-success' : 'text-muted'}>{isRunning ? 'SESSION_ACTIVE' : 'SESSION_IDLE'}</span>
        </div>
        <div className="workbench-body grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <div className="border-2 border-neutral bg-black">
              <div className="relative aspect-video">
                {activeImage ? (
                  <Image src={activeImage} alt={game.title} fill unoptimized sizes="(min-width: 1280px) 60vw, 100vw" className="object-contain" />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted">NO MEDIA SIGNAL</div>
                )}
              </div>
            </div>
            {media.length > 1 && (
              <div className="grid grid-cols-4 gap-2 md:grid-cols-6">
                {media.map((src, index) => (
                  <button key={src} onClick={() => setCurrentMedia(index)} className={`relative aspect-video border-2 bg-black ${index === currentMedia ? 'border-primary' : 'border-neutral'}`}>
                    <Image src={src} alt={`${game.title} media ${index + 1}`} fill unoptimized sizes="120px" className="object-cover" />
                  </button>
                ))}
              </div>
            )}
            <div className="workbench-window">
              <div className="workbench-titlebar">OPERATIONAL_OVERVIEW</div>
              <div className="workbench-body space-y-3 text-sm text-muted">
                <h1 className="font-display text-4xl font-black uppercase text-primary">{game.title}</h1>
                <p>{game.metadata?.description || 'No description has been scraped or entered for this module.'}</p>
                <div className="grid gap-3 md:grid-cols-3">
                  <Metric label="Developer" value={game.metadata?.developer || 'Unknown'} />
                  <Metric label="Publisher" value={game.metadata?.publisher || 'Unknown'} />
                  <Metric label="Released" value={game.metadata?.releaseDate ? new Date(game.metadata.releaseDate).getFullYear().toString() : 'Unknown'} />
                  <Metric label="Play Count" value={String(game.metadata?.playCount || 0)} />
                  <Metric label="Play Time" value={formatPlayTime(game.metadata?.playTime || 0)} />
                  <Metric label="Last Played" value={game.metadata?.lastPlayed ? formatLastPlayed(game.metadata.lastPlayed) : 'Never'} />
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="workbench-window">
              <div className="workbench-titlebar">MOUNT_PANEL</div>
              <div className="workbench-body space-y-3">
                {!isConfigured && <div className="border-2 border-warning bg-warning-soft p-3 text-xs text-warning">Configuration required before launch.</div>}
                {!isRunnerAvailable && <div className="border-2 border-danger bg-danger-soft p-3 text-xs text-danger">Runner image unavailable: {requiredRunner}</div>}
                {isRunning && session && (
                  <div className="terminal-log">
                    <div>SESSION={session.id}</div>
                    <div>CONTAINER={session.containerId?.substring(0, 12) || 'unknown'}</div>
                  </div>
                )}
                {isRunning ? (
                  <button onClick={stopGame} disabled={launching} className="pixel-button pixel-button-danger w-full">
                    <StopIcon className="h-4 w-4" />
                    Stop Game
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => launchGame('local')} disabled={!isConfigured || !isRunnerAvailable || launching} className="pixel-button pixel-button-success">
                      <PlayIcon className="h-4 w-4" />
                      Launch
                    </button>
                    <button onClick={() => launchGame('streaming')} disabled={!isConfigured || launching} className="pixel-button">
                      <SignalIcon className="h-4 w-4" />
                      Stream
                    </button>
                    <button onClick={() => launchGame('local', { keepContainer: true, keepAlive: true })} disabled={!isConfigured || launching} className="pixel-button col-span-2">
                      <BugAntIcon className="h-4 w-4" />
                      Debug Launch
                    </button>
                    <button onClick={() => launchGame('streaming', { keepContainer: true, keepAlive: true })} disabled={!isConfigured || launching} className="pixel-button col-span-2">
                      <BugAntIcon className="h-4 w-4" />
                      Debug Stream
                    </button>
                  </div>
                )}
                <button onClick={() => setDeleteConfirm(true)} className="pixel-button pixel-button-danger w-full">
                  <TrashIcon className="h-4 w-4" />
                  Delete Module
                </button>
              </div>
            </div>

            <div className="workbench-window">
              <div className="workbench-titlebar">CONTROL_STATUS</div>
              <div className="workbench-body space-y-2">
                {configuredPlatforms.length > 0 ? configuredPlatforms.map((platform) => (
                  <div key={platform.platformId} className="border-2 border-neutral bg-background p-3">
                    <div className="text-xs font-bold uppercase text-primary">{getPlatformName(platform.platformId)}</div>
                    <div className="mt-1 break-all text-[11px] text-muted">{platform.filePath || platform.settings?.launch?.command || 'Configured'}</div>
                  </div>
                )) : (
                  <div className="terminal-log">No configured platforms.</div>
                )}
              </div>
            </div>

            <div className="workbench-window">
              <div className="workbench-titlebar">RATINGS_METADATA</div>
              <div className="workbench-body space-y-3 text-sm">
                <Metric label="Rating" value={game.metadata?.rating ? `${game.metadata.rating}/10` : 'Unrated'} />
                <div className="flex flex-wrap gap-2">
                  {(game.metadata?.genre || game.tags || []).map((genre) => <span key={genre} className="status-pill">{genre}</span>)}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {game.metadata?.similarGames && game.metadata.similarGames.length > 0 && (
        <section className="workbench-window">
          <div className="workbench-titlebar">RELATED_MODULES</div>
          <div className="workbench-body grid gap-3 md:grid-cols-3">
            {game.metadata.similarGames.slice(0, 6).map((similar) => (
              <div key={similar.title} className="border-2 border-neutral bg-background p-3">
                <div className="font-display text-sm font-black uppercase text-text">{similar.title}</div>
                {similar.gameId ? <Link href={`/games/${similar.gameId}`} className="mt-2 inline-block text-xs text-primary">Open Module</Link> : <span className="mt-2 inline-block text-xs text-muted">Discovery candidate</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {deleteConfirm && (
        <ConfirmationModal
          title="Delete Game"
          message={`Delete "${game.title}" from your library?`}
          confirmText="Delete"
          cancelText="Cancel"
          destructive
          onConfirm={() => {
            setDeleteConfirm(false);
            void deleteGame();
          }}
          onCancel={() => setDeleteConfirm(false)}
        />
      )}

      {wineVersionMismatchModal && (
        <ConfirmationModal
          title="Wine Version Mismatch"
          message={`"${game.title}" was installed with Wine version "${wineVersionMismatchModal.installVersion}" but you're trying to run it with "${wineVersionMismatchModal.currentVersion}".\n\nRunning with a different Wine version than the one used during installation may cause issues.`}
          confirmText="Run Anyway"
          cancelText="Cancel"
          onConfirm={() => {
            void launchGame(wineVersionMismatchModal.launchMode, wineVersionMismatchModal.launchOptions, true);
            setWineVersionMismatchModal(null);
          }}
          onCancel={() => setWineVersionMismatchModal(null)}
        />
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-2 border-neutral bg-background p-3">
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1 break-words text-sm font-bold text-text">{value}</div>
    </div>
  );
}
