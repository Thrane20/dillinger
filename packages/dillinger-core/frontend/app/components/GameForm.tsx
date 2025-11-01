'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface GameFormData {
  id?: string;
  title: string;
  slug?: string;
  filePath: string;
  platformId: string;
  tags: string;
  metadata: {
    description?: string;
    genre?: string;
    developer?: string;
    publisher?: string;
    releaseDate?: string;
    rating?: number;
    igdbId?: number;
    primaryImage?: string;
    backdropImage?: string;
  };
  settings?: {
    launch?: {
      command?: string;
      arguments?: string[];
      environment?: Record<string, string>;
      workingDirectory?: string;
    };
  };
  // Store the full original game data to preserve scraper metadata
  _originalGame?: any;
}

interface GameFormProps {
  mode: 'add' | 'edit';
  gameId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface SavedGameMetadata {
  slug: string;
  localImages: {
    cover?: string;
    screenshots: string[];
    artworks: string[];
  };
}

export default function GameForm({ mode, gameId, onSuccess, onCancel }: GameFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [availableImages, setAvailableImages] = useState<string[]>([]);
  const [showImageSelector, setShowImageSelector] = useState<'primary' | 'backdrop' | null>(null);
  const [formData, setFormData] = useState<GameFormData>({
    title: '',
    slug: '',
    filePath: '',
    platformId: '',
    tags: '',
    metadata: {
      description: '',
      genre: '',
      developer: '',
      publisher: '',
      releaseDate: '',
      rating: undefined,
      igdbId: undefined,
      primaryImage: '',
      backdropImage: '',
    },
    settings: {
      launch: {
        command: '',
        arguments: [],
        environment: {},
        workingDirectory: '',
      },
    },
  });

  // Load game data if in edit mode
  useEffect(() => {
    if (mode === 'edit' && gameId) {
      const loadGameData = async () => {
        try {
          const response = await fetch(`/api/games/${gameId}`);
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
              const game = result.data;
              
              // Store original game data to preserve scraper metadata
              setFormData({
                id: game.id,
                title: game.title || '',
                filePath: game.filePath || '',
                platformId: game.platformId || '',
                tags: Array.isArray(game.tags) ? game.tags.join(', ') : '',
                metadata: {
                  description: game.metadata?.description || '',
                  genre: Array.isArray(game.metadata?.genre) 
                    ? game.metadata.genre.join(', ') 
                    : game.metadata?.genre || '',
                  developer: game.metadata?.developer || '',
                  publisher: game.metadata?.publisher || '',
                  releaseDate: game.metadata?.releaseDate ? game.metadata.releaseDate.split('T')[0] : '',
                  rating: game.metadata?.rating || undefined,
                  igdbId: game.metadata?.igdbId || undefined,
                  primaryImage: game.metadata?.primaryImage || '',
                  backdropImage: game.metadata?.backdropImage || '',
                },
                settings: {
                  launch: {
                    command: game.settings?.launch?.command || '',
                    arguments: game.settings?.launch?.arguments || [],
                    environment: game.settings?.launch?.environment || {},
                    workingDirectory: game.settings?.launch?.workingDirectory || '',
                  },
                },
                _originalGame: game, // Store full original data
              });
            }
          }
        } catch (err) {
          console.error('Failed to load game:', err);
          setError('Failed to load game data');
        }
      };
      
      loadGameData();
    }
  }, [mode, gameId]);

  // Load available images from scraped metadata
  useEffect(() => {
    if (gameId && mode === 'edit') {
      loadAvailableImages(gameId);
    }
  }, [gameId, mode]);

  const loadAvailableImages = async (slug: string) => {
    try {
      // Try to load scraped metadata to get available images
      const response = await fetch(`/api/scrapers/saved/${slug}`);
      if (response.ok) {
        const metadata: SavedGameMetadata = await response.json();
        const images: string[] = [];
        
        if (metadata.localImages.cover) {
          images.push(`/api/images/${metadata.slug}/${metadata.localImages.cover}`);
        }
        
        metadata.localImages.screenshots.forEach((img) => {
          images.push(`/api/images/${metadata.slug}/${img}`);
        });
        
        metadata.localImages.artworks.forEach((img) => {
          images.push(`/api/images/${metadata.slug}/${img}`);
        });
        
        setAvailableImages(images);
      }
    } catch (err) {
      console.error('Failed to load available images:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Convert tags and genre strings to arrays
      const tags = formData.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      const genre = formData.metadata.genre
        ? formData.metadata.genre
            .split(',')
            .map((g) => g.trim())
            .filter((g) => g.length > 0)
        : [];

      // Preserve scraper metadata when updating
      const preservedMetadata = formData._originalGame?.metadata || {};
      
      const payload = {
        title: formData.title,
        filePath: formData.filePath,
        platformId: formData.platformId,
        tags,
        collectionIds: formData._originalGame?.collectionIds || [],
        metadata: {
          // Start with user-editable fields
          description: formData.metadata.description,
          genre,
          developer: formData.metadata.developer,
          publisher: formData.metadata.publisher,
          releaseDate: formData.metadata.releaseDate,
          rating: formData.metadata.rating,
          igdbId: formData.metadata.igdbId,
          primaryImage: formData.metadata.primaryImage,
          backdropImage: formData.metadata.backdropImage,
          // Preserve scraper-only metadata
          similarGames: preservedMetadata.similarGames,
          coverArt: preservedMetadata.coverArt,
          screenshots: preservedMetadata.screenshots,
          playTime: preservedMetadata.playTime,
          lastPlayed: preservedMetadata.lastPlayed,
        },
        settings: formData.settings,
        fileInfo: formData._originalGame?.fileInfo,
        created: formData._originalGame?.created,
      };

      const url = mode === 'edit' ? `/api/games/${gameId}` : '/api/games';
      const method = mode === 'edit' ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || `Failed to ${mode} game`);
      }

      // Success!
      setSuccessMessage('Game saved successfully!');
      
      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/games');
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${mode} game`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name.startsWith('metadata.')) {
      const metadataKey = name.split('.')[1] as keyof GameFormData['metadata'];
      setFormData((prev) => ({
        ...prev,
        metadata: {
          ...prev.metadata,
          [metadataKey]: value,
        },
      }));
    } else if (name.startsWith('settings.launch.')) {
      const launchKey = name.split('.')[2];
      setFormData((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          launch: {
            ...prev.settings?.launch,
            [launchKey]: value,
          },
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const selectImage = (imageUrl: string) => {
    if (showImageSelector === 'primary') {
      setFormData((prev) => ({
        ...prev,
        metadata: {
          ...prev.metadata,
          primaryImage: imageUrl,
        },
      }));
    } else if (showImageSelector === 'backdrop') {
      setFormData((prev) => ({
        ...prev,
        metadata: {
          ...prev.metadata,
          backdropImage: imageUrl,
        },
      }));
    }
    setShowImageSelector(null);
  };

  const handleRefreshFromScraper = async () => {
    if (!gameId || !formData._originalGame?.metadata?.igdbId) {
      setError('Cannot refresh: No scraper ID found for this game');
      return;
    }

    setIsRefreshing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Get latest data from scraper
      const scraperType = 'igdb'; // Default to IGDB
      const scraperId = formData._originalGame.metadata.igdbId.toString();
      
      const response = await fetch(`/api/scrapers/game/${scraperType}/${scraperId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch latest scraper data');
      }

      const result = await response.json();
      const latestData = result.game;

      // Merge with current form data, preserving user edits but updating scraper fields
      setFormData((prev) => ({
        ...prev,
        metadata: {
          // Preserve user-edited fields (keep current values)
          description: prev.metadata.description,
          genre: prev.metadata.genre,
          developer: prev.metadata.developer,
          publisher: prev.metadata.publisher,
          releaseDate: prev.metadata.releaseDate,
          rating: prev.metadata.rating,
          igdbId: prev.metadata.igdbId,
          primaryImage: prev.metadata.primaryImage,
          backdropImage: prev.metadata.backdropImage,
        },
        _originalGame: {
          ...prev._originalGame,
          metadata: {
            ...prev._originalGame?.metadata,
            // Update scraper-only fields from latest data
            similarGames: latestData.similarGames?.map((sg: any) => ({
              title: typeof sg === 'string' ? sg : sg.title || sg,
              slug: typeof sg === 'string' ? sg.toLowerCase().replace(/[^a-z0-9]+/g, '-') : sg.slug,
              scraperId: typeof sg === 'object' && sg.scraperId ? sg.scraperId : undefined,
              scraperType: scraperType,
            })),
          },
        },
      }));

      setSuccessMessage('Successfully refreshed metadata from scraper!');
      
      // Reload available images
      if (gameId) {
        await loadAvailableImages(gameId);
      }
    } catch (err) {
      console.error('Failed to refresh from scraper:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh from scraper');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-text">
            {mode === 'edit' ? 'Edit Game' : 'Add New Game'}
          </h2>
          
          {/* Refresh from Scraper Button */}
          {mode === 'edit' && formData._originalGame?.metadata?.igdbId && (
            <button
              type="button"
              onClick={handleRefreshFromScraper}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {isRefreshing ? 'Refreshing...' : 'Refresh from Scraper'}
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-md">
            <p className="text-green-800 dark:text-green-200 text-sm">{successMessage}</p>
          </div>
        )}

        {/* Info about preserved scraper data */}
        {mode === 'edit' && formData._originalGame?.metadata?.similarGames && (
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md">
            <div className="flex items-start gap-2">
              <svg className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-blue-800 dark:text-blue-200 text-sm font-medium">Scraper Data Preserved</p>
                <p className="text-blue-700 dark:text-blue-300 text-xs mt-1">
                  This game has {formData._originalGame.metadata.similarGames.length} similar titles and other scraper metadata that will be automatically preserved when saving your changes.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Basic Information */}
        <div className="space-y-4 mb-6">
          <h3 className="text-lg font-semibold text-text border-b pb-2">Basic Information</h3>
          
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-muted mb-2">
              Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              required
              value={formData.title}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
              placeholder="Enter game title"
            />
          </div>

          {/* Slug */}
          <div>
            <label htmlFor="slug" className="block text-sm font-medium text-muted mb-2">
              Slug <span className="text-xs text-gray-500">(URL-friendly identifier, auto-generated if empty)</span>
            </label>
            <input
              type="text"
              id="slug"
              name="slug"
              value={formData.slug}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
              placeholder="e.g., my-game-title"
            />
          </div>

          {/* File Path */}
          <div>
            <label htmlFor="filePath" className="block text-sm font-medium text-muted mb-2">
              File Path
            </label>
            <input
              type="text"
              id="filePath"
              name="filePath"
              value={formData.filePath}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
              placeholder="/path/to/game/executable"
            />
          </div>

          {/* Platform */}
          <div>
            <label htmlFor="platformId" className="block text-sm font-medium text-muted mb-2">
              Platform
            </label>
            <select
              id="platformId"
              name="platformId"
              value={formData.platformId}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
            >
              <option value="">Select a platform...</option>
              <option value="native">Native (Linux)</option>
              <option value="wine">Wine (Windows)</option>
              <option value="proton">Proton (Steam)</option>
              <option value="dosbox">DOSBox</option>
              <option value="scummvm">ScummVM</option>
            </select>
          </div>

          {/* Tags */}
          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-muted mb-2">
              Tags
            </label>
            <input
              type="text"
              id="tags"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
              placeholder="action, rpg, multiplayer (comma-separated)"
            />
          </div>
        </div>

        {/* Metadata Section */}
        <div className="space-y-4 mb-6">
          <h3 className="text-lg font-semibold text-text border-b pb-2">Game Information</h3>

          {/* Description */}
          <div>
            <label htmlFor="metadata.description" className="block text-sm font-medium text-muted mb-2">
              Description
            </label>
            <textarea
              id="metadata.description"
              name="metadata.description"
              value={formData.metadata.description}
              onChange={handleChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
              placeholder="Brief description of the game"
            />
          </div>

          {/* Genre */}
          <div>
            <label htmlFor="metadata.genre" className="block text-sm font-medium text-muted mb-2">
              Genre
            </label>
            <input
              type="text"
              id="metadata.genre"
              name="metadata.genre"
              value={formData.metadata.genre}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
              placeholder="Action, RPG, Strategy (comma-separated)"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Developer */}
            <div>
              <label htmlFor="metadata.developer" className="block text-sm font-medium text-muted mb-2">
                Developer
              </label>
              <input
                type="text"
                id="metadata.developer"
                name="metadata.developer"
                value={formData.metadata.developer}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
                placeholder="Game developer"
              />
            </div>

            {/* Publisher */}
            <div>
              <label htmlFor="metadata.publisher" className="block text-sm font-medium text-muted mb-2">
                Publisher
              </label>
              <input
                type="text"
                id="metadata.publisher"
                name="metadata.publisher"
                value={formData.metadata.publisher}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
                placeholder="Game publisher"
              />
            </div>

            {/* Release Date */}
            <div>
              <label htmlFor="metadata.releaseDate" className="block text-sm font-medium text-muted mb-2">
                Release Date
              </label>
              <input
                type="date"
                id="metadata.releaseDate"
                name="metadata.releaseDate"
                value={formData.metadata.releaseDate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
              />
            </div>

            {/* Rating */}
            <div>
              <label htmlFor="metadata.rating" className="block text-sm font-medium text-muted mb-2">
                Rating (1-10)
              </label>
              <input
                type="number"
                id="metadata.rating"
                name="metadata.rating"
                min="1"
                max="10"
                value={formData.metadata.rating || ''}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
                placeholder="1-10"
              />
            </div>
          </div>
        </div>

        {/* Image Selection */}
        {availableImages.length > 0 && (
          <div className="space-y-4 mb-6">
            <h3 className="text-lg font-semibold text-text border-b pb-2">Display Images</h3>
            
            {/* Primary Image */}
            <div>
              <label className="block text-sm font-medium text-muted mb-2">
                Primary Image (Tile Display)
              </label>
              <div className="flex items-center gap-4">
                {formData.metadata.primaryImage && (
                  <img
                    src={formData.metadata.primaryImage}
                    alt="Primary"
                    className="w-24 h-24 object-cover rounded border-2 border-blue-500"
                  />
                )}
                <button
                  type="button"
                  onClick={() => setShowImageSelector('primary')}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  {formData.metadata.primaryImage ? 'Change' : 'Select'} Primary Image
                </button>
                {formData.metadata.primaryImage && (
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      metadata: { ...prev.metadata, primaryImage: '' }
                    }))}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Backdrop Image */}
            <div>
              <label className="block text-sm font-medium text-muted mb-2">
                Backdrop Image (Hover Effect)
              </label>
              <div className="flex items-center gap-4">
                {formData.metadata.backdropImage && (
                  <img
                    src={formData.metadata.backdropImage}
                    alt="Backdrop"
                    className="w-32 h-18 object-cover rounded border-2 border-purple-500"
                  />
                )}
                <button
                  type="button"
                  onClick={() => setShowImageSelector('backdrop')}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                >
                  {formData.metadata.backdropImage ? 'Change' : 'Select'} Backdrop Image
                </button>
                {formData.metadata.backdropImage && (
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      metadata: { ...prev.metadata, backdropImage: '' }
                    }))}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Image Selector Modal */}
            {showImageSelector && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
                  <h3 className="text-xl font-semibold mb-4 text-text">
                    Select {showImageSelector === 'primary' ? 'Primary' : 'Backdrop'} Image
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
                    {availableImages.map((img, index) => (
                      <div
                        key={index}
                        onClick={() => selectImage(img)}
                        className="cursor-pointer border-2 border-transparent hover:border-blue-500 rounded overflow-hidden transition-all"
                      >
                        <img
                          src={img}
                          alt={`Option ${index + 1}`}
                          className="w-full h-32 object-cover"
                        />
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowImageSelector(null)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Launch Settings */}
        <div className="space-y-4 mb-6">
          <h3 className="text-lg font-semibold text-text border-b pb-2">Launch Configuration</h3>

          <div>
            <label htmlFor="settings.launch.command" className="block text-sm font-medium text-muted mb-2">
              Launch Command
            </label>
            <input
              type="text"
              id="settings.launch.command"
              name="settings.launch.command"
              value={formData.settings?.launch?.command || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
              placeholder="./start.sh or game.exe"
            />
          </div>

          <div>
            <label htmlFor="settings.launch.workingDirectory" className="block text-sm font-medium text-muted mb-2">
              Working Directory
            </label>
            <input
              type="text"
              id="settings.launch.workingDirectory"
              name="settings.launch.workingDirectory"
              value={formData.settings?.launch?.workingDirectory || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
              placeholder="Relative path from game directory"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-4 mt-6">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? (mode === 'edit' ? 'Saving...' : 'Adding...') : (mode === 'edit' ? 'Save Changes' : 'Add Game')}
          </button>
          <button
            type="button"
            onClick={() => {
              if (onCancel) {
                onCancel();
              } else {
                router.push('/games');
              }
            }}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
