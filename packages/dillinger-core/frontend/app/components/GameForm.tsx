'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface GameFormData {
  id?: string;
  title: string;
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
  const [error, setError] = useState<string | null>(null);
  const [availableImages, setAvailableImages] = useState<string[]>([]);
  const [showImageSelector, setShowImageSelector] = useState<'primary' | 'backdrop' | null>(null);
  const [formData, setFormData] = useState<GameFormData>({
    title: '',
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

      const payload = {
        title: formData.title,
        filePath: formData.filePath,
        platformId: formData.platformId,
        tags,
        collectionIds: [],
        metadata: {
          ...formData.metadata,
          genre,
        },
        settings: formData.settings,
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

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-6 text-text">
          {mode === 'edit' ? 'Edit Game' : 'Add New Game'}
        </h2>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
            <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
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
