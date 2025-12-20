'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type {
  GetGameDetailResponse,
  GameDetailData,
  SaveGameMetadataRequest,
  SaveGameMetadataResponse,
} from '@dillinger/shared';
import ImageCarousel from '../../../components/ImageCarousel';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface PageProps {
  params: {
    scraperType: string;
    scraperId: string;
  };
}

export default function GameDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { scraperType, scraperId } = params;
  const [game, setGame] = useState<GameDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedGameId, setSavedGameId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    loadGameDetail();
  }, [scraperType, scraperId]);

  const loadGameDetail = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/scrapers/game/${scraperType}/${scraperId}`);
      if (!response.ok) {
        throw new Error('Failed to load game details');
      }
      const data: GetGameDetailResponse = await response.json();
      setGame(data.game);
    } catch (err) {
      console.error('Failed to load game details:', err);
      setError('Failed to load game details');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGame = async () => {
    if (!game) return;

    try {
      setSaving(true);
      setSaveMessage(null);

      const payload: SaveGameMetadataRequest = {
        scraperId: game.scraperId,
        scraperType: game.scraperType,
        downloadImages: true,
      };

      const response = await fetch(`${API_BASE_URL}/api/scrapers/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to save game');
      }

      const data: SaveGameMetadataResponse = await response.json();
      setSavedGameId(data.gameId);
      setSaveMessage({
        type: 'success',
        text: `Game saved successfully!`,
      });

      // Don't auto-redirect anymore, let user click the button
    } catch (err) {
      console.error('Failed to save game:', err);
      setSaveMessage({
        type: 'error',
        text: 'Failed to save game. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleGoToGame = () => {
    if (savedGameId) {
      // Refresh the router cache to ensure games list is up-to-date
      router.refresh();
      router.push(`/?scrollTo=${savedGameId}`);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-xl">Loading game details...</div>
        </div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="container mx-auto p-8">
        <div className="bg-red-100 dark:bg-red-900 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">Error</h2>
          <p className="mb-4">{error || 'Game not found'}</p>
          <Link
            href="/scrapers"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Back to Search
          </Link>
        </div>
      </div>
    );
  }

  const allImages = [
    ...(game.cover ? [{ url: game.cover.url, alt: `${game.title} cover` }] : []),
    ...(game.screenshots || []).map((s) => ({ url: s.url, alt: `${game.title} screenshot` })),
    ...(game.artworks || []).map((a) => ({ url: a.url, alt: `${game.title} artwork` })),
  ];

  return (
    <div className="container mx-auto p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/scrapers"
          className="text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block"
        >
          ← Back to Search
        </Link>
        <h1 className="text-4xl font-bold mb-2">{game.title}</h1>
        {game.alternativeTitles && game.alternativeTitles.length > 0 && (
          <p className="text-gray-600 dark:text-gray-400">
            Also known as: {game.alternativeTitles.join(', ')}
          </p>
        )}
      </div>

      {saveMessage && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            saveMessage.type === 'success'
              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100'
              : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100'
          }`}
        >
          <p className="font-medium">{saveMessage.text}</p>
          {saveMessage.type === 'success' && savedGameId && (
            <button
              onClick={handleGoToGame}
              className="mt-3 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors font-medium"
            >
              Go to Game Entry →
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Images */}
        <div className="lg:col-span-2">
          {allImages.length > 0 ? (
            <ImageCarousel images={allImages} />
          ) : (
            <div className="w-full h-96 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
              <p className="text-gray-500 dark:text-gray-400">No images available</p>
            </div>
          )}

          {/* Description */}
          {game.summary && (
            <div className="mt-8 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <h2 className="text-2xl font-semibold mb-3">Summary</h2>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{game.summary}</p>
            </div>
          )}

          {game.storyline && (
            <div className="mt-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <h2 className="text-2xl font-semibold mb-3">Storyline</h2>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {game.storyline}
              </p>
            </div>
          )}

          {/* Videos */}
          {game.videos && game.videos.length > 0 && (
            <div className="mt-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <h2 className="text-2xl font-semibold mb-3">Videos</h2>
              <div className="space-y-2">
                {game.videos.map((video, idx) => (
                  <a
                    key={idx}
                    href={video.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {video.name || `Video ${idx + 1}`} →
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Metadata */}
        <div className="space-y-6">
          {/* Save Button */}
          <button
            onClick={handleSaveGame}
            disabled={saving}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-lg"
          >
            {saving ? 'Saving...' : 'Save Game to Library'}
          </button>

          {/* Release Info */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="font-semibold text-lg mb-3">Release Info</h3>
            <div className="space-y-2 text-sm">
              {game.releaseDate && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Release Date:</span>
                  <br />
                  <span className="font-medium">
                    {new Date(game.releaseDate).toLocaleDateString()}
                  </span>
                </div>
              )}
              {game.developers && game.developers.length > 0 && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Developer:</span>
                  <br />
                  <span className="font-medium">{game.developers.join(', ')}</span>
                </div>
              )}
              {game.publishers && game.publishers.length > 0 && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400">Publisher:</span>
                  <br />
                  <span className="font-medium">{game.publishers.join(', ')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Platforms */}
          {game.platforms && game.platforms.length > 0 && (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <h3 className="font-semibold text-lg mb-3">Platforms</h3>
              <div className="flex flex-wrap gap-2">
                {game.platforms.map((platform, idx) => (
                  <span
                    key={idx}
                    className="bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded text-sm"
                  >
                    {platform.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Genres & Themes */}
          {((game.genres && game.genres.length > 0) || (game.themes && game.themes.length > 0)) && (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <h3 className="font-semibold text-lg mb-3">Genres & Themes</h3>
              <div className="space-y-2">
                {game.genres && game.genres.length > 0 && (
                  <div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Genres:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {game.genres.map((genre, idx) => (
                        <span
                          key={idx}
                          className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 px-2 py-1 rounded text-xs"
                        >
                          {genre}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {game.themes && game.themes.length > 0 && (
                  <div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">Themes:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {game.themes.map((theme, idx) => (
                        <span
                          key={idx}
                          className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-100 px-2 py-1 rounded text-xs"
                        >
                          {theme}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Ratings */}
          {(game.rating || game.ageRatings) && (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <h3 className="font-semibold text-lg mb-3">Ratings</h3>
              <div className="space-y-2 text-sm">
                {game.rating && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Score:</span>
                    <br />
                    <span className="font-medium text-lg">{Math.round(game.rating)}/100</span>
                    {game.ratingCount && (
                      <span className="text-gray-600 dark:text-gray-400 text-xs ml-1">
                        ({game.ratingCount} ratings)
                      </span>
                    )}
                  </div>
                )}
                {game.ageRatings && game.ageRatings.length > 0 && (
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Age Rating:</span>
                    <br />
                    {game.ageRatings.map((rating, idx) => (
                      <span key={idx} className="font-medium mr-2">
                        {rating.category}: {rating.rating}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Websites */}
          {game.websites && game.websites.length > 0 && (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
              <h3 className="font-semibold text-lg mb-3">Links</h3>
              <div className="space-y-1">
                {game.websites.map((website, idx) => (
                  <a
                    key={idx}
                    href={website.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-blue-600 dark:text-blue-400 hover:underline text-sm capitalize"
                  >
                    {website.category} →
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
