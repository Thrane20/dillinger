'use client';

import { useState, useEffect } from 'react';

interface Game {
  id: string;
  title: string;
  filePath: string;
  platformId: string;
  tags: string[];
  metadata?: {
    description?: string;
    genre?: string[];
    developer?: string;
    rating?: number;
    primaryImage?: string;
    backdropImage?: string;
  };
  settings?: {
    launch?: {
      command?: string;
      arguments?: string[];
    };
  };
}

interface Session {
  id: string;
  gameId: string;
  status: string;
  containerId?: string;
}

export default function GamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [sessions, setSessions] = useState<Record<string, Session>>({});
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [hoveredGameId, setHoveredGameId] = useState<string | null>(null);

  const hoveredGame = hoveredGameId ? games.find(g => g.id === hoveredGameId) : null;
  const backdropImage = hoveredGame?.metadata?.backdropImage;

  useEffect(() => {
    loadGames();
  }, []);

  async function loadGames() {
    try {
      const response = await fetch('/api/games');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setGames(data.data || []);
        }
      } else {
        setError('Failed to load games from API');
      }
    } catch (err) {
      setError('Failed to load games: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
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

  async function launchGame(gameId: string) {
    setLaunching((prev) => ({ ...prev, [gameId]: true }));
    setError(null);

    try {
      const response = await fetch(`/api/games/${gameId}/launch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.session) {
          setSessions((prev) => ({
            ...prev,
            [gameId]: data.session,
          }));
          alert(`Game launched successfully!\nSession ID: ${data.session.id}\nContainer ID: ${data.session.containerId}`);
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
      const response = await fetch(`/api/games/${gameId}/stop`, {
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
          alert(`Game stopped.\nDuration: ${data.session.duration} seconds`);
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
      {/* Background Backdrop with Transition */}
      <div 
        className="fixed inset-0 z-0 transition-all duration-500 ease-in-out"
        style={{
          backgroundImage: backdropImage ? `url(${backdropImage})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: backdropImage ? 0.4 : 0,
          filter: 'blur(2px)',
        }}
      />
      
      {/* Content Layer */}
      <div className="relative z-10 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-text">Games</h1>
        <div className="flex gap-3">
          <a href="/games/add" className="btn-primary">
            + Add Game
          </a>
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

      {games.length === 0 ? (
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
            <div className="mt-6">
              <a href="/add-game" className="btn-primary">
                Add Game
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => {
            const session = sessions[game.id];
            const isLaunching = launching[game.id];
            const isRunning = session && session.status === 'running';
            const isConfigured = game.filePath && game.platformId; // Game is configured if it has filePath and platform
            const primaryImage = game.metadata?.primaryImage;

            return (
              <div 
                key={game.id} 
                className="card transition-transform duration-200 hover:scale-[1.02]"
                onMouseEnter={() => setHoveredGameId(game.id)}
                onMouseLeave={() => setHoveredGameId(null)}
              >
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
                    <div className="flex items-start justify-between">
                      <h3 className="text-xl font-semibold text-text">{game.title}</h3>
                      {!isConfigured && (
                        <span className="inline-flex items-center rounded-full bg-yellow-100 dark:bg-yellow-900 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:text-yellow-100">
                          Not Configured
                        </span>
                      )}
                    </div>
                    {game.metadata?.developer && (
                      <p className="text-sm text-muted">{game.metadata.developer}</p>
                    )}
                  </div>

                  {game.metadata?.description && (
                    <p className="text-sm text-muted line-clamp-3">{game.metadata.description}</p>
                  )}

                  {game.metadata?.genre && game.metadata.genre.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {game.metadata.genre.map((genre) => (
                        <span
                          key={genre}
                          className="inline-flex items-center rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary"
                        >
                          {genre}
                        </span>
                      ))}
                    </div>
                  )}

                  {game.tags && game.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {game.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-full bg-secondary/10 px-2 py-1 text-xs font-medium text-muted"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="pt-2 border-t border-border">
                    <dl className="text-xs space-y-1">
                      <div className="flex justify-between">
                        <dt className="text-muted">Platform:</dt>
                        <dd className="font-medium text-text">{game.platformId || 'Not set'}</dd>
                      </div>
                      {game.metadata?.rating && (
                        <div className="flex justify-between">
                          <dt className="text-muted">Rating:</dt>
                          <dd className="font-medium text-text">{game.metadata.rating}/10</dd>
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
                          className="btn-primary flex-1 text-center"
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
                          onClick={() => launchGame(game.id)}
                          disabled={isLaunching}
                          className="btn-primary flex-1"
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
                              Launch Game
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
