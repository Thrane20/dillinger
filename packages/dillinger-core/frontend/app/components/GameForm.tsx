'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MagnifyingGlassIcon, FolderIcon } from '@heroicons/react/24/outline';
import InstallGameDialog from './InstallGameDialog';
import ShortcutSelectorDialog, { ShortcutInfo } from './ShortcutSelectorDialog';
import FileExplorer from './FileExplorer';
import ContainerLogsDialog from './ContainerLogsDialog';

interface GameFormData {
  id?: string;
  title: string;
  slug?: string;
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
    wine?: {
      arch?: 'win32' | 'win64';
      debug?: {
        relay?: boolean;
        seh?: boolean;
        tid?: boolean;
        timestamp?: boolean;
        heap?: boolean;
        file?: boolean;
        module?: boolean;
        win?: boolean;
        d3d?: boolean;
        opengl?: boolean;
        all?: boolean;
      };
    };
    launch?: {
      command?: string;
      arguments?: string[];
      environment?: Record<string, string>;
      workingDirectory?: string;
      fullscreen?: boolean;
      resolution?: string;
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
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [showShortcutDialog, setShowShortcutDialog] = useState(false);
  const [showFileExplorer, setShowFileExplorer] = useState(false);
  const [showLogsDialog, setShowLogsDialog] = useState(false);
  const [discoveredExecutables, setDiscoveredExecutables] = useState<string[]>([]);
  const [formData, setFormData] = useState<GameFormData>({
    title: '',
    slug: '',
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
      wine: {
        arch: 'win64',
        debug: {},
      },
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
                slug: game.slug || '',
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
                  wine: {
                    arch: game.settings?.wine?.arch || 'win64',
                    debug: game.settings?.wine?.debug || {},
                  },
                  launch: {
                    command: game.settings?.launch?.command || '',
                    arguments: game.settings?.launch?.arguments || [],
                    environment: game.settings?.launch?.environment || {},
                    workingDirectory: game.settings?.launch?.workingDirectory || '',
                    fullscreen: game.settings?.launch?.fullscreen || false,
                    resolution: game.settings?.launch?.resolution || '1920x1080',
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

  // Poll for installation status when installation is in progress
  useEffect(() => {
    if (mode === 'edit' && gameId && formData._originalGame?.installation?.status === 'installing') {
      const pollInstallationStatus = async () => {
        try {
          const response = await fetch(`/api/games/${gameId}/install/status`);
          if (response.ok) {
            const result = await response.json();
            
            if (result.success) {
              if (result.status === 'installed' && result.executables) {
                setDiscoveredExecutables(result.executables);
                
                // NOTE: We don't update filePath here - it should remain the game directory path
                // The launch command is already set from the shortcut/executable selection
                
                // Reload the page to show the updated status
                setTimeout(() => window.location.reload(), 1000);
              } else if (result.status === 'failed') {
                // Reload to show failed status
                setTimeout(() => window.location.reload(), 1000);
              }
            }
          }
        } catch (err) {
          console.error('Failed to check installation status:', err);
        }
      };

      // Poll every 3 seconds
      const interval = setInterval(pollInstallationStatus, 3000);
      
      // Initial check
      pollInstallationStatus();
      
      return () => clearInterval(interval);
    }
    
    // Return undefined if condition not met
    return undefined;
  }, [mode, gameId, formData._originalGame?.installation?.status]);

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
        const savedGameId = result.data?.id || gameId;
        router.push(`/?scrollTo=${savedGameId}`);
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
    } else if (name.startsWith('settings.wine.')) {
      const wineKey = name.split('.')[2];
      setFormData((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          wine: {
            ...prev.settings?.wine,
            [wineKey]: value,
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

  const handleWineDebugChange = (channel: string, enabled: boolean) => {
    setFormData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        wine: {
          ...prev.settings?.wine,
          debug: {
            ...prev.settings?.wine?.debug,
            [channel]: enabled,
          },
        },
      },
    }));
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

  const handleSelectShortcut = (shortcut: ShortcutInfo) => {
    setFormData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        launch: {
          ...prev.settings?.launch,
          command: shortcut.target || prev.settings?.launch?.command || '',
          arguments: shortcut.arguments ? [shortcut.arguments] : prev.settings?.launch?.arguments || [],
          workingDirectory: shortcut.workingDirectory || prev.settings?.launch?.workingDirectory || '',
        }
      }
    }));
    setShowShortcutDialog(false);
  };

