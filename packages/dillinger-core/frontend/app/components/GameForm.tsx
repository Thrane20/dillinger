'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MagnifyingGlassIcon, FolderIcon, InformationCircleIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { GamePlatformConfig } from '@dillinger/shared';
import InstallGameDialog from './InstallGameDialog';
import ShortcutSelectorDialog, { ShortcutInfo } from './ShortcutSelectorDialog';
import FileExplorer from './FileExplorer';
import ContainerLogsDialog from './ContainerLogsDialog';

interface GameFormData {
  id?: string;
  title: string;
  slug?: string;
  platformId: string; // Currently selected platform ID
  platforms: GamePlatformConfig[]; // All configured platforms
  filePath?: string; // Current platform's file path (ROM/executable)
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
      useDxvk?: boolean;
      compatibilityMode?: 'none' | 'legacy' | 'win98' | 'winxp' | 'win7' | 'win10';
      dlls?: Record<string, string>;
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
      useXrandr?: boolean;
      xrandrMode?: string;
      useGamescope?: boolean;
      gamescopeWidth?: number;
      gamescopeHeight?: number;
      gamescopeOutputWidth?: number;
      gamescopeOutputHeight?: number;
    };
    gamescope?: {
      enabled?: boolean;
      width?: number;
      height?: number;
      refreshRate?: number;
      fullscreen?: boolean;
      upscaler?: 'auto' | 'fsr' | 'nis' | 'linear' | 'nearest';
      inputWidth?: number;
      inputHeight?: number;
      borderless?: boolean;
      limitFps?: number;
    };
    mangohud?: {
      enabled?: boolean;
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

interface Screenshot {
  filename: string;
  path: string;
  size: number;
  modified: string;
  modifiedTimestamp: number;
}

export default function GameForm({ mode, gameId, onSuccess, onCancel }: GameFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [availableImages, setAvailableImages] = useState<string[]>([]);
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [showImageSelector, setShowImageSelector] = useState<'primary' | 'backdrop' | null>(null);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [showShortcutDialog, setShowShortcutDialog] = useState(false);
  const [showFileExplorer, setShowFileExplorer] = useState(false);
  const [showRomFileExplorer, setShowRomFileExplorer] = useState(false);
  const [showLogsDialog, setShowLogsDialog] = useState(false);
  const [showAddPlatform, setShowAddPlatform] = useState(false);
  const [formData, setFormData] = useState<GameFormData>({
    title: '',
    slug: '',
    platformId: '',
    platforms: [],
    filePath: '',
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
              
              // Determine active platform and settings
              const activePlatformId = game.defaultPlatformId || game.platformId || '';
              let platforms = game.platforms || [];
              
              // Backwards compatibility: if no platforms array but we have legacy fields, create one
              if (platforms.length === 0 && game.platformId) {
                platforms = [{
                  platformId: game.platformId,
                  settings: game.settings,
                  filePath: game.filePath,
                  installation: game.installation
                }];
              }
              
              const activePlatform = platforms.find((p: any) => p.platformId === activePlatformId) || platforms[0];
              const activeSettings = activePlatform?.settings || game.settings;
              const activeFilePath = activePlatform?.filePath || game.filePath || '';

              // Store original game data to preserve scraper metadata
              setFormData({
                id: game.id,
                title: game.title || '',
                slug: game.slug || '',
                platformId: activePlatformId,
                platforms,
                filePath: activeFilePath,
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
                    arch: activeSettings?.wine?.arch || 'win64',
                    useDxvk: activeSettings?.wine?.useDxvk || false,
                    compatibilityMode: activeSettings?.wine?.compatibilityMode || 'none',
                    dlls: activeSettings?.wine?.dlls || {},
                    debug: activeSettings?.wine?.debug || {},
                  },
                  launch: {
                    command: activeSettings?.launch?.command || '',
                    arguments: activeSettings?.launch?.arguments || [],
                    environment: activeSettings?.launch?.environment || {},
                    workingDirectory: activeSettings?.launch?.workingDirectory || '',
                    fullscreen: activeSettings?.launch?.fullscreen || false,
                    resolution: activeSettings?.launch?.resolution || '1920x1080',
                    useXrandr: activeSettings?.launch?.useXrandr || false,
                    xrandrMode: activeSettings?.launch?.xrandrMode || '',
                  },
                  gamescope: {
                    enabled: activeSettings?.gamescope?.enabled || false,
                    width: activeSettings?.gamescope?.width || 1920,
                    height: activeSettings?.gamescope?.height || 1080,
                    refreshRate: activeSettings?.gamescope?.refreshRate || 60,
                    fullscreen: activeSettings?.gamescope?.fullscreen || false,
                    upscaler: activeSettings?.gamescope?.upscaler || 'auto',
                    inputWidth: activeSettings?.gamescope?.inputWidth || undefined,
                    inputHeight: activeSettings?.gamescope?.inputHeight || undefined,
                    limitFps: activeSettings?.gamescope?.limitFps || undefined,
                  },
                  mangohud: {
                    enabled: activeSettings?.mangohud?.enabled || false,
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
      loadScreenshots(gameId);
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

  const loadScreenshots = async (id: string) => {
    try {
      const response = await fetch(`/api/games/${id}/screenshots`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data.screenshots) {
          setScreenshots(result.data.screenshots);
        }
      }
    } catch (err) {
      console.error('Failed to load screenshots:', err);
    }
  };

  const formatRelativeTime = (isoDate: string): string => {
    const now = new Date();
    const date = new Date(isoDate);
    const diffMs = now.getTime() - date.getTime();
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);
    
    if (diffYears > 0) {
      const remainingMonths = Math.floor((diffDays % 365) / 30);
      const remainingDays = diffDays % 30;
      const parts = [`${diffYears} year${diffYears > 1 ? 's' : ''}`];
      if (remainingMonths > 0) parts.push(`${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`);
      if (remainingDays > 0 && remainingMonths === 0) parts.push(`${remainingDays} day${remainingDays > 1 ? 's' : ''}`);
      return parts.join(', ') + ' ago';
    } else if (diffMonths > 0) {
      const remainingDays = diffDays % 30;
      const parts = [`${diffMonths} month${diffMonths > 1 ? 's' : ''}`];
      if (remainingDays > 0) parts.push(`${remainingDays} day${remainingDays > 1 ? 's' : ''}`);
      return parts.join(', ') + ' ago';
    } else if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
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
      
      // Update the current platform in the platforms array before submitting
      const platforms = [...formData.platforms];
      const currentPlatformIndex = platforms.findIndex(p => p.platformId === formData.platformId);
      
      if (currentPlatformIndex >= 0) {
        platforms[currentPlatformIndex] = {
          ...platforms[currentPlatformIndex],
          settings: formData.settings,
          filePath: formData.filePath,
        };
      } else if (formData.platformId) {
        platforms.push({
          platformId: formData.platformId,
          settings: formData.settings,
          filePath: formData.filePath,
        });
      }

      const payload = {
        title: formData.title,
        platforms,
        defaultPlatformId: formData.platformId,
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
    } else if (name.startsWith('settings.gamescope.')) {
      const gamescopeKey = name.split('.')[2];
      setFormData((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          gamescope: {
            ...prev.settings?.gamescope,
            [gamescopeKey]: value,
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

  const handleRomFileSelect = (path: string) => {
    // Update local state
    setFormData(prev => ({
      ...prev,
      filePath: path,
    }));
    
    setShowRomFileExplorer(false);
  };





  const switchPlatform = (newPlatformId: string) => {
    if (newPlatformId === formData.platformId) return;

    setFormData(prev => {
      // 1. Save current settings to the current platform in the platforms array
      const updatedPlatforms = [...prev.platforms];
      const currentPlatformIndex = updatedPlatforms.findIndex(p => p.platformId === prev.platformId);
      
      if (currentPlatformIndex >= 0) {
        updatedPlatforms[currentPlatformIndex] = {
          ...updatedPlatforms[currentPlatformIndex],
          settings: prev.settings,
          filePath: prev.filePath,
        };
      } else if (prev.platformId) {
        // If current platform wasn't in the array (e.g. newly added), add it
        updatedPlatforms.push({
          platformId: prev.platformId,
          settings: prev.settings,
          filePath: prev.filePath,
        });
      }

      // 2. Find new platform config
      const newPlatformConfig = updatedPlatforms.find(p => p.platformId === newPlatformId);
      
      // 3. Return new state
      return {
        ...prev,
        platforms: updatedPlatforms,
        platformId: newPlatformId,
        settings: newPlatformConfig?.settings || {
          wine: { arch: 'win64', debug: {} },
          launch: { command: '', arguments: [], environment: {}, workingDirectory: '' },
        },
        filePath: newPlatformConfig?.filePath || '',
      };
    });
  };

  const handleAddPlatform = (platformId: string) => {
    if (!platformId) return;
    
    // Check if already exists
    if (formData.platforms.some(p => p.platformId === platformId)) {
      switchPlatform(platformId);
      setShowAddPlatform(false);
      return;
    }

    setFormData(prev => {
      // Save current platform state first
      const updatedPlatforms = [...prev.platforms];
      const currentPlatformIndex = updatedPlatforms.findIndex(p => p.platformId === prev.platformId);
      
      if (currentPlatformIndex >= 0) {
        updatedPlatforms[currentPlatformIndex] = {
          ...updatedPlatforms[currentPlatformIndex],
          settings: prev.settings,
          filePath: prev.filePath,
        };
      } else if (prev.platformId) {
        updatedPlatforms.push({
          platformId: prev.platformId,
          settings: prev.settings,
          filePath: prev.filePath,
        });
      }

      // Add new platform
      const newPlatform: GamePlatformConfig = {
        platformId,
        settings: {
          wine: { arch: 'win64', debug: {} },
          launch: { command: '', arguments: [], environment: {}, workingDirectory: '' },
        },
        filePath: '',
      };
      
      updatedPlatforms.push(newPlatform);

      return {
        ...prev,
        platforms: updatedPlatforms,
        platformId,
        settings: newPlatform.settings,
        filePath: newPlatform.filePath || '',
      };
    });
    
    setShowAddPlatform(false);
  };

  const handleRemovePlatform = (platformId: string) => {
    if (!confirm('Are you sure you want to remove this platform configuration?')) return;

    setFormData(prev => {
      const updatedPlatforms = prev.platforms.filter(p => p.platformId !== platformId);
      
      // If we removed the current platform, switch to another one
      let newPlatformId = prev.platformId;
      let newSettings = prev.settings;
      let newFilePath = prev.filePath;
      
      if (prev.platformId === platformId) {
        if (updatedPlatforms.length > 0) {
          newPlatformId = updatedPlatforms[0].platformId;
          newSettings = updatedPlatforms[0].settings;
          newFilePath = updatedPlatforms[0].filePath;
        } else {
          newPlatformId = '';
          newSettings = {
            wine: { arch: 'win64', debug: {} },
            launch: { command: '', arguments: [], environment: {}, workingDirectory: '' },
          };
          newFilePath = '';
        }
      }
      
      return {
        ...prev,
        platforms: updatedPlatforms,
        platformId: newPlatformId,
        settings: newSettings,
        filePath: newFilePath,
      };
    });
  };

  const getPlatformName = (id: string) => {
    const names: Record<string, string> = {
      'linux-native': 'Native (Linux)',
      'windows-wine': 'Wine (Windows)',
      'proton': 'Proton',
      'dosbox': 'DOSBox',
      'scummvm': 'ScummVM',
      'c64': 'Commodore 64',
      'c128': 'Commodore 128',
      'vic20': 'VIC-20',
      'plus4': 'Plus/4',
      'pet': 'PET',
      'amiga': 'Amiga',
      'amiga500': 'Amiga 500',
      'amiga500plus': 'Amiga 500+',
      'amiga600': 'Amiga 600',
      'amiga1200': 'Amiga 1200',
      'amiga3000': 'Amiga 3000',
      'amiga4000': 'Amiga 4000',
      'cd32': 'Amiga CD32',
      'mame': 'Arcade (MAME)',
    };
    return names[id] || id;
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

          {/* Platforms */}
          <div>
            <label className="block text-sm font-medium text-muted mb-2">
              Platforms
            </label>
            
            <div className="space-y-3">
              {/* List of configured platforms */}
              <div className="flex flex-wrap gap-2">
                {formData.platforms.map(p => (
                  <div key={p.platformId} className="relative group">
                    <button
                      type="button"
                      onClick={() => switchPlatform(p.platformId)}
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        formData.platformId === p.platformId
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {getPlatformName(p.platformId)}
                    </button>
                    {formData.platforms.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemovePlatform(p.platformId);
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                        title="Remove platform"
                      >
                        <TrashIcon className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
                
                {/* Add Platform Button */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowAddPlatform(!showAddPlatform)}
                    className="px-3 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-500 hover:text-blue-600 hover:border-blue-500 transition-colors flex items-center gap-1"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Add Platform
                  </button>
                  
                  {/* Add Platform Dropdown */}
                  {showAddPlatform && (
                    <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-20 max-h-60 overflow-y-auto">
                      <div className="p-2 space-y-1">
                        <button
                          type="button"
                          onClick={() => handleAddPlatform('linux-native')}
                          className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          Native (Linux)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddPlatform('windows-wine')}
                          className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          Wine (Windows)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddPlatform('mame')}
                          className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          Arcade (MAME)
                        </button>
                        <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                        <p className="px-3 py-1 text-xs font-semibold text-gray-500">Commodore</p>
                        {['c64', 'c128', 'vic20', 'plus4', 'pet'].map(id => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => handleAddPlatform(id)}
                            className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            {getPlatformName(id)}
                          </button>
                        ))}
                        <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                        <p className="px-3 py-1 text-xs font-semibold text-gray-500">Amiga</p>
                        {['amiga', 'amiga500', 'amiga500plus', 'amiga600', 'amiga1200', 'amiga3000', 'amiga4000', 'cd32'].map(id => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => handleAddPlatform(id)}
                            className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            {getPlatformName(id)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {formData.platforms.length === 0 && (
                <p className="text-sm text-red-500">
                  Please add at least one platform configuration.
                </p>
              )}
            </div>
          </div>

          {/* Rom File Selection - Show for emulator platforms */}
          {['c64', 'c128', 'vic20', 'plus4', 'pet', 'amiga', 'amiga500', 'amiga500plus', 'amiga600', 'amiga1200', 'amiga3000', 'amiga4000', 'cd32', 'mame'].includes(formData.platformId) && (
            <div className="space-y-4 mb-6 border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-semibold text-text border-b pb-2">
                Rom File ({getPlatformName(formData.platformId)})
              </h3>
              
              <div>
                <label htmlFor="filePath" className="block text-sm font-medium text-muted mb-2">
                  ROM File Path
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="filePath"
                    name="filePath"
                    value={formData.filePath || ''}
                    onChange={handleChange}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
                    placeholder="/path/to/game.d64"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRomFileExplorer(true)}
                    className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1"
                    title="Browse for ROM file"
                  >
                    <FolderIcon className="w-4 h-4" />
                    Browse
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Select the ROM or disk image file for this game
                </p>
              </div>
            </div>
          )}

          {/* Launch Settings - Hide for emulator platforms that use ROMs */}
          {!['c64', 'c128', 'vic20', 'plus4', 'pet', 'amiga', 'amiga500', 'amiga500plus', 'amiga600', 'amiga1200', 'amiga3000', 'amiga4000', 'cd32', 'mame'].includes(formData.platformId) && (
            <div className="space-y-4 mb-6 border-t border-gray-200 dark:border-gray-700 pt-6">
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

                  {formData.settings?.launch?.fullscreen && (
                    <div className="col-span-2">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.settings?.launch?.useXrandr || false}
                          onChange={(e) => {
                            setFormData((prev) => ({
                              ...prev,
                              settings: {
                                ...prev.settings,
                                launch: {
                                  ...prev.settings?.launch,
                                  useXrandr: e.target.checked,
                                },
                              },
                            }));
                          }}
                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-muted">
                          Set display resolution before launch (xrandr)
                        </span>
                      </label>
                      <p className="text-xs text-gray-500 mt-1 ml-6">
                        Automatically changes your display resolution to match the game. Useful for older games that don't handle resolution scaling well.
                      </p>
                    </div>
                  )}

                  {formData.settings?.launch?.fullscreen && formData.settings?.launch?.useXrandr && (
                    <div>
                      <label htmlFor="settings.launch.xrandrMode" className="block text-sm font-medium text-muted mb-2">
                        xrandr Resolution
                      </label>
                      <input
                        type="text"
                        id="settings.launch.xrandrMode"
                        name="settings.launch.xrandrMode"
                        value={formData.settings?.launch?.xrandrMode || formData.settings?.launch?.resolution || '1920x1080'}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
                        placeholder="e.g., 1920x1080"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Display resolution to set via xrandr (defaults to game resolution above)
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Gamescope Compositor */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    id="settings.gamescope.enabled"
                    checked={formData.settings?.gamescope?.enabled || false}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        settings: {
                          ...formData.settings,
                          gamescope: {
                            ...formData.settings?.gamescope,
                            enabled: e.target.checked,
                          },
                        },
                      });
                    }}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <label htmlFor="settings.gamescope.enabled" className="text-sm font-medium text-text">
                    Use Gamescope compositor (advanced)
                  </label>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  Gamescope is a micro-compositor that provides better control over game rendering, upscaling, and frame limiting
                </p>

                {formData.settings?.gamescope?.enabled && (
                  <div className="space-y-4 pl-6 border-l-2 border-blue-500">
                    {/* Output Resolution (Display) */}
                    <div>
                      <label htmlFor="settings.gamescope.width" className="block text-sm font-medium text-muted mb-2">
                        Output Resolution
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <select
                          id="settings.gamescope.width"
                          name="settings.gamescope.width"
                          value={formData.settings?.gamescope?.width || 1920}
                          onChange={(e) => {
                            const value = parseInt(e.target.value);
                            const heightMap: Record<number, number> = {
                              640: 480,
                              800: 600,
                              1024: 768,
                              1280: 720,
                              1366: 768,
                              1600: 900,
                              1920: 1080,
                              2560: 1440,
                              3840: 2160,
                            };
                            setFormData({
                              ...formData,
                              settings: {
                                ...formData.settings,
                                gamescope: {
                                  ...formData.settings?.gamescope,
                                  width: value,
                                  height: heightMap[value] || formData.settings?.gamescope?.height || 1080,
                                },
                              },
                            });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
                        >
                          <option value="640">640x480 (VGA)</option>
                          <option value="800">800x600 (SVGA)</option>
                          <option value="1024">1024x768 (XGA)</option>
                          <option value="1280">1280x720 (HD)</option>
                          <option value="1366">1366x768 (WXGA)</option>
                          <option value="1600">1600x900 (HD+)</option>
                          <option value="1920">1920x1080 (Full HD)</option>
                          <option value="2560">2560x1440 (QHD)</option>
                          <option value="3840">3840x2160 (4K UHD)</option>
                        </select>
                        <input
                          type="number"
                          id="settings.gamescope.height"
                          name="settings.gamescope.height"
                          value={formData.settings?.gamescope?.height || 1080}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
                          placeholder="Height"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Display resolution (what you see on screen)
                      </p>
                    </div>

                    {/* Game Resolution (Internal) */}
                    <div>
                      <label htmlFor="settings.gamescope.inputWidth" className="block text-sm font-medium text-muted mb-2">
                        Game Internal Resolution (optional)
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <select
                          id="settings.gamescope.inputWidth"
                          name="settings.gamescope.inputWidth"
                          value={formData.settings?.gamescope?.inputWidth || ''}
                          onChange={(e) => {
                            const value = e.target.value ? parseInt(e.target.value) : undefined;
                            const heightMap: Record<number, number> = {
                              640: 480,
                              800: 600,
                              1024: 768,
                              1280: 720,
                              1366: 768,
                              1600: 900,
                              1920: 1080,
                              2560: 1440,
                              3840: 2160,
                            };
                            setFormData({
                              ...formData,
                              settings: {
                                ...formData.settings,
                                gamescope: {
                                  ...formData.settings?.gamescope,
                                  inputWidth: value,
                                  inputHeight: value ? heightMap[value] : undefined,
                                },
                              },
                            });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
                        >
                          <option value="">Same as output</option>
                          <option value="640">640x480 (VGA)</option>
                          <option value="800">800x600 (SVGA)</option>
                          <option value="1024">1024x768 (XGA)</option>
                          <option value="1280">1280x720 (HD)</option>
                          <option value="1366">1366x768 (WXGA)</option>
                          <option value="1600">1600x900 (HD+)</option>
                          <option value="1920">1920x1080 (Full HD)</option>
                          <option value="2560">2560x1440 (QHD)</option>
                          <option value="3840">3840x2160 (4K UHD)</option>
                        </select>
                        <input
                          type="number"
                          id="settings.gamescope.inputHeight"
                          name="settings.gamescope.inputHeight"
                          value={formData.settings?.gamescope?.inputHeight || ''}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
                          placeholder="Height (auto)"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Internal resolution the game renders at (for upscaling). Leave empty to match output resolution.
                      </p>
                    </div>

                    {/* Refresh Rate */}
                    <div>
                      <label htmlFor="settings.gamescope.refreshRate" className="block text-sm font-medium text-muted mb-2">
                        Refresh Rate
                      </label>
                      <select
                        id="settings.gamescope.refreshRate"
                        name="settings.gamescope.refreshRate"
                        value={formData.settings?.gamescope?.refreshRate || 60}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
                      >
                        <option value="30">30 Hz</option>
                        <option value="60">60 Hz</option>
                        <option value="75">75 Hz</option>
                        <option value="90">90 Hz</option>
                        <option value="120">120 Hz</option>
                        <option value="144">144 Hz</option>
                        <option value="165">165 Hz</option>
                        <option value="240">240 Hz</option>
                      </select>
                    </div>

                    {/* Upscaler */}
                    <div>
                      <label htmlFor="settings.gamescope.upscaler" className="block text-sm font-medium text-muted mb-2">
                        Upscaler
                      </label>
                      <select
                        id="settings.gamescope.upscaler"
                        name="settings.gamescope.upscaler"
                        value={formData.settings?.gamescope?.upscaler || 'auto'}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
                      >
                        <option value="auto">Auto</option>
                        <option value="fsr">FSR (AMD FidelityFX)</option>
                        <option value="nis">NIS (NVIDIA Image Scaling)</option>
                        <option value="linear">Linear</option>
                        <option value="nearest">Nearest</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Upscaling filter for better image quality when game resolution differs from output
                      </p>
                    </div>

                    {/* Fullscreen */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="settings.gamescope.fullscreen"
                        checked={formData.settings?.gamescope?.fullscreen || false}
                        onChange={(e) => {
                          setFormData({
                            ...formData,
                            settings: {
                              ...formData.settings,
                              gamescope: {
                                ...formData.settings?.gamescope,
                                fullscreen: e.target.checked,
                              },
                            },
                          });
                        }}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="settings.gamescope.fullscreen" className="text-sm text-text">
                        Fullscreen
                      </label>
                    </div>

                    {/* Frame Rate Limit */}
                    <div>
                      <label htmlFor="settings.gamescope.limitFps" className="block text-sm font-medium text-muted mb-2">
                        FPS Limit (optional)
                      </label>
                      <input
                        type="number"
                        id="settings.gamescope.limitFps"
                        name="settings.gamescope.limitFps"
                        value={formData.settings?.gamescope?.limitFps || ''}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
                        placeholder="e.g., 60"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Leave empty for no limit
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* MangoHUD Performance Overlay */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="settings.mangohud.enabled"
                    checked={formData.settings?.mangohud?.enabled || false}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        settings: {
                          ...formData.settings,
                          mangohud: {
                            ...formData.settings?.mangohud,
                            enabled: e.target.checked,
                          },
                        },
                      });
                    }}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <label htmlFor="settings.mangohud.enabled" className="text-sm font-medium text-text">
                    Enable MangoHUD performance overlay
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Display FPS, frame time, CPU/GPU usage, and other performance metrics in-game
                </p>
              </div>
            </div>
          )}

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
                    
                    {/* Game Screenshots Section */}
                    {screenshots.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-sm font-semibold text-text mb-2 flex items-center gap-2">
                          <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                          Your Screenshots
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {screenshots.map((screenshot) => (
                            <div
                              key={screenshot.filename}
                              onClick={() => selectImage(screenshot.path)}
                              className="cursor-pointer border-2 border-transparent hover:border-blue-500 rounded overflow-hidden transition-all group relative"
                            >
                              <img
                                src={screenshot.path}
                                alt={screenshot.filename}
                                className="w-full h-32 object-cover"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                                <span className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity px-2 text-center">
                                  {formatRelativeTime(screenshot.modified)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* IGDB Images Section */}
                    {availableImages.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-text mb-2 flex items-center gap-2">
                          <span className="inline-block w-2 h-2 bg-purple-500 rounded-full"></span>
                          IGDB Images
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                      </div>
                    )}
                    
                    {availableImages.length === 0 && screenshots.length === 0 && (
                      <p className="text-center text-muted py-8">No images available</p>
                    )}
                    
                    <button
                      type="button"
                      onClick={() => setShowImageSelector(null)}
                      className="w-full px-4 py-2 mt-6 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Game Screenshots - Show for emulator games (VICE) */}
          {mode === 'edit' && 
           ['c64', 'c128', 'vic20', 'plus4', 'pet'].includes(formData.platformId) && 
           screenshots.length > 0 && (
            <div className="space-y-4 mb-6">
              <h3 className="text-lg font-semibold text-text border-b pb-2">Game Screenshots</h3>
              <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <p className="text-sm text-muted mb-3">
                  Screenshots captured from VICE emulator (saved in emulator home directory)
                </p>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {screenshots.map((screenshot, index) => (
                    <div 
                      key={screenshot.filename}
                      className="flex items-center gap-3 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
                    >
                      {/* Thumbnail */}
                      <div className="flex-shrink-0">
                        <img
                          src={screenshot.path}
                          alt={`Screenshot ${index + 1}`}
                          className="w-32 h-24 object-cover rounded border border-gray-300 dark:border-gray-600"
                        />
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 min-w0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-text truncate">
                            {screenshot.filename}
                          </p>
                          <div className="relative group">
                            <InformationCircleIcon className="w-4 h-4 text-gray-400 hover:text-blue-500 cursor-help" />
                            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-10 w-64 p-3 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg">
                              <p className="font-medium mb-1">
                                {new Date(screenshot.modified).toLocaleString()}
                              </p>
                              <p className="text-gray-300 dark:text-gray-400">
                                Captured {formatRelativeTime(screenshot.modified)}
                              </p>
                              <div className="absolute left-4 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-muted mt-1">
                          {(screenshot.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              metadata: { ...prev.metadata, primaryImage: screenshot.path }
                            }));
                          }}
                          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        >
                          Set as Primary
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              metadata: { ...prev.metadata, backdropImage: screenshot.path }
                            }));
                          }}
                          className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                        >
                          Set as Backdrop
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

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

        {/* File Explorer for selecting ROM files */}
        {showRomFileExplorer && (
          <FileExplorer
            isOpen={showRomFileExplorer}
            onClose={() => setShowRomFileExplorer(false)}
            onSelect={handleRomFileSelect}
            selectMode="file"
            title="Select ROM File (.d64, .d81, .t64, .prg, .crt, .tap, .g64, .zip)"
          />
        )}

        {/* Container Logs Dialog */}
        {showLogsDialog && gameId && (
          <ContainerLogsDialog
            gameId={gameId}
            onClose={() => setShowLogsDialog(false)}
          />
        )}
      </div>
    </form>
  );
}
