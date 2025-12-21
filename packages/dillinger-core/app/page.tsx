'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatLastPlayed, formatPlayTime } from './utils/timeFormat';
import type { Game as SharedGame } from '@dillinger/shared';
import ConfirmationModal from './components/ConfirmationModal';

// Frontend Game interface (extends shared but allows UI-specific statuses and properties)
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
  };
}

interface Session {
  id: string;
  gameId: string;
  status: string;
  containerId?: string;
}

const getPlatformName = (id: string) => {
  const names: Record<string, string> = {
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
  };
  return names[id] || id;
};

// Helper to extract GOG ID from game
// Handles both old format "gog-{gogId}" and new format "gog-{slug}-{gogId}"
const getGogIdFromGame = (game: { id: string; slug?: string }): string | null => {
  const extractGogId = (str: string): string | null => {
    if (!str.startsWith('gog-')) return null;
    const withoutPrefix = str.replace('gog-', '');
    // New format: "gog-{slug}-{gogId}" - GOG IDs are 10-digit numbers at the end
    const gogIdMatch = withoutPrefix.match(/(\d{10})$/);
    if (gogIdMatch) {
      return gogIdMatch[1];
    }
    // Old format: "gog-{gogId}" - the whole thing after prefix is the ID
    if (/^\d+$/.test(withoutPrefix)) {
      return withoutPrefix;
    }
    return null;
  };
  
  return extractGogId(game.id) || (game.slug ? extractGogId(game.slug) : null);
};