  const handleBrowseInstallDirectory = () => {
    setShowShortcutDialog(false);
    setShowFileExplorer(true);
  };

  const handleFileExplorerSelect = (path: string) => {
    // Set the selected file as launch command
    setFormData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        launch: {
          ...prev.settings?.launch,
          command: path,
          workingDirectory: prev.settings?.launch?.workingDirectory || 
            path.substring(0, path.lastIndexOf('/')) || '',
        }
      }
    }));
    setShowFileExplorer(false);
  };

  const handleDebugContainer = async () => {
    if (!formData._originalGame?.id) {
      console.error('No game ID available for debug container');
      return;
    }

    try {
      const response = await fetch(`http://localhost:3001/api/launch/${formData._originalGame.id}/debug`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to launch debug container');
      }

      const data = await response.json();
      
      // Show the docker exec command in an alert/dialog
      alert(
        `Debug container started!\n\n` +
        `Container ID: ${data.container.containerId.substring(0, 12)}\n\n` +
        `To attach to the container, run this command in your terminal:\n\n` +
        `${data.container.execCommand}\n\n` +
        `The container will keep running until you stop it manually.`
      );
    } catch (error) {
      console.error('Error launching debug container:', error);
      alert('Failed to launch debug container. Check console for details.');
    }
  };

  const handleRunRegistrySetup = async () => {
    if (!formData._originalGame?.id) {
      console.error('No game ID available for registry setup');
      return;
    }

    try {
      const response = await fetch(`http://localhost:3001/api/launch/${formData._originalGame.id}/registry-setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        alert(`✓ Registry Setup Complete\n\n${data.message}`);
      } else {
        alert(`Registry Setup\n\n${data.message || 'Failed to run registry setup'}`);
      }
    } catch (error) {
      console.error('Error running registry setup:', error);
      alert('Failed to run registry setup. Check console for details.');
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
              <option value="linux-native">Native (Linux)</option>
              <option value="windows-wine">Wine (Windows)</option>
              <option value="proton">Proton (Steam)</option>
              <option value="dosbox">DOSBox</option>
              <option value="scummvm">ScummVM</option>
            </select>
          </div>

          {/* Wine Architecture - only show for Wine platform */}
          {formData.platformId === 'windows-wine' && (
            <div>
              <label htmlFor="settings.wine.arch" className="block text-sm font-medium text-muted mb-2">
                Wine Architecture
              </label>
              <select
                id="settings.wine.arch"
                name="settings.wine.arch"
                value={formData.settings?.wine?.arch || 'win64'}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
              >
                <option value="win64">64-bit (win64) - Default for modern games</option>
                <option value="win32">32-bit (win32) - For older games</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Older GOG games often require 32-bit (win32) architecture
              </p>
            </div>
          )}

          {/* Wine Debug Channels - only show for Wine platform */}
          {formData.platformId === 'windows-wine' && (
            <div>
              <label className="block text-sm font-medium text-muted mb-2">
                Wine Debug Channels (for troubleshooting)
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.settings?.wine?.debug?.relay || false}
                    onChange={(e) => handleWineDebugChange('relay', e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">relay (function calls)</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.settings?.wine?.debug?.seh || false}
                    onChange={(e) => handleWineDebugChange('seh', e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">seh (exceptions)</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.settings?.wine?.debug?.tid || false}
                    onChange={(e) => handleWineDebugChange('tid', e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">tid (thread IDs)</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.settings?.wine?.debug?.timestamp || false}
                    onChange={(e) => handleWineDebugChange('timestamp', e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">timestamp</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.settings?.wine?.debug?.heap || false}
                    onChange={(e) => handleWineDebugChange('heap', e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">heap (memory)</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.settings?.wine?.debug?.file || false}
                    onChange={(e) => handleWineDebugChange('file', e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">file (I/O)</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.settings?.wine?.debug?.module || false}
                    onChange={(e) => handleWineDebugChange('module', e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">module (loading)</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.settings?.wine?.debug?.win || false}
                    onChange={(e) => handleWineDebugChange('win', e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">win (windows)</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.settings?.wine?.debug?.d3d || false}
                    onChange={(e) => handleWineDebugChange('d3d', e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">d3d (Direct3D)</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.settings?.wine?.debug?.opengl || false}
                    onChange={(e) => handleWineDebugChange('opengl', e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">opengl</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer col-span-2 md:col-span-1">
                  <input
                    type="checkbox"
                    checked={formData.settings?.wine?.debug?.all || false}
                    onChange={(e) => handleWineDebugChange('all', e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-sm font-semibold text-red-600 dark:text-red-400">all (very verbose!)</span>
                </label>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Enable debug channels to troubleshoot Wine issues. Warning: This can generate a lot of log output.
              </p>
            </div>
          )}

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

        {/* Installation Section */}
        {mode === 'edit' && !formData._originalGame?.installation?.status && (
          <div className="space-y-4 mb-6">
            <h3 className="text-lg font-semibold text-text border-b pb-2">Game Installation</h3>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-muted mb-3">
                This game hasn't been installed yet. Click the button below to run the installer.
              </p>
              <button
                type="button"
                onClick={() => setShowInstallDialog(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Install Game
              </button>
            </div>
          </div>
        )}

        {mode === 'edit' && formData._originalGame?.installation?.status === 'installed' && (
          <div className="space-y-4 mb-6">
            <h3 className="text-lg font-semibold text-text border-b pb-2">Game Installation</h3>
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-sm text-green-700 dark:text-green-300">
                ✓ Game installed at: {formData._originalGame.installation.installPath}
                {formData._originalGame.slug && formData._originalGame.platformId === 'windows-wine' && (
                  <>
                    <br />
                    <span className="ml-4 text-xs">
                      Wine prefix: {formData._originalGame.installation.installPath}/.wine-{formData._originalGame.slug}
                    </span>
                  </>
                )}
              </p>
              {formData._originalGame.installation.installedAt && (
                <p className="text-xs text-muted mt-1">
                  Installed: {new Date(formData._originalGame.installation.installedAt).toLocaleString()}
                </p>
              )}
              {discoveredExecutables.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">
                    Discovered Executables:
                  </p>
                  <ul className="text-xs text-muted space-y-1">
                    {discoveredExecutables.map((exe, index) => (
                      <li key={index} className="font-mono">
                        {index === 0 && '→ '}{exe} {index === 0 && '(auto-selected)'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={handleDebugContainer}
                  className="px-3 py-1.5 bg-yellow-600 text-white text-sm rounded-md hover:bg-yellow-700 transition-colors"
                >
                  🐛 Debug Container
                </button>
                <button
                  type="button"
                  onClick={handleRunRegistrySetup}
                  className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 transition-colors"
                >
                  🔧 Registry Setup
                </button>
              </div>
            </div>
          </div>
        )}

        {mode === 'edit' && formData._originalGame?.installation?.status === 'installing' && (
          <div className="space-y-4 mb-6">
            <h3 className="text-lg font-semibold text-text border-b pb-2">Game Installation</h3>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                ⏳ Installation in progress... Follow the installer wizard on your display.
              </p>
              <p className="text-xs text-muted mt-1">
                Container ID: {formData._originalGame.installation.containerId}
              </p>
            </div>
          </div>
        )}

        {mode === 'edit' && formData._originalGame?.installation?.status === 'failed' && (
          <div className="space-y-4 mb-6">
            <h3 className="text-lg font-semibold text-text border-b pb-2">Game Installation</h3>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-700 dark:text-red-300 mb-2">
                ✗ Installation failed
              </p>
              {formData._originalGame.installation.error && (
                <p className="text-xs text-muted">
                  Error: {formData._originalGame.installation.error}
                </p>
              )}
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setShowInstallDialog(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Retry Installation
                </button>
                <button
                  type="button"
                  onClick={() => setShowLogsDialog(true)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  View Logs
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Launch Settings */}
        <div className="space-y-4 mb-6">
          <h3 className="text-lg font-semibold text-text border-b pb-2">Launch Configuration</h3>

          <div>
            <label htmlFor="settings.launch.command" className="block text-sm font-medium text-muted mb-2">
              Launch Command
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="settings.launch.command"
                name="settings.launch.command"
                value={formData.settings?.launch?.command || ''}
                onChange={handleChange}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
                placeholder="./start.sh or game.exe"
              />
              {formData._originalGame?.installation?.status === 'installed' && formData._originalGame?.installation?.installPath && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowShortcutDialog(true)}
                    className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center gap-1"
                    title="Search for shortcut files"
                  >
                    <MagnifyingGlassIcon className="w-4 h-4" />
                    Shortcuts
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowFileExplorer(true)}
                    className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1"
                    title="Browse installation directory"
                  >
                    <FolderIcon className="w-4 h-4" />
                    Browse
                  </button>
                </>
              )}
            </div>
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

          {/* Display Options - only show for Wine platform */}
          {formData.platformId === 'windows-wine' && (
            <>
              <div className="col-span-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.settings?.launch?.fullscreen || false}
                    onChange={(e) => {
                      setFormData((prev) => ({
                        ...prev,
                        settings: {
                          ...prev.settings,
                          launch: {
                            ...prev.settings?.launch,
                            fullscreen: e.target.checked,
                          },
                        },
                      }));
                    }}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-muted">
                    Launch in fullscreen (Wine virtual desktop)
                  </span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  Creates a virtual desktop for better window management and fullscreen support
                </p>
              </div>

              {formData.settings?.launch?.fullscreen && (
                <div>
                  <label htmlFor="settings.launch.resolution" className="block text-sm font-medium text-muted mb-2">
                    Resolution
                  </label>
                  <select
                    id="settings.launch.resolution"
                    name="settings.launch.resolution"
                    value={formData.settings?.launch?.resolution || '1920x1080'}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
                  >
                    <option value="1920x1080">1920x1080 (Full HD)</option>
                    <option value="2560x1440">2560x1440 (QHD)</option>
                    <option value="3840x2160">3840x2160 (4K)</option>
                    <option value="1600x900">1600x900</option>
                    <option value="1440x900">1440x900</option>
                    <option value="1366x768">1366x768</option>
                    <option value="1280x1024">1280x1024</option>
                    <option value="1280x720">1280x720 (HD)</option>
                    <option value="1024x768">1024x768</option>
                    <option value="800x600">800x600</option>
                  </select>
                </div>
              )}
            </>
          )}
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
                router.push('/');
              }
            }}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Installation Dialog */}
      {showInstallDialog && gameId && formData.platformId && (
        <InstallGameDialog
          gameId={gameId}
          platformId={formData.platformId}
          onClose={() => setShowInstallDialog(false)}
          onSuccess={() => {
            setSuccessMessage('Installation started! Follow the wizard on your display.');
            // Reload the game data to show installation status
            window.location.reload();
          }}
        />
      )}

      {/* Shortcut Selector Dialog */}
      {showShortcutDialog && gameId && formData._originalGame?.installation?.installPath && (
        <ShortcutSelectorDialog
          gameId={gameId}
          installPath={formData._originalGame.installation.installPath}
          isOpen={showShortcutDialog}
          onClose={() => setShowShortcutDialog(false)}
          onSelectShortcut={handleSelectShortcut}
          onBrowseManually={handleBrowseInstallDirectory}
        />
      )}

      {/* File Explorer for browsing installation directory */}
      {showFileExplorer && formData._originalGame?.installation?.installPath && (
        <FileExplorer
          isOpen={showFileExplorer}
          onClose={() => setShowFileExplorer(false)}
          onSelect={handleFileExplorerSelect}
          selectMode="file"
          title="Select Game Executable"
        />
      )}

      {/* Container Logs Dialog */}
      {showLogsDialog && gameId && (
        <ContainerLogsDialog
          gameId={gameId}
          onClose={() => setShowLogsDialog(false)}
        />
      )}
    </form>
  );
}
