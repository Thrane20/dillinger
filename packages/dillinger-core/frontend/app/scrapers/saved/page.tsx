'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { SavedGameMetadata } from '@dillinger/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function SavedGamesPage() {
  const [savedGames, setSavedGames] = useState<SavedGameMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSavedGames();
  }, []);

  const loadSavedGames = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/scrapers/saved`);
      if (!response.ok) {
        throw new Error('Failed to load saved games');
      }
      const data: SavedGameMetadata[] = await response.json();
      setSavedGames(data);
    } catch (err) {
      console.error('Failed to load saved games:', err);
      setError('Failed to load saved games');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-xl">Loading saved games...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-8">
        <div className="bg-red-100 dark:bg-red-900 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Saved Game Metadata</h1>
        <p className="text-gray-600 dark:text-gray-400">
          {savedGames.length} game{savedGames.length !== 1 ? 's' : ''} saved to your library
        </p>
        <Link
          href="/scrapers"
          className="inline-block mt-4 text-blue-600 dark:text-blue-400 hover:underline"
        >
          ← Back to Search
        </Link>
      </div>

      {savedGames.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <div className="text-xl text-gray-600 dark:text-gray-400 mb-4">
            No saved games yet
          </div>
          <Link
            href="/scrapers"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Search for Games
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {savedGames.map((savedGame) => {
            const game = savedGame.scraperData;
            const coverImage = savedGame.localImages.cover
              ? `/api/images/${savedGame.slug}/${savedGame.localImages.cover}`
              : game.cover?.url;

            return (
              <div
                key={savedGame.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden"
              >
                {coverImage && (
                  <div className="w-full h-64 bg-gray-200 dark:bg-gray-700">
                    <img
                      src={coverImage}
                      alt={game.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-4">
                  <h3 className="font-semibold text-lg mb-2">{game.title}</h3>
                  
                  {game.releaseDate && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {new Date(game.releaseDate).getFullYear()}
                    </p>
                  )}

                  {game.platforms && game.platforms.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {game.platforms.slice(0, 3).map((platform, idx) => (
                        <span
                          key={idx}
                          className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded"
                        >
                          {platform.name}
                        </span>
                      ))}
                      {game.platforms.length > 3 && (
                        <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                          +{game.platforms.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                      <div>
                        <strong>Slug:</strong> {savedGame.slug}
                      </div>
                      <div>
                        <strong>ID:</strong> {savedGame.id}
                      </div>
                      <div>
                        <strong>Saved:</strong>{' '}
                        {new Date(savedGame.savedAt).toLocaleDateString()}
                      </div>
                      <div>
                        <strong>Images:</strong>{' '}
                        {savedGame.localImages.screenshots.length + savedGame.localImages.artworks.length}
                        {savedGame.localImages.cover && ' + cover'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
