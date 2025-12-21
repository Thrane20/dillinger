'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface GOGGame {
  id: string;
  title: string;
  image: string;
  url: string;
}

interface GOGGameDetails {
  id: string;
  title: string;
  slug: string;
  description: string;
  publisher: string;
  developer: string;
  releaseDate: string;
  genres: string[];
  images: {
    background: string | null;
    logo: string | null;
    logo2x: string | null;
    icon: string | null;
    sidebarIcon: string | null;
    sidebarIcon2x: string | null;
  };
  screenshots: Array<{
    url: string;
    thumbnail: string;
  }>;
  downloads: any;
}

interface GOGLibraryResponse {
  games: GOGGame[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  cached?: boolean;
  lastFetched?: string;
  error?: string;
}

export default function GOGLibraryPage() {
  const router = useRouter();
  const [games, setGames] = useState<GOGGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [isCached, setIsCached] = useState(false);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  
  // Modal state
  const [selectedGame, setSelectedGame] = useState<GOGGame | null>(null);
  const [gameDetails, setGameDetails] = useState<GOGGameDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [selectedRunner, setSelectedRunner] = useState<'wine' | 'linux'>('wine');
  const [addingToLibrary, setAddingToLibrary] = useState(false);

  useEffect(() => {
    loadGOGGames();
  }, []);
  
  // Load game details when a game is selected
  useEffect(() => {
    if (selectedGame) {
      console.log('Loading details for game:', selectedGame);
      loadGameDetails(selectedGame.id);
    }
  }, [selectedGame]);

  async function loadGOGGames(refresh = false) {
    setLoading(true);
    setError(null);

    try {
      // Request a large limit to get all games at once
      const baseUrl = '/api/online-sources/gog/games?limit=1000';
      const url = refresh ? `${baseUrl}&refresh=true` : baseUrl;
      const response = await fetch(url);
      if (response.ok) {
        const data: GOGLibraryResponse = await response.json();
        if (data.games) {
          setGames(data.games || []);
          setTotalPages(data.totalPages || 0);
          setIsCached(data.cached || false);
          setLastFetched(data.lastFetched || null);
        } else if (data.error) {
          setError(data.error);
        } else {
          setError('Failed to load GOG games: unexpected response format');
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load GOG games');
      }
    } catch (err) {
      setError('Failed to load GOG games: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }
  
  async function loadGameDetails(gameId: string) {
    setLoadingDetails(true);
    setDetailsError(null);
    
    try {
      const response = await fetch(`/api/online-sources/gog/games/${gameId}`);
      if (response.ok) {
        const data = await response.json();
        // API returns game data directly, not wrapped in { success, game }
        if (data.id) {
          // Transform description from { full, lead } to string if needed
          const details = {
            ...data,
            description: typeof data.description === 'object' 
              ? (data.description?.full || data.description?.lead || '') 
              : (data.description || ''),
          };
          setGameDetails(details);
        } else if (data.error) {
          setDetailsError(data.error);
        } else {
          setDetailsError('Failed to load game details: unexpected response format');
        }
      } else {
        const errorData = await response.json();
        setDetailsError(errorData.error || 'Failed to load game details');
      }
    } catch (err) {
      setDetailsError('Failed to load game details: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoadingDetails(false);
    }
  }
  
  async function addToLibrary() {
    if (!selectedGame || !gameDetails) return;
    
    setAddingToLibrary(true);
    
    try {
      // Start the download - server generates human-readable gameId from title and gogId
      const downloadResponse = await fetch(`/api/online-sources/gog/games/${selectedGame.id}/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: selectedGame.title,
          runner: selectedRunner,
          os: selectedRunner === 'linux' ? 'linux' : 'windows',
          language: 'en',
          image: selectedGame.image,
        }),
      });
      
      if (!downloadResponse.ok) {
        const errorData = await downloadResponse.json();
        throw new Error(errorData.error || 'Failed to start download');
      }
      
      await downloadResponse.json().catch(() => null);

      // Close modal and return to main library page
      setSelectedGame(null);
      setGameDetails(null);
      router.push('/');
      router.refresh();
      
    } catch (err) {
      alert('Failed to add game: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setAddingToLibrary(false);
    }
  }
  
  function closeModal() {
    setSelectedGame(null);
    setGameDetails(null);
    setDetailsError(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <a
                href="/online_sources"
                className="text-muted hover:text-primary transition-colors"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
              </a>
              <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">GOG</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-text">GOG Library</h2>
                <p className="text-sm text-muted">
                  {games.length} {games.length === 1 ? 'game' : 'games'} owned
                  {totalPages > 1 && ` (${totalPages} pages fetched)`}
                  {isCached && lastFetched && (
                    <span className="text-xs ml-2">
                      • Cached (last updated: {new Date(lastFetched).toLocaleString()})
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => loadGOGGames(false)}
                disabled={loading}
                className="text-sm text-muted hover:text-text flex items-center gap-1"
                title="Reload from cache"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Reload
              </button>
              <button
                onClick={() => loadGOGGames(true)}
                disabled={loading}
                className="text-sm text-primary hover:text-primary-hover flex items-center gap-1"
                title="Fetch latest data from GOG"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Refresh Now
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
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

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted">Loading your GOG library...</p>
            <p className="mt-2 text-xs text-muted">Fetching all pages, this may take a moment</p>
          </div>
        </div>
      ) : games.length === 0 ? (
        /* Empty State */
        <div className="card">
          <div className="card-body text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-text">No games found</h3>
            <p className="mt-2 text-sm text-muted">
              Your GOG library appears to be empty or couldn't be loaded.
            </p>
          </div>
        </div>
      ) : (
        /* Games Grid */
        <div className="grid grid-cols-4 gap-4">
          {games.map((game) => (
            <div
              key={game.id}
              className="card transition-all duration-200 hover:scale-[1.02] cursor-pointer"
              onClick={() => {
                console.log('Game clicked:', game);
                setSelectedGame(game);
              }}
            >
              {game.image && (
                <div className="w-full h-32 bg-gray-200 dark:bg-gray-700 overflow-hidden rounded-t-lg">
                  <img
                    src={game.image}
                    alt={game.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="p-3">
                <h5 className="text-sm font-semibold text-text line-clamp-2" title={game.title}>
                  {game.title}
                </h5>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Game Details Modal */}
      {selectedGame && (() => {
        console.log('Rendering modal for game:', selectedGame);
        return (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={closeModal}
          >
          <div 
            className="bg-background rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {loadingDetails ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-muted">Loading game details...</p>
              </div>
            ) : detailsError ? (
              <div className="p-8">
                <div className="alert-error">
                  <p>{detailsError}</p>
                </div>
                <button
                  onClick={closeModal}
                  className="mt-4 btn-secondary"
                >
                  Close
                </button>
              </div>
            ) : gameDetails ? (
              <>
                {/* Background Image - use details background or fall back to selected game thumbnail */}
                {(() => {
                  // Prefer the tile thumbnail (always a valid JPG), otherwise use details background.
                  let bgImage = selectedGame?.image || gameDetails.images?.background;

                  // Fix protocol-relative URLs.
                  if (bgImage && bgImage.startsWith('//')) bgImage = `https:${bgImage}`;

                  // If it's a GOG static image hash without extension, append a size suffix.
                  if (bgImage && !bgImage.match(/\.(png|jpe?g|webp)(\?|$)/i)) {
                    bgImage = `${bgImage}_1000.jpg`;
                  }

                  return bgImage ? (
                    <div 
                      className="h-64 bg-cover bg-center relative"
                      style={{ backgroundImage: `url(${bgImage})` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent"></div>
                      <button
                        onClick={closeModal}
                        className="absolute top-4 right-4 p-2 bg-black bg-opacity-50 rounded-full hover:bg-opacity-75 transition-colors"
                      >
                        <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : null;
                })()}
                
                <div className="p-8">
                  {/* Title and Logo */}
                  <div className="flex items-start gap-4 mb-6">
                    {gameDetails.images?.logo2x && (
                      <img 
                        src={gameDetails.images.logo2x.startsWith('//') ? 'https:' + gameDetails.images.logo2x : gameDetails.images.logo2x} 
                        alt={gameDetails.title}
                        className="h-16 object-contain"
                      />
                    )}
                    {!gameDetails.images?.logo2x && (
                      <h2 className="text-3xl font-bold text-text">{gameDetails.title}</h2>
                    )}
                  </div>
                  
                  {/* Metadata */}
                  <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                    {gameDetails.developer && (
                      <div>
                        <span className="text-muted">Developer:</span>
                        <span className="ml-2 text-text">{gameDetails.developer}</span>
                      </div>
                    )}
                    {gameDetails.publisher && (
                      <div>
                        <span className="text-muted">Publisher:</span>
                        <span className="ml-2 text-text">{gameDetails.publisher}</span>
                      </div>
                    )}
                    {gameDetails.releaseDate && (
                      <div>
                        <span className="text-muted">Release Date:</span>
                        <span className="ml-2 text-text">{gameDetails.releaseDate}</span>
                      </div>
                    )}
                    {gameDetails.genres && gameDetails.genres.length > 0 && (
                      <div>
                        <span className="text-muted">Genres:</span>
                        <span className="ml-2 text-text">{gameDetails.genres.join(', ')}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Description */}
                  {gameDetails.description && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-text mb-2">About</h3>
                      <div 
                        className="text-sm text-muted prose prose-sm dark:prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: gameDetails.description }}
                      />
                    </div>
                  )}
                  
                  {/* Screenshots */}
                  {gameDetails.screenshots && gameDetails.screenshots.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-text mb-3">Screenshots</h3>
                      <div className="grid grid-cols-3 gap-2">
                        {gameDetails.screenshots.slice(0, 6).map((screenshot, index) => (
                          <img
                            key={index}
                            src={screenshot.thumbnail}
                            alt={`Screenshot ${index + 1}`}
                            className="w-full h-32 object-cover rounded cursor-pointer hover:opacity-75 transition-opacity"
                            onClick={() => window.open(screenshot.url, '_blank')}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Runner Selection */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-text mb-3">Select Platform</h3>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setSelectedRunner('wine')}
                        className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors ${
                          selectedRunner === 'wine'
                            ? 'border-primary bg-primary bg-opacity-10'
                            : 'border-border hover:border-primary'
                        }`}
                      >
                        <div className="text-center">
                          <div className="font-semibold text-text">Windows (Wine)</div>
                          <div className="text-xs text-muted mt-1">Run Windows version with Wine</div>
                        </div>
                      </button>
                      <button
                        onClick={() => setSelectedRunner('linux')}
                        className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors ${
                          selectedRunner === 'linux'
                            ? 'border-primary bg-primary bg-opacity-10'
                            : 'border-border hover:border-primary'
                        }`}
                      >
                        <div className="text-center">
                          <div className="font-semibold text-text">Linux (Native)</div>
                          <div className="text-xs text-muted mt-1">Run native Linux version</div>
                        </div>
                      </button>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={addToLibrary}
                      disabled={addingToLibrary}
                      className="flex-1 btn-primary py-3"
                    >
                      {addingToLibrary ? (
                        <>
                          <span className="animate-spin inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                          Adding to Library...
                        </>
                      ) : (
                        'Add to Library & Download'
                      )}
                    </button>
                    <button
                      onClick={closeModal}
                      className="btn-secondary px-6"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
        );
      })()}
    </div>
  );
}