export default function GamesPage() {
  const router = useRouter();
  const [bootstrapChecked, setBootstrapChecked] = useState(false);
  const [isInitialized, setIsInitialized] = useState(true);
  const [bootstrapPreview, setBootstrapPreview] = useState<{ directories: string[]; files: string[] } | null>(null);
  const [bootstrapDillingerRoot, setBootstrapDillingerRoot] = useState<string>('/data');
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [games, setGames] = useState<Game[]>([]);
  const [filteredGames, setFilteredGames] = useState<Game[]>([]);
  const [filterText, setFilterText] = useState('');
  const [sessions, setSessions] = useState<Record<string, Session>>({});
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [hoveredGameId, setHoveredGameId] = useState<string | null>(null);
  const [backdropFadeDuration, setBackdropFadeDuration] = useState(0.5);
  const [displayedBackdrop, setDisplayedBackdrop] = useState<string | null>(
    null
  );
  const [backdropOpacity, setBackdropOpacity] = useState(0);
  const [gridColumns, setGridColumns] = useState(2); // Default to 2 columns

  const [debugDialogOpenForGameId, setDebugDialogOpenForGameId] = useState<string | null>(null);

  // Delete game with download confirmation
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    gameId: string;
    gameTitle: string;
    hasDownload: boolean;
    downloadProgress: number;
  } | null>(null);

  // Resume download with cache confirmation
  const [cacheConfirmModal, setCacheConfirmModal] = useState<{
    game: Game;
    cacheSize: number;
    fileCount: number;
  } | null>(null);

  useEffect(() => {
    if (!debugDialogOpenForGameId) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDebugDialogOpenForGameId(null);
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      const path = (e.composedPath?.() || []) as EventTarget[];
      const clickedInside = path.some((t) => {
        return (
          typeof t === 'object' &&
          t !== null &&
          'getAttribute' in (t as any) &&
          typeof (t as any).getAttribute === 'function' &&
          (t as any).getAttribute('data-debug-menu') === 'true'
        );
      });

      if (!clickedInside) {
        setDebugDialogOpenForGameId(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, [debugDialogOpenForGameId]);

  const hoveredGame = hoveredGameId
    ? games.find((g) => g.id === hoveredGameId)
    : null;
  const backdropImage = hoveredGame?.metadata?.backdropImage;

  // Handle backdrop changes with proper fade timing
  useEffect(() => {
    if (backdropImage === displayedBackdrop) return undefined;

    if (!backdropImage) {
      // Fade out
      setBackdropOpacity(0);
      const timeout = setTimeout(() => {
        setDisplayedBackdrop(null);
      }, backdropFadeDuration * 1000);
      return () => clearTimeout(timeout);
    } else if (!displayedBackdrop) {
      // Fade in from nothing
      setDisplayedBackdrop(backdropImage);
      setTimeout(() => setBackdropOpacity(0.4), 50);
      return undefined;
    } else {
      // Crossfade: fade out current, then fade in new
      setBackdropOpacity(0);
      const timeout = setTimeout(() => {
        setDisplayedBackdrop(backdropImage);
        setTimeout(() => setBackdropOpacity(0.4), 50);
      }, backdropFadeDuration * 1000);
      return () => clearTimeout(timeout);
    }
  }, [backdropImage, displayedBackdrop, backdropFadeDuration]);

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
        // If the bootstrap status fails, default to existing behavior.
        setIsInitialized(true);
      } finally {
        setBootstrapChecked(true);
      }
    };

    checkBootstrap();

    // Only load the app data after bootstrap is confirmed.
    // This prevents other components from touching /api/health and implicitly creating directories.
    // loadGames() will be called in a follow-up effect once initialized.

    // Load backdrop fade duration from settings
    const loadBackdropSettings = () => {
      const duration = parseFloat(
        localStorage.getItem('backdropFadeDuration') || '0.5'
      );
      setBackdropFadeDuration(duration);
    };

    // Load grid columns from localStorage
    const savedColumns = localStorage.getItem('gridColumns');
    if (savedColumns) {
      setGridColumns(parseInt(savedColumns, 10));
    }

    loadBackdropSettings();

    // Listen for settings changes
    const handleSettingsChange = () => {
      loadBackdropSettings();
    };

    window.addEventListener('backdropSettingsChanged', handleSettingsChange);

    return () => {
      window.removeEventListener(
        'backdropSettingsChanged',
        handleSettingsChange
      );
    };
  }, []);

  useEffect(() => {
    if (!bootstrapChecked) return;
    if (!isInitialized) {
      setLoading(false);
      return;
    }
    loadGames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrapChecked, isInitialized]);

  useEffect(() => {
    if (!bootstrapChecked) return;
    if (!isInitialized) return;

    // Poll for updates while downloads / installs are in progress
    const pollInterval = setInterval(() => {
      loadGames(true);
    }, 5000);

    return () => clearInterval(pollInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrapChecked, isInitialized]);

  const runBootstrap = async () => {
    setIsBootstrapping(true);
    setError(null);
    try {
      const res = await fetch('/api/bootstrap/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Bootstrap failed (${res.status})`);
      }
      // Reload to start the app fresh against the now-scaffolded volume.
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bootstrap failed');
      setIsBootstrapping(false);
    }
  };

  const bootstrapLoadingView = (
    <div className="min-h-screen bg-background text-text flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-surface border border-border rounded-xl p-6">
        <h1 className="text-xl font-semibold">Checking your Dillinger setup…</h1>
        <p className="mt-2 text-sm text-muted">
          Looking for an existing database under{' '}
          <span className="font-mono">{bootstrapDillingerRoot}</span>.
        </p>
      </div>
    </div>
  );

  const onboardingView = (() => {
    const preview = bootstrapPreview || { directories: [], files: [] };
    return (
      <div className="min-h-screen bg-background text-text flex items-center justify-center p-6">
        <div className="w-full max-w-3xl bg-surface border border-border rounded-xl p-6">
          <h1 className="text-2xl font-semibold">Oh hi there… looks like you’re new here…</h1>
          <p className="mt-3 text-sm text-muted">
            Your <span className="font-mono">dillinger_root</span> volume is configured and mounted, but it looks empty.
            When you click OK, Dillinger will scaffold the base folders and config files it needs, then start fresh.
          </p>

          <div className="mt-5">
            <h2 className="text-sm font-semibold text-text">What will be created</h2>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-background p-3">
                <div className="text-xs font-semibold text-muted">Directories (relative to {bootstrapDillingerRoot})</div>
                <ul className="mt-2 text-sm text-text space-y-1">
                  {preview.directories.map((d) => (
                    <li key={d} className="font-mono">{d}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-background p-3">
                <div className="text-xs font-semibold text-muted">Files (relative to {bootstrapDillingerRoot})</div>
                <ul className="mt-2 text-sm text-text space-y-1">
                  {preview.files.map((f) => (
                    <li key={f} className="font-mono">{f}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-border bg-background p-4">
            <h2 className="text-sm font-semibold text-text">Already have a Dillinger database?</h2>
            <p className="mt-2 text-sm text-muted">
              If you expected your library to show up, please double-check your volume / file mapping.
              Dillinger expects the host data directory to be mounted as the <span className="font-mono">dillinger_root</span> volume at <span className="font-mono">/data</span> in the container.
            </p>
            <pre className="mt-3 text-xs overflow-auto p-3 rounded-md bg-surface border border-border">
docker volume create \\
  --driver local \\
  --opt type=none \\
  --opt device=/path/to/your/dillinger/data \\
  --opt o=bind \\
  dillinger_root

docker run -p 3010:3010 -v dillinger_root:/data dillinger-core:latest
            </pre>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-border bg-background p-3 text-sm text-danger">
              {error}
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              onClick={() => router.refresh()}
              disabled={isBootstrapping}
              className="px-4 py-2 text-sm font-medium text-text bg-surface border border-border rounded-lg hover:bg-hover transition-colors disabled:opacity-50"
            >
              Re-check
            </button>
            <button
              onClick={runBootstrap}
              disabled={isBootstrapping}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-colors bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isBootstrapping ? 'Scaffolding…' : 'OK'}
            </button>
          </div>
        </div>
      </div>
    );
  })();

  // Filter games when search text changes
  useEffect(() => {
    if (filterText.trim() === '') {
      setFilteredGames(games);
    } else {
      const searchLower = filterText.toLowerCase();
      const filtered = games.filter((game) =>
        game.title.toLowerCase().includes(searchLower)
      );
      setFilteredGames(filtered);
    }
  }, [filterText, games]);

  // Handle scroll to game from URL param
  useEffect(() => {
    if (!bootstrapChecked) return;
    if (!isInitialized) return;
    const params = new URLSearchParams(window.location.search);
    const scrollTo = params.get('scrollTo');
    if (scrollTo) {
      // If we have a scrollTo param, reload games to ensure the new game is in the list
      loadGames().then(() => {
        // Wait a bit for the DOM to render
        setTimeout(() => {
          const element = document.getElementById(`game-${scrollTo}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Add a highlight effect
            element.classList.add('ring-4', 'ring-blue-500');
            setTimeout(() => {
              element.classList.remove('ring-4', 'ring-blue-500');
            }, 2000);
          }
        }, 100);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrapChecked, isInitialized]);

  // Poll running sessions to detect when containers stop
  useEffect(() => {
    if (!bootstrapChecked) return;
    if (!isInitialized) return;
    const pollInterval = setInterval(async () => {
      // Check if we have any running sessions
      const runningSessions = Object.entries(sessions).filter(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        ([_, session]) => session.status === 'running'
      );

      if (runningSessions.length === 0) {
        return; // Nothing to poll
      }

      // Check each running session
      for (const [gameId, session] of runningSessions) {
        try {
          const response = await fetch(`/api/launch/${gameId}/sessions`);
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.sessions) {
              // Find the current session
              const currentSession = data.sessions.find(
                (s: any) => s.id === session.id
              );

              if (currentSession && currentSession.status !== 'running') {
                // Session is no longer running - remove from local state
                console.log(
                  `Session for game ${gameId} is no longer running (status: ${currentSession.status})`
                );
                setSessions((prev) => {
                  const newSessions = { ...prev };
                  delete newSessions[gameId];
                  return newSessions;
                });
              }
            }
          }
        } catch (err) {
          console.error(`Error polling session for game ${gameId}:`, err);
        }
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [bootstrapChecked, isInitialized, sessions]); // Re-run when sessions change

  async function loadGames(silent = false) {
    try {
      const response = await fetch('/api/games');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const games = data.data || [];

          // Check download status for each game
          const gamesWithDownloadStatus = await Promise.all(
            games.map(async (game: any) => {
              try {
                const downloadResponse = await fetch(
                  `/api/games/${game.id}/download/status`
                );
                if (downloadResponse.ok) {
                  const downloadData = await downloadResponse.json();
                  if (downloadData.success && downloadData.status) {
                    const dlStatus = downloadData.status;
                    
                    // Handle different download states
                    if (dlStatus.status === 'failed') {
                      return {
                        ...game,
                        installation: {
                          ...game.installation,
                          status: 'download_cancelled',
                          downloadProgress: dlStatus.totalProgress,
                        },
                      };
                    } else if (dlStatus.status === 'downloading' || dlStatus.status === 'queued') {
                      return {
                        ...game,
                        installation: {
                          ...game.installation,
                          status: 'downloading',
                          downloadProgress: dlStatus.totalProgress,
                        },
                      };
                    } else if (dlStatus.status === 'paused') {
                      return {
                        ...game,
                        installation: {
                          ...game.installation,
                          status: 'download_cancelled',
                          downloadProgress: dlStatus.totalProgress,
                        },
                      };
                    }
                    // If completed, let the game keep its current state
                  }
                }
              } catch (err) {
                // Ignore errors for individual games
              }
              return game;
            })
          );

          setGames(gamesWithDownloadStatus);
          // Clear any previous errors on successful load
          if (!silent) {
            setError(null);
          }
        }
      } else {
        if (!silent) {
          setError('Failed to load games from API');
        }
      }
    } catch (err) {
      if (!silent) {
        setError(
          'Failed to load games: ' +
            (err instanceof Error ? err.message : 'Unknown error')
        );
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  async function deleteGame(gameId: string) {
    // Find the game to get its title
    const game = games.find(g => g.id === gameId);
    if (!game) return;

    try {
      // Check if there's an active download for this game
      const cacheResponse = await fetch(`/api/online-sources/gog/downloads/${gameId}/cache`);
      const cacheData = await cacheResponse.json();

      if (cacheData.success && (cacheData.hasActiveDownload || cacheData.cacheExists)) {
        // Show modal to ask about download/cache
        setDeleteConfirmModal({
          gameId,
          gameTitle: game.title,
          hasDownload: cacheData.hasActiveDownload,
          downloadProgress: cacheData.downloadProgress || 0,
        });
        return;
      }
    } catch (err) {
      console.error('Failed to check download status:', err);
      // Continue with regular delete flow if check fails
    }

    // No download - use simple confirm
    if (!confirm('Are you sure you want to delete this game from your library?')) {
      return;
    }

    await performDeleteGame(gameId, false);
  }

  async function performDeleteGame(gameId: string, deleteCache: boolean) {
    try {
      // If requested, delete the cache first
      if (deleteCache) {
        await fetch(`/api/online-sources/gog/downloads/${gameId}/cache`, {
          method: 'DELETE',
        });
      }

      const response = await fetch(`/api/games/${gameId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Remove from local state
          setGames((prev) => prev.filter((g) => g.id !== gameId));
          // Also remove any active session
          setSessions((prev) => {
            const newSessions = { ...prev };
            delete newSessions[gameId];
            return newSessions;
          });
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete game');
      }
    } catch (err) {
      setError(
        'Failed to delete game: ' +
          (err instanceof Error ? err.message : 'Unknown error')
      );
    }
  }

  async function resumeDownload(game: Game) {
    const gogId = getGogIdFromGame(game);
    if (!gogId) {
      setError('Cannot resume: GOG ID not found');
      return;
    }

    try {
      // Check if there are existing cache files
      const cacheResponse = await fetch(`/api/online-sources/gog/downloads/${game.id}/cache`);
      const cacheData = await cacheResponse.json();

      // If there's already an active download, just continue it
      if (cacheData.success && cacheData.hasActiveDownload) {
        await performResumeDownload(game);
        return;
      }

      // If there are cache files but no active download, ask user what to do
      if (cacheData.success && cacheData.cacheExists && cacheData.fileCount > 0) {
        setCacheConfirmModal({
          game,
          cacheSize: cacheData.cacheSize,
          fileCount: cacheData.fileCount,
        });
        return;
      }

      // No cache, start fresh
      await performResumeDownload(game);
    } catch (err) {
      console.error('Failed to check cache:', err);
      // Continue with download anyway
      await performResumeDownload(game);
    }
  }

  async function performResumeDownload(game: Game, clearCache: boolean = false) {
    const gogId = getGogIdFromGame(game);
    if (!gogId) {
      setError('Cannot resume: GOG ID not found');
      return;
    }

    try {
      // Clear cache if requested
      if (clearCache) {
        await fetch(`/api/online-sources/gog/downloads/${game.id}/cache`, {
          method: 'DELETE',
        });
        // Small delay for cleanup
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      // Resume/start download by calling the download endpoint
      const response = await fetch(
        `/api/online-sources/gog/games/${gogId}/download`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            gameId: game.id,
            title: game.title,
          }),
        }
      );

      if (response.ok) {
        // Update UI to show downloading
        setGames((prevGames) =>
          prevGames.map((g) =>
            g.id === game.id
              ? {
                  ...g,
                  installation: { ...g.installation, status: 'downloading' },
                }
              : g
          )
        );
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to resume download');
      }
    } catch (err) {
      setError(
        'Failed to resume download: ' +
          (err instanceof Error ? err.message : 'Unknown error')
      );
    }
  }

  async function restartDownload(game: Game) {
    const gogId = getGogIdFromGame(game);
    if (!gogId) {
      setError('Cannot restart: GOG ID not found');
      return;
    }

    if (
      !confirm(
        'This will delete any existing downloaded files and start fresh. Continue?'
      )
    ) {
      return;
    }

    try {
      // First, delete existing downloaded files by calling cancel (which cleans up)
      await fetch(`/api/games/${game.id}/download`, {
        method: 'DELETE',
      });

      // Small delay to let cleanup finish
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Then start a fresh download
      const response = await fetch(
        `/api/online-sources/gog/games/${gogId}/download`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            gameId: game.id,
            title: game.title,
          }),
        }
      );

      if (response.ok) {
        // Update UI to show downloading
        setGames((prevGames) =>
          prevGames.map((g) =>
            g.id === game.id
              ? {
                  ...g,
                  installation: {
                    ...g.installation,
                    status: 'downloading',
                    downloadProgress: 0,
                  },
                }
              : g
          )
        );
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to restart download');
      }
    } catch (err) {
      setError(
        'Failed to restart download: ' +
          (err instanceof Error ? err.message : 'Unknown error')
      );
    }
  }

  async function launchGame(
    gameId: string,
    mode: 'local' | 'streaming' = 'local',
    platformId?: string,
    options?: { keepContainer?: boolean; keepAlive?: boolean }
  ) {
    setLaunching((prev) => ({ ...prev, [gameId]: true }));
    setError(null);

    try {
      const response = await fetch(`/api/launch/${gameId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode,
          platformId, // Optional platform ID for multi-platform games
          keepContainer: options?.keepContainer === true,
          keepAlive: options?.keepAlive === true,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.session) {
          setSessions((prev) => ({
            ...prev,
            [gameId]: data.session,
          }));
          if (options?.keepContainer === true || options?.keepAlive === true) {
            router.push(`/debug/${gameId}/${data.session.id}`);
          }
          // Game launched successfully - no modal needed
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to launch game');
      }
    } catch (err) {
      setError(
        'Failed to launch game: ' +
          (err instanceof Error ? err.message : 'Unknown error')
      );
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: session.id,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSessions((prev) => {
            const newSessions = { ...prev };
            delete newSessions[gameId];
            return newSessions;
          });
          // Game stopped successfully - refresh to show updated stats
          await loadGames();
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to stop game');
      }
    } catch (err) {
      setError(
        'Failed to stop game: ' +
          (err instanceof Error ? err.message : 'Unknown error')
      );
    } finally {
      setLaunching((prev) => ({ ...prev, [gameId]: false }));
    }
  }

  // Important: do not early-return before all hooks have been declared.
  // Returning here (near the end of the component) keeps hook order stable.
  if (!bootstrapChecked) {
    return bootstrapLoadingView;
  }

  if (!isInitialized) {
    return onboardingView;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      {/* Background Backdrop with Smooth Transition */}
      {displayedBackdrop && (
        <div
          className="fixed inset-0 z-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${displayedBackdrop})`,
            filter: 'blur(2px)',
            opacity: backdropOpacity,
            transition: `opacity ${backdropFadeDuration}s ease-in-out`,
          }}
        />
      )}

      {/* Content */}
      <div className="relative z-10 space-y-6">
        {/* Filter Input and Grid Size Control */}
        <div className="card">
          <div className="card-body">
            <div className="flex gap-4 items-end">
              {/* Search Filter - 3/4 width */}
              <div className="w-3/4">
                <label
                  htmlFor="filter"
                  className="block text-sm font-medium text-muted mb-2"
                >
                  Filter Games
                </label>
                <input
                  type="text"
                  id="filter"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="Search by title..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-text focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {filterText && (
                  <p className="mt-1 text-sm text-muted">
                    Showing {filteredGames.length} of {games.length} games
                  </p>
                )}
              </div>

              {/* Grid Size Slider - 1/4 width */}
              <div className="w-1/4">
                <label
                  htmlFor="gridSize"
                  className="block text-sm font-medium text-muted mb-2"
                >
                  Grid: {gridColumns} {gridColumns === 1 ? 'col' : 'cols'}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    id="gridSize"
                    min="1"
                    max="3"
                    step="1"
                    value={gridColumns}
                    onChange={(e) => {
                      const newValue = parseInt(e.target.value, 10);
                      setGridColumns(newValue);
                      localStorage.setItem('gridColumns', newValue.toString());
                    }}
                    className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>
                <div className="flex justify-between mt-1 text-xs text-muted">
                  {[1, 2, 3].map((num) => (
                    <button
                      key={num}
                      onClick={() => {
                        setGridColumns(num);
                        localStorage.setItem('gridColumns', num.toString());
                      }}
                      className={`hover:text-primary transition-colors ${gridColumns === num ? 'text-primary font-semibold' : ''}`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="alert-error">
            <div className="flex items-start gap-3">
              <svg
                className="h-5 w-5 text-danger"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <h3 className="text-sm font-semibold text-danger-foreground">
                  Error
                </h3>
                <p className="mt-2 text-sm text-muted">{error}</p>
              </div>
            </div>
          </div>
        )}

        {filteredGames.length === 0 && games.length > 0 ? (
          <div className="card">
            <div className="card-body text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-text">
                No games match your filter
              </h3>
              <p className="mt-2 text-sm text-muted">
                Try a different search term.
              </p>
              <div className="mt-6">
                <button
                  onClick={() => setFilterText('')}
                  className="btn-primary"
                >
                  Clear Filter
                </button>
              </div>
            </div>
          </div>
        ) : games.length === 0 ? (
          <div className="card">
            <div className="card-body text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-text">
                No games found
              </h3>
              <p className="mt-2 text-sm text-muted">
                Get started by adding your first game.
              </p>
            </div>
          </div>
        ) : (
          <div
            className={`grid gap-6 ${
              gridColumns === 1
                ? 'grid-cols-1'
                : gridColumns === 2
                  ? 'grid-cols-2'
                  : 'grid-cols-3'
            }`}
          >
            {filteredGames.map((game) => {
              const session = sessions[game.id];
              const isLaunching = launching[game.id];
              const isRunning = session && session.status === 'running';

              // Get configured platforms
              const platforms = game.platforms || [];

              // Check which platforms are configured
              const configuredPlatforms = platforms.filter((p) => {
                const isEmulatorPlatform = [
                  'c64',
                  'c128',
                  'vic20',
                  'plus4',
                  'pet',
                  'amiga',
                  'amiga500',
                  'amiga500plus',
                  'amiga600',
                  'amiga1200',
                  'amiga3000',
                  'amiga4000',
                  'cd32',
                ].includes(p.platformId);
                return (
                  p.filePath ||
                  p.settings?.launch?.command ||
                  (isEmulatorPlatform && p.filePath)
                );
              });

              const isConfigured = configuredPlatforms.length > 0;

              const primaryImage = game.metadata?.primaryImage;

              // Check if any game is currently running
              const anyGameRunning = Object.keys(sessions).some(
                (id) => sessions[id]?.status === 'running'
              );
              const isOtherGameRunning = anyGameRunning && !isRunning;

              const isAnotherGameHovered =
                hoveredGameId !== null && hoveredGameId !== game.id;

              return (
                <div
                  key={game.id}
                  id={`game-${game.id}`}
                  className={`card transition-all duration-200 hover:scale-[1.02] relative ${
                    isOtherGameRunning
                      ? 'opacity-30'
                      : isAnotherGameHovered
                        ? 'opacity-90'
                        : 'opacity-100'
                  }`}
                  onMouseEnter={() => setHoveredGameId(game.id)}
                  onMouseLeave={() => setHoveredGameId(null)}
                >
                  {/* Loading Spinner Overlay */}
                  {isLaunching && (
                    <div className="absolute inset-0 bg-white dark:bg-gray-900 bg-opacity-80 dark:bg-opacity-80 z-10 flex items-center justify-center rounded-lg">
                      <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                        <p className="text-sm font-medium text-text">
                          {isRunning ? 'Stopping...' : 'Launching...'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Primary Image */}
                  {primaryImage && (
                    <div className="w-full h-48 bg-gray-200 dark:bg-gray-700 overflow-hidden rounded-t-3xl">
                      <img
                        src={primaryImage}
                        alt={game.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="card-body space-y-4">
                    <div>
                      <div className="flex items-start gap-4">
                        <h3 className="text-xl font-semibold text-text w-3/4">
                          {game.title}
                        </h3>
                        <div className="flex-1 flex justify-end">
                          {!isConfigured ? (
                            <span className="inline-flex items-center rounded-full bg-yellow-100 dark:bg-yellow-900 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:text-yellow-100">
                              Placeholder
                            </span>
                          ) : (
                            <div /> /* placeholder to keep equal spacing */
                          )}
                        </div>
                      </div>
                      {game.metadata?.developer && (
                        <p className="text-sm text-muted">
                          {game.metadata.developer}
                        </p>
                      )}
                    </div>

                    {game.metadata?.description && (
                      <p className="text-sm text-muted line-clamp-3">
                        {game.metadata.description}
                      </p>
                    )}

                    {/* Download Progress */}
                    {(game as any).installation?.status === 'downloading' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-blue-600 dark:text-blue-400 font-medium">
                            Downloading...
                          </span>
                          <span className="text-muted">
                            {(game as any).installation?.downloadProgress || 0}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                            style={{
                              width: `${(game as any).installation?.downloadProgress || 0}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {/* Download Cancelled */}
                    {(game as any).installation?.status ===
                      'download_cancelled' && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                          </svg>
                          <span className="font-medium">
                            Download Cancelled -{' '}
                            {(game as any).installation?.downloadProgress || 0}%
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => resumeDownload(game)}
                            className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Resume
                          </button>
                          <button
                            onClick={() => restartDownload(game)}
                            className="flex-1 px-3 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                          >
                            Restart
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Ready to Install Badge */}
                    {(game as any).installation?.status ===
                      'ready_to_install' && (
                      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span className="font-medium">Ready to Install</span>
                      </div>
                    )}

                    {/* Play Statistics */}
                    <div className="flex items-center gap-2">
                      {!game.metadata?.playCount ||
                      game.metadata.playCount === 0 ? (
                        <div className="text-xs text-muted italic">
                          Never played
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                            {game.metadata?.lastPlayed && (
                              <div className="flex items-center gap-1">
                                <svg
                                  className="h-3.5 w-3.5"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                                <span>
                                  Last:{' '}
                                  {formatLastPlayed(game.metadata.lastPlayed)}
                                </span>
                              </div>
                            )}
                            {game.metadata?.playCount !== undefined &&
                              game.metadata.playCount > 0 && (
                                <div className="flex items-center gap-1">
                                  <svg
                                    className="h-3.5 w-3.5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                                    />
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                  </svg>
                                  <span>
                                    {game.metadata.playCount}{' '}
                                    {game.metadata.playCount === 1
                                      ? 'play'
                                      : 'plays'}
                                  </span>
                                </div>
                              )}
                            {game.metadata?.playTime !== undefined &&
                              game.metadata.playTime > 0 && (
                                <div className="flex items-center gap-1">
                                  <svg
                                    className="h-3.5 w-3.5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M13 10V3L4 14h7v7l9-11h-7z"
                                    />
                                  </svg>
                                  <span>
                                    {formatPlayTime(game.metadata.playTime)}{' '}
                                    played
                                  </span>
                                </div>
                              )}
                          </div>
                          <a
                            href={`/games/${game.id}/sessions`}
                            className="flex-shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground hover:bg-primary-hover transition-colors"
                            title="View play history"
                          >
                            <svg
                              className="w-3 h-3"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </a>
                        </>
                      )}
                    </div>

                    {game.metadata?.genre && game.metadata.genre.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {game.metadata.genre.map((genre) => (
                          <span
                            key={genre}
                            className="inline-flex items-center rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-secondary-foreground"
                          >
                            {genre}
                          </span>
                        ))}
                      </div>
                    )}

                    {game.metadata?.similarGames &&
                      game.metadata.similarGames.length > 0 && (
                        <div className="pt-2">
                          <a
                            href={`/scrapers?similar=${encodeURIComponent(
                              JSON.stringify(
                                game.metadata.similarGames.map((sg) => sg.title)
                              )
                            )}`}
                            className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary-hover font-medium"
                          >
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                              />
                            </svg>
                            ({game.metadata.similarGames.length}) Similar Titles
                          </a>
                        </div>
                      )}

                    <div className="pt-2 border-t border-border">
                      <dl className="text-xs space-y-1">
                        {/* Show configured platforms */}
                        {configuredPlatforms.length > 0 ? (
                          <div>
                            <dt className="text-muted mb-1">
                              Configured Platforms:
                            </dt>
                            <dd className="flex flex-wrap gap-1">
                              {configuredPlatforms.map((platform) => (
                                <span
                                  key={platform.platformId}
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                    platform.platformId ===
                                    game.defaultPlatformId
                                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 ring-1 ring-blue-600'
                                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                                  }`}
                                >
                                  {getPlatformName(platform.platformId)}
                                  {platform.platformId ===
                                    game.defaultPlatformId && ' ★'}
                                </span>
                              ))}
                            </dd>
                          </div>
                        ) : (
                          <div className="flex justify-between">
                            <dt className="text-muted">Platform:</dt>
                            <dd className="font-medium text-text">Not set</dd>
                          </div>
                        )}

                        {!isConfigured && (
                          <div className="flex justify-between">
                            <dt className="text-muted">Status:</dt>
                            <dd className="font-medium text-yellow-600 dark:text-yellow-400">
                              Needs configuration
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>

                    {isRunning && session && (
                      <div className="alert-success">
                        <div className="text-xs space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="inline-block h-2 w-2 rounded-full bg-success animate-pulse"></span>
                            <span className="font-semibold text-success-foreground">
                              Running
                            </span>
                          </div>
                          <p className="text-muted">
                            Container: {session.containerId?.substring(0, 12)}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {!isConfigured ? (
                        // Show prominent configure button for unconfigured games
                        <>
                          <a
                            href={`/games/${game.id}/edit`}
                            className="bg-gray-600 hover:bg-gray-400 text-white rounded-md px-3 py-2 transition-colors flex-1 inline-flex items-center justify-center"
                          >
                            <svg
                              className="inline-block h-4 w-4 mr-2"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                            </svg>
                            Configure Game
                          </a>
                          <button
                            onClick={() => deleteGame(game.id)}
                            className="px-3 py-2 border border-red-300 text-red-600 rounded hover:bg-red-50 transition-colors text-sm"
                            title="Delete game"
                          >
                            <svg
                              className="h-5 w-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </>
                      ) : isRunning ? (
                        <button
                          onClick={() => stopGame(game.id)}
                          disabled={isLaunching}
                          className="btn-danger flex-1"
                        >
                          {isLaunching ? (
                            <>
                              <span className="animate-spin inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                              Stopping...
                            </>
                          ) : (
                            'Stop Game'
                          )}
                        </button>
                      ) : (
                        <>
                          <div className="relative inline-flex" data-debug-menu="true">
                            <button
                              onClick={() => launchGame(game.id, 'local')}
                              disabled={isLaunching}
                              className="bg-green-700 hover:bg-green-800 text-white rounded-l-md px-3 py-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                              title="Launch normally"
                            >
                              Launch
                            </button>
                            <button
                              onClick={() =>
                                setDebugDialogOpenForGameId((prev) =>
                                  prev === game.id ? null : game.id
                                )
                              }
                              disabled={isLaunching}
                              className="bg-green-700 hover:bg-green-800 text-white rounded-r-md px-2 py-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed border-l border-green-900/30"
                              title="Open debug options"
                              aria-label="Open debug options"
                            >
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 9l-7 7-7-7"
                                />
                              </svg>
                            </button>

                            {debugDialogOpenForGameId === game.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-[9998]"
                                  data-debug-menu="true"
                                  onClick={() => setDebugDialogOpenForGameId(null)}
                                />
                                <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-gray-800 border border-border rounded-lg shadow-lg z-[9999]" data-debug-menu="true">
                                <div className="p-3 border-b border-border">
                                  <div className="text-sm font-semibold text-text">
                                    Start Debugging
                                  </div>
                                  <div className="text-xs text-muted mt-1">
                                    Keeps the container alive for logs/inspect.
                                  </div>
                                </div>
                                <div className="p-3 flex gap-2">
                                  <button
                                    onClick={() => {
                                      setDebugDialogOpenForGameId(null);
                                      void launchGame(game.id, 'local', undefined, {
                                        keepContainer: true,
                                        keepAlive: true,
                                      });
                                    }}
                                    disabled={isLaunching}
                                    className="flex-1 bg-purple-600 hover:bg-purple-700 text-white rounded-md px-3 py-2 transition-colors disabled:opacity-60"
                                    title="Debug launch (keep container + keep alive)"
                                  >
                                    {isLaunching ? (
                                      <span className="inline-flex items-center gap-2">
                                        <span className="animate-spin inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                        Launching…
                                      </span>
                                    ) : (
                                      'Start Debugging'
                                    )}
                                  </button>
                                  <button
                                    onClick={() => setDebugDialogOpenForGameId(null)}
                                    className="px-3 py-2 rounded-md bg-gray-200 dark:bg-gray-700 text-text hover:opacity-90"
                                    title="Cancel"
                                  >
                                    Cancel
                                  </button>
                                </div>
                                </div>
                              </>
                            )}
                          </div>
                          <button
                            onClick={() => launchGame(game.id, 'streaming')}
                            disabled={isLaunching}
                            className="bg-blue-600 hover:bg-blue-700 text-white rounded-md px-3 py-2 transition-colors flex-1 disabled:opacity-60 disabled:cursor-not-allowed"
                            title="Launch game for streaming via Moonlight"
                          >
                            {isLaunching ? (
                              <>
                                <span className="animate-spin inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                                Launching...
                              </>
                            ) : (
                              <>
                                <svg
                                  className="inline-block h-4 w-4 mr-2"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                                  />
                                </svg>
                                Stream
                              </>
                            )}
                          </button>
                          <a
                            href={`/games/${game.id}/edit`}
                            className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
                            title="Manage game"
                          >
                            <svg
                              className="h-5 w-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                              />
                            </svg>
                          </a>
                          <button
                            onClick={() => deleteGame(game.id)}
                            className="px-3 py-2 border border-red-300 text-red-600 rounded hover:bg-red-50 transition-colors text-sm"
                            title="Delete game"
                          >
                            <svg
                              className="h-5 w-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Game with Download Confirmation Modal */}
      {deleteConfirmModal && (
        <ConfirmationModal
          title={deleteConfirmModal.hasDownload ? 'Download In Progress' : 'Delete Game'}
          message={
            deleteConfirmModal.hasDownload
              ? `"${deleteConfirmModal.gameTitle}" has a download in progress (${deleteConfirmModal.downloadProgress}% complete).\n\nWhat would you like to do with the downloaded files?`
              : `Are you sure you want to delete "${deleteConfirmModal.gameTitle}" from your library?\n\nNote: There are partially downloaded files for this game.`
          }
          confirmText="Keep Files"
          cancelText="Cancel"
          destructive={false}
          extraButtons={[
            {
              text: 'Delete Files',
              variant: 'destructive',
              onClick: () => {
                performDeleteGame(deleteConfirmModal.gameId, true);
                setDeleteConfirmModal(null);
              },
            },
          ]}
          onConfirm={() => {
            performDeleteGame(deleteConfirmModal.gameId, false);
            setDeleteConfirmModal(null);
          }}
          onCancel={() => setDeleteConfirmModal(null)}
        />
      )}

      {/* Resume Download with Cache Confirmation Modal */}
      {cacheConfirmModal && (
        <ConfirmationModal
          title="Existing Download Files Found"
          message={`Found ${cacheConfirmModal.fileCount} file(s) (${formatBytes(cacheConfirmModal.cacheSize)}) from a previous download.\n\nWould you like to use them, or start fresh?`}
          confirmText="Use Existing"
          cancelText="Cancel"
          extraButtons={[
            {
              text: 'Start Fresh',
              variant: 'secondary',
              onClick: () => {
                performResumeDownload(cacheConfirmModal.game, true);
                setCacheConfirmModal(null);
              },
            },
          ]}
          onConfirm={() => {
            performResumeDownload(cacheConfirmModal.game, false);
            setCacheConfirmModal(null);
          }}
          onCancel={() => setCacheConfirmModal(null)}
        />
      )}
    </div>
  );
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
