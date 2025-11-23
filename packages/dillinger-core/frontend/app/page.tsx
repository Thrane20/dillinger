'use client';

import { useState, useEffect } from 'react';
import { formatLastPlayed, formatPlayTime } from './utils/timeFormat';
import type { DownloadProgressBody, Game as SharedGame, GamePlatformConfig } from '@dillinger/shared';

// Frontend Game interface (same as shared but we re-export for clarity)
type Game = SharedGame;

interface Session {
  id: string;
  gameId: string;
  status: string;
  containerId?: string;
}

export default function GamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [filteredGames, setFilteredGames] = useState<Game[]>([]);
  const [filterText, setFilterText] = useState('');
  const [sessions, setSessions] = useState<Record<string, Session>>({});
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [hoveredGameId, setHoveredGameId] = useState<string | null>(null);
  const [backdropFadeDuration, setBackdropFadeDuration] = useState(0.5);
  const [displayedBackdrop, setDisplayedBackdrop] = useState<string | null>(null);
  const [backdropOpacity, setBackdropOpacity] = useState(0);
  const [gridColumns, setGridColumns] = useState(2); // Default to 2 columns

  const hoveredGame = hoveredGameId ? games.find(g => g.id === hoveredGameId) : null;
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
    loadGames();
    
    // Load backdrop fade duration from settings
    const loadBackdropSettings = () => {
      const duration = parseFloat(localStorage.getItem('backdropFadeDuration') || '0.5');
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
    
    // WebSocket connection for download progress
    // WebSockets cannot be proxied by Next.js, connect directly to backend
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const backendHost = process.env.NEXT_PUBLIC_BACKEND_URL || 'localhost:3001';
    const wsUrl = `${protocol}//${backendHost}/ws/logs`;
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('[HomePage] WebSocket connected for download progress to', wsUrl);
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'download-progress') {
          const body: DownloadProgressBody = message.body;
          
          // Update the specific game with download progress
          setGames((prevGames) => 
            prevGames.map((game) => {
              if (game.id === body.gameId) {
                let status: string;
                if (body.status === 'completed') {
                  status = 'ready_to_install';
                } else if (body.status === 'failed') {
                  status = 'download_cancelled';
                } else {
                  status = 'downloading';
                }
                
                return {
                  ...game,
                  installation: {
                    ...game.installation,
                    status,
                    downloadProgress: body.totalProgress,
                  },
                };
              }
              return game;
            })
          );
        }
      } catch (error) {
        console.error('[HomePage] Error parsing WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('[HomePage] WebSocket error:', error);
    };
    
    ws.onclose = () => {
      console.log('[HomePage] WebSocket disconnected');
    };
    
    // Keep a slow polling as fallback (every 10 seconds instead of 2)
    const pollInterval = setInterval(() => {
      loadGames(true);
    }, 10000);
    
    return () => {
      window.removeEventListener('backdropSettingsChanged', handleSettingsChange);
      ws.close();
      clearInterval(pollInterval);
    };
  }, []);

  // Filter games when search text changes
  useEffect(() => {
    if (filterText.trim() === '') {
      setFilteredGames(games);
    } else {
      const searchLower = filterText.toLowerCase();
      const filtered = games.filter(game => 
        game.title.toLowerCase().includes(searchLower)
      );
      setFilteredGames(filtered);
    }
  }, [filterText, games]);

  // Handle scroll to game from URL param
  useEffect(() => {
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
  }, []); // Empty dependency array - only run on mount

  // Poll running sessions to detect when containers stop
  useEffect(() => {
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
                console.log(`Session for game ${gameId} is no longer running (status: ${currentSession.status})`);
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
  }, [sessions]); // Re-run when sessions change

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
                const downloadResponse = await fetch(`/api/games/${game.id}/download/status`);
                if (downloadResponse.ok) {
                  const downloadData = await downloadResponse.json();
                  if (downloadData.success && downloadData.status) {
                    // Only mark as cancelled if status is 'failed' (not completed)
                    if (downloadData.status.status === 'failed') {
                      return {
                        ...game,
                        installation: {
                          ...game.installation,
                          status: 'download_cancelled',
                          downloadProgress: downloadData.status.totalProgress,
                        },
                      };
                    }
                    // If completed or paused, show the game as-is (let WebSocket handle completion)
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
        setError('Failed to load games: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  async function deleteGame(gameId: string) {
    if (!confirm('Are you sure you want to delete this game from your library?')) {
      return;
    }

    try {
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
      setError('Failed to delete game: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  async function resumeDownload(game: any) {
    if (!game.metadata?.gogId) {
      setError('Cannot resume: GOG ID not found');
      return;
    }

    try {
      // Resume download by calling the same endpoint
      const response = await fetch(`/api/online-sources/gog/games/${game.metadata.gogId}/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameId: game.id,
          title: game.title,
        }),
      });

      if (response.ok) {
        // Update UI to show downloading
        setGames((prevGames) => 
          prevGames.map((g) => 
            g.id === game.id 
              ? { ...g, installation: { ...g.installation, status: 'downloading' } }
              : g
          )
        );
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to resume download');
      }
    } catch (err) {
      setError('Failed to resume download: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  async function restartDownload(game: any) {
    if (!game.metadata?.gogId) {
      setError('Cannot restart: GOG ID not found');
      return;
    }

    if (!confirm('This will delete any existing downloaded files and start fresh. Continue?')) {
      return;
    }

    try {
      // First, delete existing downloaded files by calling cancel (which cleans up)
      await fetch(`/api/games/${game.id}/download`, {
        method: 'DELETE',
      });

      // Small delay to let cleanup finish
      await new Promise(resolve => setTimeout(resolve, 500));

      // Then start a fresh download
      const response = await fetch(`/api/online-sources/gog/games/${game.metadata.gogId}/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameId: game.id,
          title: game.title,
        }),
      });

      if (response.ok) {
        // Update UI to show downloading
        setGames((prevGames) => 
          prevGames.map((g) => 
            g.id === game.id 
              ? { ...g, installation: { ...g.installation, status: 'downloading', downloadProgress: 0 } }
              : g
          )
        );
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to restart download');
      }
    } catch (err) {
      setError('Failed to restart download: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  async function launchGame(gameId: string, mode: 'local' | 'streaming' = 'local', platformId?: string) {
    setLaunching((prev) => ({ ...prev, [gameId]: true }));
    setError(null);

    try {
      const response = await fetch(`/api/launch/${gameId}/launch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode,
          platformId, // Optional platform ID for multi-platform games
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.session) {
          setSessions((prev) => ({
            ...prev,
            [gameId]: data.session,
          }));
          // Game launched successfully - no modal needed
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to launch game');
      }
    } catch (err) {
      setError('Failed to launch game: ' + (err instanceof Error ? err.message : 'Unknown error'));
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
      setError('Failed to stop game: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLaunching((prev) => ({ ...prev, [gameId]: false }));
    }
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
                <label htmlFor="filter" className="block text-sm font-medium text-muted mb-2">
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
                <label htmlFor="gridSize" className="block text-sm font-medium text-muted mb-2">
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
                  {[1, 2, 3].map(num => (
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
                <svg className="h-5 w-5 text-danger" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <h3 className="text-sm font-semibold text-danger-foreground">Error</h3>
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
                <h3 className="mt-4 text-lg font-medium text-text">No games match your filter</h3>
                <p className="mt-2 text-sm text-muted">Try a different search term.</p>
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
                <h3 className="mt-4 text-lg font-medium text-text">No games found</h3>
                <p className="mt-2 text-sm text-muted">Get started by adding your first game.</p>
              </div>
            </div>
          ) : (
            <div className={`grid gap-6 ${
              gridColumns === 1 ? 'grid-cols-1' :
              gridColumns === 2 ? 'grid-cols-2' :
              'grid-cols-3'
            }`}>
              {filteredGames.map((game) => {
            const session = sessions[game.id];
            const isLaunching = launching[game.id];
            const isRunning = session && session.status === 'running';
            
            // Get configured platforms
            const platforms = game.platforms || [];
            const hasAnyPlatform = platforms.length > 0;
            
            // Check which platforms are configured
            const configuredPlatforms = platforms.filter(p => {
              const isEmulatorPlatform = ['c64', 'c128', 'vic20', 'plus4', 'pet', 'amiga', 'amiga500', 'amiga500plus', 'amiga600', 'amiga1200', 'amiga3000', 'amiga4000', 'cd32'].includes(p.platformId);
              return p.filePath || p.settings?.launch?.command || (isEmulatorPlatform && p.filePath);
            });
            
            const isConfigured = configuredPlatforms.length > 0;
            const defaultPlatform = game.defaultPlatformId 
              ? platforms.find(p => p.platformId === game.defaultPlatformId) 
              : configuredPlatforms[0];
            
            const primaryImage = game.metadata?.primaryImage;
            
            // Check if any game is currently running
            const anyGameRunning = Object.keys(sessions).some(id => sessions[id]?.status === 'running');
            const isOtherGameRunning = anyGameRunning && !isRunning;

            return (
              <div 
                key={game.id}
                id={`game-${game.id}`}
                className={`card transition-all duration-200 hover:scale-[1.02] relative ${
                  isOtherGameRunning ? 'opacity-30' : 'opacity-100'
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
                  <div className="w-full h-48 bg-gray-200 dark:bg-gray-700 overflow-hidden">
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
                      <h3 className="text-xl font-semibold text-text w-3/4">{game.title}</h3>
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
                      <p className="text-sm text-muted">{game.metadata.developer}</p>
                    )}
                  </div>

                {game.metadata?.description && (
                  <p className="text-sm text-muted line-clamp-3">{game.metadata.description}</p>
                )}

                {/* Download Progress */}
                {(game as any).installation?.status === 'downloading' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-blue-600 dark:text-blue-400 font-medium">Downloading...</span>
                      <span className="text-muted">{(game as any).installation?.downloadProgress || 0}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                        style={{ width: `${(game as any).installation?.downloadProgress || 0}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Download Cancelled */}
                {(game as any).installation?.status === 'download_cancelled' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span className="font-medium">Download Cancelled - {(game as any).installation?.downloadProgress || 0}%</span>
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
                {(game as any).installation?.status === 'ready_to_install' && (
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium">Ready to Install</span>
                  </div>
                )}

                {/* Play Statistics */}
                  <div className="flex items-center gap-2">
                    {(!game.metadata?.playCount || game.metadata.playCount === 0) ? (
                      <div className="text-xs text-muted italic">Never played</div>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                          {game.metadata?.lastPlayed && (
                            <div className="flex items-center gap-1">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>Last: {formatLastPlayed(game.metadata.lastPlayed)}</span>
                            </div>
                          )}
                          {game.metadata?.playCount !== undefined && game.metadata.playCount > 0 && (
                            <div className="flex items-center gap-1">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>{game.metadata.playCount} {game.metadata.playCount === 1 ? 'play' : 'plays'}</span>
                            </div>
                          )}
                          {game.metadata?.playTime !== undefined && game.metadata.playTime > 0 && (
                            <div className="flex items-center gap-1">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              <span>{formatPlayTime(game.metadata.playTime)} played</span>
                            </div>
                          )}
                        </div>
                        <a
                          href={`/games/${game.id}/sessions`}
                          className="flex-shrink-0 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground hover:bg-primary-hover transition-colors"
                          title="View play history"
                        >
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
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

                  {game.metadata?.similarGames && game.metadata.similarGames.length > 0 && (
                    <div className="pt-2">
                      <a
                        href={`/scrapers?similar=${encodeURIComponent(
                          JSON.stringify(game.metadata.similarGames.map((sg) => sg.title))
                        )}`}
                        className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary-hover font-medium"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
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
                          <dt className="text-muted mb-1">Configured Platforms:</dt>
                          <dd className="flex flex-wrap gap-1">
                            {configuredPlatforms.map((platform) => (
                              <span
                                key={platform.platformId}
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                  platform.platformId === game.defaultPlatformId
                                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 ring-1 ring-blue-600'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                                }`}
                              >
                                {platform.platformId}
                                {platform.platformId === game.defaultPlatformId && ' ★'}
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
                          <span className="font-semibold text-success-foreground">Running</span>
                        </div>
                        <p className="text-muted">Container: {session.containerId?.substring(0, 12)}</p>
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
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
                        <button
                          onClick={() => launchGame(game.id, 'local')}
                          disabled={isLaunching}
                          className="bg-green-600 hover:bg-green-700 text-white rounded-md px-3 py-2 transition-colors flex-1 disabled:opacity-60 disabled:cursor-not-allowed"
                          title="Launch game locally on this machine"
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
                              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                            </svg>
                            Play Local
                          </>
                          )}
                        </button>
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
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                          </svg>
                        </a>
                        <button
                          onClick={() => deleteGame(game.id)}
                          className="px-3 py-2 border border-red-300 text-red-600 rounded hover:bg-red-50 transition-colors text-sm"
                          title="Delete game"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1v3M4 7h16" />
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
      </div>
    );
  }
