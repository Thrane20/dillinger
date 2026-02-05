'use client';

import { useState, useEffect } from 'react';

interface Game {
  id: string;
  title: string;
  slug?: string;
  metadata?: {
    description?: string;
    developer?: string;
    publisher?: string;
    releaseDate?: string;
    primaryImage?: string;
    screenshots?: string[];
    genre?: string[];
    playCount?: number;
    playTime?: number;
    lastPlayed?: string;
    similarGames?: { title: string }[];
  };
  platforms?: Array<{
    platformId: string;
    filePath?: string;
    settings?: {
      launch?: { command?: string };
    };
  }>;
  defaultPlatformId?: string;
  installation?: {
    status?: string;
    downloadProgress?: number;
  };
}

interface Session {
  id: string;
  gameId: string;
  status: string;
  containerId?: string;
}

interface GameDetailModalProps {
  game: Game;
  session?: Session;
  isLaunching: boolean;
  isRunnerAvailable: boolean;
  onClose: () => void;
  onLaunch: (mode: 'local' | 'streaming') => void;
  onLaunchDebug: () => void;
  onLaunchDebugStreaming: () => void;
  onStop: () => void;
  onDelete: () => void;
  getPlatformName: (id: string) => string;
  formatLastPlayed: (date: string) => string;
  formatPlayTime: (minutes: number) => string;
}

