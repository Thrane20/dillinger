'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type {
  GetScraperSettingsResponse,
  SearchGamesResponse,
  SearchGamesRequest,
  ScraperType,
  GameSearchResult,
} from '@dillinger/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface PageProps {
  params?: {
    id: string;
  };
}

export default function GameScrapeClient({ params }: PageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeParams = useParams<{ id?: string | string[] }>();

  const gameIdFromRoute = Array.isArray(routeParams?.id) ? routeParams.id[0] : routeParams?.id;
  const gameId = gameIdFromRoute || params?.id;
  const hasValidGameId = Boolean(gameId && gameId !== 'undefined' && gameId !== 'null');
  const encodedGameId = hasValidGameId ? encodeURIComponent(gameId as string) : '';
  const titleFromParam = searchParams.get('title') || '';

  const [gameTitle, setGameTitle] = useState<string>('');
  const [availableScrapers, setAvailableScrapers] = useState<
    GetScraperSettingsResponse['availableScrapers']
  >([]);
  const [selectedScraper, setSelectedScraper] = useState<ScraperType | ''>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<GameSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const enabledScrapers = useMemo(
    () => availableScrapers.filter((s) => s.enabled),
    [availableScrapers]
  );

  useEffect(() => {
    void Promise.all([loadGame(), loadScrapers()]);
  }, [gameId]);

  useEffect(() => {
    if (titleFromParam.trim()) {
      setSearchQuery(titleFromParam.trim());
      return;
    }
    if (gameTitle.trim()) {
      setSearchQuery(gameTitle.trim());
    }
  }, [titleFromParam, gameTitle]);

  const loadScrapers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/settings/scrapers`);
      if (!response.ok) {
        throw new Error('Failed to load scrapers');
      }
      const data: GetScraperSettingsResponse = await response.json();
      setAvailableScrapers(data.availableScrapers);

      const enabled = data.availableScrapers.find((s) => s.enabled);
      if (enabled) {
        setSelectedScraper(enabled.type);
      }
    } catch (err) {
      console.error('Failed to load scrapers:', err);
      setError('Failed to load scrapers. Configure scrapers in Settings.');
    }
  };

  const loadGame = async () => {
    try {
      if (!hasValidGameId) {
        return;
      }
      const response = await fetch(`${API_BASE_URL}/api/games/${encodedGameId}`);
      if (!response.ok) {
        throw new Error('Failed to load game');
      }
      const data = await response.json();
      setGameTitle(data?.data?.title || '');
    } catch (err) {
      console.error('Failed to load game:', err);
      // Not fatal
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchQuery.trim() || !selectedScraper) {
      setError('Please enter a search query and select a scraper');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setMessage(null);

      const payload: SearchGamesRequest = {
        query: searchQuery.trim(),
        scraperType: selectedScraper as ScraperType,
        limit: 20,
      };

      const response = await fetch(`${API_BASE_URL}/api/scrapers/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data: SearchGamesResponse = await response.json();
      setSearchResults(data.results);
    } catch (err) {
      console.error('Search failed:', err);
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const applyResult = async (result: GameSearchResult) => {
    try {
      if (!hasValidGameId) {
        setMessage({ type: 'error', text: 'Apply failed: missing game id' });
        return;
      }
      setApplying(true);
      setError(null);
      setMessage(null);

      const response = await fetch(`${API_BASE_URL}/api/games/${encodedGameId}/scrape/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scraperType: result.scraperType,
          scraperId: result.scraperId,
          downloadImages: true,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.message || 'Apply failed');
      }

      setMessage({ type: 'success', text: 'Metadata applied to game.' });
      router.refresh();
      router.push(`/?scrollTo=${encodedGameId}`);
    } catch (err) {
      console.error('Apply failed:', err);
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Apply failed' });
    } finally {
      setApplying(false);
    }
  };

  const hasNoScrapers = enabledScrapers.length === 0;

  return (
    <div className="container mx-auto p-8 max-w-6xl">
      <div className="mb-6">
        <Link
          href={hasValidGameId ? `/?scrollTo=${encodedGameId}` : '/'}
          className="text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block"
        >
          ← Back to Library
        </Link>
        <h1 className="text-3xl font-bold mb-2">Scrape Data</h1>
        <p className="text-gray-600 dark:text-gray-400">
          {gameTitle ? `For: ${gameTitle}` : 'Search for metadata and apply it to this game.'}
        </p>
      </div>

      {!hasValidGameId && (
        <div className="bg-red-100 dark:bg-red-900 p-6 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-2">Missing Game ID</h2>
          <p className="mb-4">
            This page must be opened from a specific game. The URL should look like
            {' '}
            <span className="font-mono">/games/&lt;id&gt;/scrape</span>.
          </p>
          <Link
            href="/"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Back to Library
          </Link>
        </div>
      )}

      {hasNoScrapers ? (
        <div className="bg-yellow-100 dark:bg-yellow-900 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">No Scrapers Configured</h2>
          <p className="mb-4">Configure a scraper in Settings first.</p>
          <Link
            href="/settings"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Go to Settings
          </Link>
        </div>
      ) : (
        <>
          <form
            onSubmit={handleSearch}
            className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-8"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="md:col-span-2">
                <label htmlFor="searchQuery" className="block text-sm font-medium mb-1">
                  Game Title
                </label>
                <input
                  type="text"
                  id="searchQuery"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter game title..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label htmlFor="scraper" className="block text-sm font-medium mb-1">
                  Scraper
                </label>
                <select
                  id="scraper"
                  value={selectedScraper}
                  onChange={(e) => setSelectedScraper(e.target.value as ScraperType)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {enabledScrapers.map((scraper) => (
                    <option key={scraper.type} value={scraper.type}>
                      {scraper.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {(error || message) && (
              <div
                className={`mb-4 p-3 rounded-lg ${
                  (message?.type || 'error') === 'success'
                    ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100'
                    : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100'
                }`}
              >
                {error || message?.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || applying || !searchQuery.trim() || !selectedScraper}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>

          {loading ? (
            <div className="text-center py-12">
              <div className="text-xl">Searching...</div>
            </div>
          ) : searchResults.length === 0 ? null : (
            <div>
              <h2 className="text-2xl font-semibold mb-4">Search Results ({searchResults.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {searchResults.map((g) => (
                  <div
                    key={`${g.scraperType}-${g.scraperId}`}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden"
                  >
                    {g.coverUrl && (
                      <div className="w-full h-40 bg-gray-200 dark:bg-gray-700 overflow-hidden">
                        <img src={g.coverUrl} alt={g.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-4">
                      <div className="font-semibold text-text mb-1">{g.title}</div>
                      {g.releaseDate && (
                        <div className="text-xs text-muted mb-2">
                          {new Date(g.releaseDate).toLocaleDateString()}
                        </div>
                      )}
                      {g.summary && <p className="text-sm text-muted line-clamp-3 mb-3">{g.summary}</p>}

                      <div className="flex gap-2">
                        <Link
                          href={`/scrapers/${g.scraperType}/${g.scraperId}`}
                          className="flex-1 text-center px-3 py-2 border border-border rounded-md hover:bg-surface transition-colors text-sm"
                          title="Open full scraper detail"
                        >
                          Details
                        </Link>
                        <button
                          onClick={() => void applyResult(g)}
                          disabled={applying}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-md px-3 py-2 transition-colors disabled:opacity-60 text-sm"
                          title="Apply this result to the game"
                        >
                          {applying ? 'Applying...' : 'Apply'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
