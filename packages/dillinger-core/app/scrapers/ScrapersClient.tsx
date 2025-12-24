'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type {
  GetScraperSettingsResponse,
  SearchGamesRequest,
  SearchGamesResponse,
  GameSearchResult,
  ScraperType,
} from '@dillinger/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function ScrapersClient() {
  const searchParams = useSearchParams();
  const [availableScrapers, setAvailableScrapers] = useState<
    GetScraperSettingsResponse['availableScrapers']
  >([]);
  const [selectedScraper, setSelectedScraper] = useState<ScraperType | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GameSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [similarTitles, setSimilarTitles] = useState<string[]>([]);

  useEffect(() => {
    loadScrapers();

    // Check if we have similarTitles in query params
    const similarParam = searchParams.get('similar');
    if (similarParam) {
      try {
        const titles = JSON.parse(decodeURIComponent(similarParam));
        if (Array.isArray(titles) && titles.length > 0) {
          setSimilarTitles(titles);
        }
      } catch (err) {
        console.error('Failed to parse similar titles:', err);
      }
    }
  }, [searchParams]);

  // Auto-search when similarTitles are loaded
  useEffect(() => {
    if (similarTitles.length > 0 && selectedScraper && !hasSearched) {
      handleBatchSearch(similarTitles);
    }
  }, [similarTitles, selectedScraper]);

  const loadScrapers = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/settings/scrapers`);
      if (!response.ok) {
        throw new Error('Failed to load scrapers');
      }
      const data: GetScraperSettingsResponse = await response.json();
      setAvailableScrapers(data.availableScrapers);

      // Auto-select first enabled scraper
      const enabledScraper = data.availableScrapers.find((s) => s.enabled);
      if (enabledScraper) {
        setSelectedScraper(enabledScraper.type);
      }
    } catch (err) {
      console.error('Failed to load scrapers:', err);
      setError('Failed to load scraper settings');
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
      setHasSearched(true);

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

  const handleBatchSearch = async (titles: string[]) => {
    if (titles.length === 0 || !selectedScraper) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setHasSearched(true);

      const payload = {
        titles,
        scraperType: selectedScraper as ScraperType,
        limit: 5,
      };

      const response = await fetch(`${API_BASE_URL}/api/scrapers/search-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Batch search failed');
      }

      const data: SearchGamesResponse = await response.json();
      setSearchResults(data.results);
    } catch (err) {
      console.error('Batch search failed:', err);
      setError('Batch search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const enabledScrapers = availableScrapers.filter((s) => s.enabled);
  const hasNoScrapers = enabledScrapers.length === 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">
          {similarTitles.length > 0 ? 'Similar Games' : 'Game Metadata Scraper'}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {similarTitles.length > 0
            ? `Searching for ${similarTitles.length} similar titles`
            : 'Search for games and fetch detailed metadata including screenshots, descriptions, and more'}
        </p>
      </div>

      {similarTitles.length > 0 && (
        <div className="bg-blue-100 dark:bg-blue-900 p-4 rounded-lg mb-6">
          <h3 className="font-semibold mb-2">Similar Titles:</h3>
          <div className="flex flex-wrap gap-2">
            {similarTitles.map((title, idx) => (
              <span
                key={idx}
                className="bg-blue-200 dark:bg-blue-800 px-3 py-1 rounded-full text-sm"
              >
                {title}
              </span>
            ))}
          </div>
        </div>
      )}

      {hasNoScrapers ? (
        <div className="bg-yellow-100 dark:bg-yellow-900 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">No Scrapers Configured</h2>
          <p className="mb-4">
            You need to configure at least one scraper before you can search for games.
          </p>
          <Link
            href="/settings"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Go to Settings
          </Link>
        </div>
      ) : (
        <>
          {/* Search Form */}
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

            {error && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !searchQuery.trim() || !selectedScraper}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>

          {/* Search Results */}
          {loading ? (
            <div className="text-center py-12">
              <div className="text-xl">Searching...</div>
            </div>
          ) : hasSearched && searchResults.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-md">
              <div className="text-xl text-gray-600 dark:text-gray-400">No results found</div>
            </div>
          ) : searchResults.length > 0 ? (
            <div>
              <h2 className="text-2xl font-semibold mb-4">Search Results ({searchResults.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {searchResults.map((game) => (
                  <Link
                    key={`${game.scraperType}-${game.scraperId}`}
                    href={`/scrapers/${game.scraperType}/${game.scraperId}`}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
                  >
                    {game.coverUrl && (
                      <div className="w-full h-48 bg-gray-200 dark:bg-gray-700">
                        <img
                          src={game.coverUrl}
                          alt={game.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-4">
                      <h3 className="font-semibold text-lg mb-2 line-clamp-2">{game.title}</h3>
                      {game.releaseDate && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {new Date(game.releaseDate).getFullYear()}
                        </p>
                      )}
                      {game.platforms && game.platforms.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {game.platforms.slice(0, 3).map((platform, idx) => (
                            <span
                              key={idx}
                              className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded"
                            >
                              {platform}
                            </span>
                          ))}
                          {game.platforms.length > 3 && (
                            <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                              +{game.platforms.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                      {game.summary && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-3">
                          {game.summary}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
      </div>
    </div>
  );
}