export default function GameDetailModal({
  game,
  session,
  isLaunching,
  isRunnerAvailable,
  onClose,
  onLaunch,
  onLaunchDebug,
  onLaunchDebugStreaming,
  onStop,
  onDelete,
  getPlatformName,
  formatLastPlayed,
  formatPlayTime,
}: GameDetailModalProps) {
  const [currentScreenshotIndex, setCurrentScreenshotIndex] = useState(0);
  const screenshots = game.metadata?.screenshots || [];
  const isRunning = session && session.status === 'running';

  // Get configured platforms
  const platforms = game.platforms || [];
  const configuredPlatforms = platforms.filter((p) => {
    const isEmulatorPlatform = [
      'c64', 'c128', 'vic20', 'plus4', 'pet',
      'amiga', 'amiga500', 'amiga500plus', 'amiga600', 'amiga1200', 'amiga3000', 'amiga4000', 'cd32',
    ].includes(p.platformId);
    return p.filePath || p.settings?.launch?.command || (isEmulatorPlatform && p.filePath);
  });
  const isConfigured = configuredPlatforms.length > 0;

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && screenshots.length > 1) {
        setCurrentScreenshotIndex((prev) => (prev - 1 + screenshots.length) % screenshots.length);
      } else if (e.key === 'ArrowRight' && screenshots.length > 1) {
        setCurrentScreenshotIndex((prev) => (prev + 1) % screenshots.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, screenshots.length]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
          title="Close (Esc)"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header Image / Screenshot Carousel */}
        <div className="relative h-80 bg-gray-900 flex-shrink-0">
          {screenshots.length > 0 ? (
            <>
              <img
                src={screenshots[currentScreenshotIndex]}
                alt={`${game.title} screenshot ${currentScreenshotIndex + 1}`}
                className="w-full h-full object-contain"
              />
              {screenshots.length > 1 && (
                <>
                  {/* Navigation Arrows */}
                  <button
                    onClick={() => setCurrentScreenshotIndex((prev) => (prev - 1 + screenshots.length) % screenshots.length)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
                    title="Previous (←)"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setCurrentScreenshotIndex((prev) => (prev + 1) % screenshots.length)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
                    title="Next (→)"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  {/* Dots Indicator */}
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {screenshots.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentScreenshotIndex(idx)}
                        className={`w-2 h-2 rounded-full transition-colors ${
                          idx === currentScreenshotIndex ? 'bg-white' : 'bg-white/50 hover:bg-white/75'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : game.metadata?.primaryImage ? (
            <img
              src={game.metadata.primaryImage}
              alt={game.title}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500">
              <svg className="h-24 w-24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Title and Developer */}
          <div>
            <h2 className="text-3xl font-bold text-text">{game.title}</h2>
            {game.metadata?.developer && (
              <p className="text-lg text-muted mt-1">by {game.metadata.developer}</p>
            )}
            {game.metadata?.publisher && game.metadata.publisher !== game.metadata.developer && (
              <p className="text-sm text-muted">Published by {game.metadata.publisher}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            {!isConfigured ? (
              <>
                <a
                  href={`/games/${game.id}/edit`}
                  className="bg-gray-600 hover:bg-gray-500 text-white rounded-lg px-6 py-3 transition-colors inline-flex items-center gap-2 font-medium"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Configure Game
                </a>
                <button
                  onClick={onDelete}
                  className="px-6 py-3 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  title="Delete game"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            ) : isRunning ? (
              <button
                onClick={onStop}
                disabled={isLaunching}
                className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-6 py-3 transition-colors font-medium disabled:opacity-60"
              >
                {isLaunching ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="animate-spin inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Stopping...
                  </span>
                ) : (
                  'Stop Game'
                )}
              </button>
            ) : (
              <>
                <button
                  onClick={() => onLaunch('local')}
                  disabled={isLaunching || !isRunnerAvailable}
                  className="bg-green-700 hover:bg-green-800 text-white rounded-lg px-6 py-3 transition-colors font-medium disabled:opacity-60 inline-flex items-center gap-2"
                  title={!isRunnerAvailable ? 'Runner image not available' : 'Launch normally'}
                >
                  {isLaunching ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="animate-spin inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      Launching...
                    </span>
                  ) : (
                    <>
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Launch
                    </>
                  )}
                </button>
                <button
                  onClick={() => onLaunch('streaming')}
                  disabled={isLaunching}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-3 transition-colors font-medium disabled:opacity-60 inline-flex items-center gap-2"
                  title="Launch game for streaming via Moonlight"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Stream
                </button>
                <button
                  onClick={onLaunchDebugStreaming}
                  disabled={isLaunching}
                  className="bg-purple-500 hover:bg-purple-600 text-white rounded-lg px-6 py-3 transition-colors font-medium disabled:opacity-60 inline-flex items-center gap-2"
                  title="Debug stream (keep container after exit)"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Debug Stream
                </button>
                <button
                  onClick={onLaunchDebug}
                  disabled={isLaunching || !isRunnerAvailable}
                  className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-6 py-3 transition-colors font-medium disabled:opacity-60 inline-flex items-center gap-2"
                  title="Debug launch (keep container)"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  Debug
                </button>
                <a
                  href={`/games/${game.id}/edit`}
                  className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors inline-flex items-center gap-2"
                  title="Manage game"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  Configure
                </a>
                <button
                  onClick={onDelete}
                  className="px-6 py-3 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  title="Delete game"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            )}
          </div>

          {/* Running Status */}
          {isRunning && session && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full bg-green-500 animate-pulse"></span>
                <span className="font-semibold text-green-700 dark:text-green-400">Running</span>
                <span className="text-muted text-sm">• Container: {session.containerId?.substring(0, 12)}</span>
              </div>
            </div>
          )}

          {/* Description */}
          {game.metadata?.description && (
            <div>
              <h3 className="text-lg font-semibold text-text mb-2">About</h3>
              <p className="text-muted leading-relaxed">{game.metadata.description}</p>
            </div>
          )}

          {/* Game Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {game.metadata?.releaseDate && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <dt className="text-xs text-muted uppercase tracking-wider">Release Date</dt>
                <dd className="text-sm font-medium text-text mt-1">
                  {new Date(game.metadata.releaseDate).toLocaleDateString()}
                </dd>
              </div>
            )}
            {game.metadata?.playCount !== undefined && game.metadata.playCount > 0 && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <dt className="text-xs text-muted uppercase tracking-wider">Play Count</dt>
                <dd className="text-sm font-medium text-text mt-1">
                  {game.metadata.playCount} {game.metadata.playCount === 1 ? 'session' : 'sessions'}
                </dd>
              </div>
            )}
            {game.metadata?.playTime !== undefined && game.metadata.playTime > 0 && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <dt className="text-xs text-muted uppercase tracking-wider">Play Time</dt>
                <dd className="text-sm font-medium text-text mt-1">{formatPlayTime(game.metadata.playTime)}</dd>
              </div>
            )}
            {game.metadata?.lastPlayed && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <dt className="text-xs text-muted uppercase tracking-wider">Last Played</dt>
                <dd className="text-sm font-medium text-text mt-1">{formatLastPlayed(game.metadata.lastPlayed)}</dd>
              </div>
            )}
          </div>

          {/* Genres */}
          {game.metadata?.genre && game.metadata.genre.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-text mb-2">Genres</h3>
              <div className="flex flex-wrap gap-2">
                {game.metadata.genre.map((genre) => (
                  <span
                    key={genre}
                    className="inline-flex items-center rounded-full bg-primary-soft px-4 py-1.5 text-sm font-medium text-secondary-foreground"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Platforms */}
          {configuredPlatforms.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-text mb-2">Configured Platforms</h3>
              <div className="flex flex-wrap gap-2">
                {configuredPlatforms.map((platform) => (
                  <span
                    key={platform.platformId}
                    className={`inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium ${
                      platform.platformId === game.defaultPlatformId
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 ring-1 ring-blue-600'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    {getPlatformName(platform.platformId)}
                    {platform.platformId === game.defaultPlatformId && ' ★'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Similar Games */}
          {game.metadata?.similarGames && game.metadata.similarGames.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-text mb-2">Similar Games</h3>
              <a
                href={`/scrapers?similar=${encodeURIComponent(JSON.stringify(game.metadata.similarGames.map((sg) => sg.title)))}`}
                className="inline-flex items-center gap-2 text-primary hover:text-primary-hover font-medium"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
                View {game.metadata.similarGames.length} similar titles in scrapers
              </a>
            </div>
          )}

          {/* Play History Link */}
          {game.metadata?.playCount !== undefined && game.metadata.playCount > 0 && (
            <div className="pt-4 border-t border-border">
              <a
                href={`/games/${game.id}/sessions`}
                className="inline-flex items-center gap-2 text-primary hover:text-primary-hover font-medium"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                View full play history
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
