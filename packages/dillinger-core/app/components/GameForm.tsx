'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { deriveWinePhase, type RetroarchMameSettings, type RetroarchMameAspect, type WineGamePhase, type GamePlatformConfig } from '@dillinger/shared';
import { type ShortcutInfo } from './ShortcutSelectorDialog';
import type {
  GameFormData,
  GameFormProps,
  SavedGameMetadata,
  Screenshot,
  SaveFile,
  MakeItRunCompatibilitySummary,
} from './game-form-types';
import WinePerformanceSection from './WinePerformanceSection';
import WineRenderingSection from './WineRenderingSection';
import WineMakeItRunSection from './WineMakeItRunSection';
import InstallConfigurationSection from './InstallConfigurationSection';
import GameInfoSection from './GameInfoSection';
import DisplayImagesSection from './DisplayImagesSection';
import ScrapeDataSection from './ScrapeDataSection';
import RetroMediaSection from './RetroMediaSection';
import BasicInformationSection from './BasicInformationSection';
import WineStatusBanner from './WineStatusBanner';
import GameFormActionButtons from './GameFormActionButtons';
import GameFormDialogs from './GameFormDialogs';
import GameFormHeader from './GameFormHeader';
import GameFormSidebar from './GameFormSidebar';
import ScraperDataPreservedNotice from './ScraperDataPreservedNotice';
import {
  stripNullTerminators,
  sanitizeStringArray,
  formatRelativeTime,
  normalizeMameSettings,
} from './game-form-utils';
import {
  switchPlatformState,
  addPlatformState,
  removePlatformState,
} from './game-form-platform-utils';
import {
  ROMS_BROWSE_PATH,
  applyShortcutSelection,
  applyFileExplorerSelection,
  applyRomFileSelection,
} from './game-form-selection-utils';
import {
  RETROARCH_PLATFORMS,
  ROM_PLATFORMS,
  COMMON_WINETRICKS_VERBS,
  getFormSections,
} from './game-form-constants';
import { useSectionNavigation } from './useSectionNavigation';
import {
  fetchLatestScraperData,
  launchGameLocally,
  mergeRefreshedScraperData,
} from './game-form-async-actions';
import {
  applyConfiguredWineRegistrySettings,
  applyCompatibilitySummary,
  exportMakeItRunToml,
  fetchCompatibilitySummary,
  importMakeItRunToml,
  runWineRegistrySetup,
} from './game-form-makeitrun-actions';
import {
  applyDllQuickAddState,
  buildSaveDownloadUrl,
  selectImageState,
  updateMameOverridesState,
} from './game-form-mutation-utils';
import {
  buildGameSubmitPayload,
  submitGamePayload,
} from './game-form-submit-utils';
import { applyInputChange } from './game-form-change-utils';

export default function GameForm({ mode, gameId, onSuccess, onCancel }: GameFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [availableImages, setAvailableImages] = useState<string[]>([]);
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [currentScreenshotIndex, setCurrentScreenshotIndex] = useState(0);
  const [saveFiles, setSaveFiles] = useState<{ sram: SaveFile[]; states: SaveFile[] }>({ sram: [], states: [] });
  const [showImageSelector, setShowImageSelector] = useState<'primary' | 'backdrop' | null>(null);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [showShortcutDialog, setShowShortcutDialog] = useState(false);
  const [showFileExplorer, setShowFileExplorer] = useState(false);
  const [showRomFileExplorer, setShowRomFileExplorer] = useState(false);
  const [showLogsDialog, setShowLogsDialog] = useState(false);
  const [showWineMonitorModal, setShowWineMonitorModal] = useState(false);
  const [showAddPlatform, setShowAddPlatform] = useState(false);
  const [makeItRunCompatLoading, setMakeItRunCompatLoading] = useState(false);
  const [makeItRunCompatSummary, setMakeItRunCompatSummary] = useState<MakeItRunCompatibilitySummary | null>(null);
  const [makeItRunIoLoading, setMakeItRunIoLoading] = useState(false);
  const [winetricksVerbQuery, setWinetricksVerbQuery] = useState('');
  
  // Section navigation state for sidebar shortcuts
  const [activeSection, setActiveSection] = useState<string>('basic');
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  
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
        version: undefined,
        umuGameId: undefined,
        arch: 'win64',
        renderer: 'vulkan',
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

  const scrapeHref = mode === 'edit' && gameId
    ? `/games/${gameId}/scrape?title=${encodeURIComponent(formData.title || '')}`
    : null;

  // Convenience accessors for the currently selected platform config
  const activePlatformConfig = formData.platforms.find(p => p.platformId === formData.platformId);
  const activeInstallation = activePlatformConfig?.installation || formData._originalGame?.installation;
  const winePhase: WineGamePhase = formData.platformId === 'windows-wine'
    ? deriveWinePhase(
        { slug: formData.slug, title: formData.title },
        activePlatformConfig,
        {
          hasActiveSession: false,
          hasMakeItRunConfig: undefined,
        }
      )
    : 'ready';
  const mameAspectValue = (formData.settings?.emulator?.settings?.mame?.aspect ?? 'default') as RetroarchMameAspect | 'default';
  const mameIntegerScaleValue = formData.settings?.emulator?.settings?.mame?.integerScale;
  const mameIntegerScaleSelect = mameIntegerScaleValue === undefined ? 'default' : mameIntegerScaleValue ? 'true' : 'false';
  const mameBorderlessValue = formData.settings?.emulator?.settings?.mame?.borderlessFullscreen;
  const mameBorderlessSelect = mameBorderlessValue === undefined ? 'default' : mameBorderlessValue ? 'true' : 'false';
  const filteredWinetricksVerbs = COMMON_WINETRICKS_VERBS
    .filter((verb) => verb.toLowerCase().includes(winetricksVerbQuery.trim().toLowerCase()))
    .filter((verb) => !(formData.settings?.wine?.winetricks || []).includes(verb))
    .slice(0, 8);

  // Section definitions for sidebar navigation (Wine games only)
  const canAccessWineAdvanced = activeInstallation?.status === 'installed';
  const sections = getFormSections(formData.platformId, activeInstallation?.status, canAccessWineAdvanced);
  const { scrollToSection } = useSectionNavigation({
    sections,
    sectionRefs,
    setActiveSection,
  });

  // Display paths as-is since they are now direct host paths on configured volumes
  const formatInstalledPathForDisplay = (p: string) => p;

  // Auto-open Wine Installation Monitor when installation is in progress
  useEffect(() => {
    if (
      formData.platformId === 'windows-wine' &&
      activeInstallation?.status === 'installing' &&
      gameId
    ) {
      setShowWineMonitorModal(true);
    }
  }, [activeInstallation?.status, formData.platformId, gameId]);

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
              let platforms: GamePlatformConfig[] = game.platforms || [];
              
              // Backwards compatibility: if no platforms array but we have legacy fields, create one
              if (platforms.length === 0 && game.platformId) {
                platforms = [{
                  platformId: game.platformId,
                  settings: game.settings,
                  filePath: game.filePath,
                  installation: game.installation
                }];
              }
              
              const activePlatform = platforms.find((platform) => platform.platformId === activePlatformId) || platforms[0];
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
                    version: activeSettings?.wine?.version,
                    umuGameId: activeSettings?.wine?.umuGameId,
                    arch: activeSettings?.wine?.arch || 'win64',
                    useDxvk: activeSettings?.wine?.useDxvk || false,
                    dxvkVersion: activeSettings?.wine?.dxvkVersion,
                    useVkd3dProton: activeSettings?.wine?.useVkd3dProton || false,
                    vkd3dVersion: activeSettings?.wine?.vkd3dVersion,
                    renderer: activeSettings?.wine?.renderer || 'vulkan',
                    compatibilityMode: activeSettings?.wine?.compatibilityMode || 'none',
                    dlls: activeSettings?.wine?.dlls || {},
                    dllOverrides: activeSettings?.wine?.dllOverrides || '',
                    winetricks: Array.isArray(activeSettings?.wine?.winetricks)
                      ? activeSettings.wine.winetricks
                      : [],
                    registrySettings: Array.isArray(activeSettings?.wine?.registrySettings)
                      ? activeSettings.wine.registrySettings
                      : [],
                    debug: activeSettings?.wine?.debug || {},
                  },
                  launch: {
                    command: stripNullTerminators(activeSettings?.launch?.command || ''),
                    arguments: sanitizeStringArray(activeSettings?.launch?.arguments),
                    environment: activeSettings?.launch?.environment || {},
                    workingDirectory: stripNullTerminators(activeSettings?.launch?.workingDirectory || ''),
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
                  emulator: {
                    core: activeSettings?.emulator?.core,
                    settings: activeSettings?.emulator?.settings,
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
    if (mode === 'edit' && gameId && activeInstallation?.status === 'installing') {
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
  }, [mode, gameId, activeInstallation?.status]);

  // Handle reinstall - confirm, clear install metadata, and route to wizard
  const handleReinstall = async () => {
    if (!gameId) return;

    const confirmed = window.confirm(
      'Reinstall this game? This clears current installation status and opens the install wizard.'
    );
    if (!confirmed) {
      return;
    }
    
    try {
      // Reset the installation status via platform API
      const response = await fetch(`/api/games/${gameId}/platforms/windows-wine`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          installation: {
            status: 'not_installed',
            installPath: undefined,
            installerPath: undefined,
            installerArgs: undefined,
            containerId: undefined,
            installedAt: undefined,
            error: undefined,
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to reset installation status');
      }

      // Update local form state to reflect the change
      setFormData(prev => ({
        ...prev,
        platforms: prev.platforms.map(p => 
          p.platformId === prev.platformId 
            ? {
                ...p,
                installation: {
                  ...(p.installation || {}),
                  status: 'not_installed',
                  installPath: undefined,
                  installerPath: undefined,
                  installerArgs: undefined,
                  containerId: undefined,
                  installedAt: undefined,
                  error: undefined,
                },
              }
            : p
        ),
      }));

      router.push(`/games/${gameId}/install`);
    } catch (err) {
      console.error('Failed to reset installation:', err);
      setError('Failed to reset installation status');
    }
  };

  // Handle cancel installation - stop container and reset status
  const handleCancelInstallation = async () => {
    if (!gameId) return;
    
    try {
      const response = await fetch(`/api/games/${gameId}/install`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to cancel installation');
      }

      // Update local form state to reflect the change
      setFormData(prev => ({
        ...prev,
        platforms: prev.platforms.map(p => 
          p.platformId === prev.platformId 
            ? { ...p, installation: { status: 'not_installed' } }
            : p
        ),
        _originalGame: prev._originalGame ? {
          ...prev._originalGame,
          installation: { status: 'not_installed' }
        } : undefined,
      }));

      setSuccessMessage('Installation cancelled');
    } catch (err) {
      console.error('Failed to cancel installation:', err);
      setError('Failed to cancel installation');
    }
  };

  // Load available images from scraped metadata
  useEffect(() => {
    if (gameId && mode === 'edit') {
      loadAvailableImages(gameId);
      loadScreenshots(gameId);
      loadSaves(gameId);
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
          setCurrentScreenshotIndex(0);
        }
      }
    } catch (err) {
      console.error('Failed to load screenshots:', err);
    }
  };

  const loadSaves = async (id: string) => {
    try {
      const response = await fetch(`/api/games/${id}/saves`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setSaveFiles({
            sram: result.data.sram || [],
            states: result.data.states || [],
          });
        }
      }
    } catch (err) {
      console.error('Failed to load saves:', err);
    }
  };

  const deleteSave = async (filename: string, type: 'sram' | 'state') => {
    if (!gameId) return;
    
    if (!confirm(`Are you sure you want to delete "${filename}"? This cannot be undone.`)) {
      return;
    }
    
    try {
      const response = await fetch(
        `/api/games/${gameId}/saves?filename=${encodeURIComponent(filename)}&type=${type}`,
        { method: 'DELETE' }
      );
      
      if (response.ok) {
        // Reload saves after deletion
        await loadSaves(gameId);
      } else {
        const result = await response.json();
        alert(`Failed to delete: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Failed to delete save:', err);
      alert('Failed to delete save file');
    }
  };

  const downloadSave = (filename: string, type: 'sram' | 'state') => {
    if (!gameId) return;
    const url = buildSaveDownloadUrl(gameId, filename, type);
    window.open(url, '_blank');
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const payload = buildGameSubmitPayload(formData);
      const { savedGameId } = await submitGamePayload(mode, gameId, payload);
      setSuccessMessage('Game saved successfully!');
      
      if (onSuccess) {
        onSuccess();
      } else {
        router.push(`/?scrollTo=${savedGameId || gameId}`);
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
    setFormData((prev) => applyInputChange(prev, name, value));
  };

  const updateMameOverrides = (updates: Partial<RetroarchMameSettings>) => {
    setFormData((prev) => updateMameOverridesState(prev, updates, normalizeMameSettings));
  };

  const selectImage = (imageUrl: string) => {
    setFormData((prev) => selectImageState(prev, imageUrl, showImageSelector));
    setShowImageSelector(null);
  };

  const applyDllQuickAdd = (dllName: string, mode: string) => {
    setFormData((prev) => applyDllQuickAddState(prev, dllName, mode));
  };

  const handleMakeItRunAutoDetect = async () => {
    if (!gameId) {
      setError('Save this game first before running compatibility auto-detect.');
      return;
    }

    setMakeItRunCompatLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const summary = await fetchCompatibilitySummary(gameId);

      setMakeItRunCompatSummary(summary);
      setFormData((prev) => applyCompatibilitySummary(prev, summary));

      setSuccessMessage('Compatibility recommendations loaded into MakeItRun settings.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to auto-detect compatibility data');
    } finally {
      setMakeItRunCompatLoading(false);
    }
  };

  const handleExportMakeItRunToml = async () => {
    if (!gameId) {
      setError('Save this game first before exporting MakeItRun TOML.');
      return;
    }

    setMakeItRunIoLoading(true);
    setError(null);

    try {
      const { slug, tomlContent } = await exportMakeItRunToml(gameId, formData.slug || gameId);
      const blob = new Blob([tomlContent], { type: 'text/plain;charset=utf-8' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${slug}.toml`;
      a.click();
      URL.revokeObjectURL(downloadUrl);

      setSuccessMessage('MakeItRun TOML exported successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export MakeItRun TOML');
    } finally {
      setMakeItRunIoLoading(false);
    }
  };

  const handleImportMakeItRunToml = async (file: File) => {
    if (!gameId) {
      setError('Save this game first before importing MakeItRun TOML.');
      return;
    }

    setMakeItRunIoLoading(true);
    setError(null);

    try {
      const toml = await file.text();
      await importMakeItRunToml(toml, formData.slug || gameId, gameId);

      setSuccessMessage('MakeItRun TOML imported and applied. Reloading current form state...');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import MakeItRun TOML');
    } finally {
      setMakeItRunIoLoading(false);
    }
  };

  const handleRunWineRegistrySetup = async () => {
    if (!gameId) {
      setError('Save this game first before running Wine registry setup.');
      throw new Error('Game ID required');
    }

    setError(null);
    setSuccessMessage(null);

    const { message } = await runWineRegistrySetup(gameId);
    setSuccessMessage(message);
  };

  const handleApplyConfiguredRegistrySettings = async () => {
    if (!gameId) {
      setError('Save this game first before applying registry settings.');
      throw new Error('Game ID required');
    }

    setError(null);
    setSuccessMessage(null);

    const registrySettings = formData.settings?.wine?.registrySettings || [];
    const { message } = await applyConfiguredWineRegistrySettings(gameId, registrySettings, formData.platformId);
    setSuccessMessage(message);
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
      const scraperType = 'igdb';
      const scraperId = formData._originalGame.metadata.igdbId.toString();
      const latestData = await fetchLatestScraperData(scraperType, scraperId);
      setFormData((prev) => mergeRefreshedScraperData(prev, latestData, scraperType));

      setSuccessMessage('Successfully refreshed metadata from scraper!');
      
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

  const handleQuickLaunch = async () => {
    if (!gameId) return;

    try {
      setError(null);
      setSuccessMessage(null);
      await launchGameLocally(gameId);

      setSuccessMessage('Game launch started. Check Sessions for status.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to launch game');
    }
  };

  const handleSelectShortcut = (shortcut: ShortcutInfo) => {
    setFormData((prev) => applyShortcutSelection(prev, shortcut, stripNullTerminators, sanitizeStringArray));
    setShowShortcutDialog(false);
  };

  const handleBrowseInstallDirectory = () => {
    setShowShortcutDialog(false);
    setShowFileExplorer(true);
  };

  // First-class volume convention: ROM browsing always starts at /roms
  const getRomsBrowsePath = (): string => {
    return ROMS_BROWSE_PATH;
  };

  const handleFileExplorerSelect = (path: string) => {
    setFormData((prev) => applyFileExplorerSelection(prev, path));
    setShowFileExplorer(false);
  };

  const handleRomFileSelect = (path: string) => {
    setFormData((prev) => applyRomFileSelection(prev, path));
    setShowRomFileExplorer(false);
  };





  const switchPlatform = (newPlatformId: string) => {
    if (newPlatformId === formData.platformId) return;

    setFormData((prev) => switchPlatformState(prev, newPlatformId));
  };

  const handleAddPlatform = (platformId: string) => {
    if (!platformId) return;
    
    // Check if already exists
    if (formData.platforms.some(p => p.platformId === platformId)) {
      switchPlatform(platformId);
      setShowAddPlatform(false);
      return;
    }

    setFormData((prev) => addPlatformState(prev, platformId));
    
    setShowAddPlatform(false);
  };

  const handleRemovePlatform = (platformId: string) => {
    if (!confirm('Are you sure you want to remove this platform configuration?')) return;

    setFormData((prev) => removePlatformState(prev, platformId));
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-7xl mx-auto">
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
        <GameFormHeader
          mode={mode}
          hasIgdbId={Boolean(formData._originalGame?.metadata?.igdbId)}
          isRefreshing={isRefreshing}
          onRefreshFromScraper={handleRefreshFromScraper}
          error={error}
          successMessage={successMessage}
        />

        {formData.platformId === 'windows-wine' && (
          <div className="px-6 pt-6">
            <WineStatusBanner
              phase={winePhase}
              gameId={gameId}
              onOpenMonitor={() => setShowWineMonitorModal(true)}
              onLaunch={handleQuickLaunch}
            />
          </div>
        )}

        {/* Main content with sidebar */}
        <div className="flex">
          <GameFormSidebar
            sections={sections}
            activeSection={activeSection}
            onScrollToSection={scrollToSection}
          />

          {/* Main Content Area */}
          <div className="flex-1 p-6 overflow-y-auto">

          <ScraperDataPreservedNotice
            similarGamesCount={mode === 'edit' ? formData._originalGame?.metadata?.similarGames?.length : undefined}
          />

          <BasicInformationSection
            formData={formData}
            handleChange={handleChange}
            switchPlatform={switchPlatform}
            handleRemovePlatform={handleRemovePlatform}
            showAddPlatform={showAddPlatform}
            setShowAddPlatform={setShowAddPlatform}
            handleAddPlatform={handleAddPlatform}
            sectionRef={(el) => {
              sectionRefs.current['basic'] = el;
            }}
          />

          <InstallConfigurationSection
            mode={mode}
            gameId={gameId}
            formData={formData}
            setFormData={setFormData}
            handleChange={handleChange}
            sectionRef={(el) => {
              sectionRefs.current['install'] = el;
            }}
            romPlatforms={ROM_PLATFORMS}
            mameAspectValue={mameAspectValue}
            mameIntegerScaleSelect={mameIntegerScaleSelect}
            mameBorderlessSelect={mameBorderlessSelect}
            updateMameOverrides={updateMameOverrides}
            onOpenRomExplorer={() => setShowRomFileExplorer(true)}
            activeInstallation={activeInstallation}
            selectedLutrisInstallerId={activePlatformConfig?.selectedLutrisInstallerId}
            formatInstalledPathForDisplay={formatInstalledPathForDisplay}
            onOpenWineMonitor={() => setShowWineMonitorModal(true)}
            onOpenLogs={() => setShowLogsDialog(true)}
            onCancelInstallation={handleCancelInstallation}
            onReinstall={handleReinstall}
            onOpenShortcutSelector={() => setShowShortcutDialog(true)}
            onOpenFileExplorer={() => setShowFileExplorer(true)}
          />

          {formData.platformId === 'windows-wine' && (
            <WineRenderingSection
              formData={formData}
              setFormData={setFormData}
              handleChange={handleChange}
              phase={winePhase}
              sectionRef={(el) => {
                sectionRefs.current['rendering'] = el;
              }}
            />
          )}

          {formData.platformId === 'windows-wine' && (
            <WineMakeItRunSection
              gameId={gameId}
              formData={formData}
              setFormData={setFormData}
              handleChange={handleChange}
              selectedLutrisInstallerId={activePlatformConfig?.selectedLutrisInstallerId}
              makeItRunCompatLoading={makeItRunCompatLoading}
              makeItRunCompatSummary={makeItRunCompatSummary}
              makeItRunIoLoading={makeItRunIoLoading}
              winetricksVerbQuery={winetricksVerbQuery}
              setWinetricksVerbQuery={setWinetricksVerbQuery}
              filteredWinetricksVerbs={filteredWinetricksVerbs}
              commonWinetricksVerbs={COMMON_WINETRICKS_VERBS}
              applyDllQuickAdd={applyDllQuickAdd}
              onAutoDetect={handleMakeItRunAutoDetect}
              onExportToml={handleExportMakeItRunToml}
              onImportFileSelected={(file) => {
                void handleImportMakeItRunToml(file);
              }}
              onRunRegistrySetup={() => handleRunWineRegistrySetup()}
              onApplyRegistrySettings={() => handleApplyConfiguredRegistrySettings()}
              phase={winePhase}
              sectionRef={(el) => {
                sectionRefs.current['makeitrun-config'] = el;
              }}
            />
          )}

          {formData.platformId === 'windows-wine' && (
            <WinePerformanceSection
              formData={formData}
              setFormData={setFormData}
              handleChange={handleChange}
              isLocked={!canAccessWineAdvanced}
              phase={winePhase}
              sectionRef={(el) => {
                sectionRefs.current['performance'] = el;
              }}
            />
          )}

          <GameInfoSection
            mode={mode}
            formData={formData}
            screenshots={screenshots}
            currentScreenshotIndex={currentScreenshotIndex}
            setCurrentScreenshotIndex={setCurrentScreenshotIndex}
            handleChange={handleChange}
            setFormData={setFormData}
            sectionRef={(el) => {
              sectionRefs.current['game-info'] = el;
            }}
          />

          <DisplayImagesSection
            availableImages={availableImages}
            screenshots={screenshots}
            formData={formData}
            setFormData={setFormData}
            showImageSelector={showImageSelector}
            setShowImageSelector={setShowImageSelector}
            selectImage={selectImage}
            formatRelativeTime={formatRelativeTime}
          />

          <ScrapeDataSection scrapeHref={scrapeHref} />

          <RetroMediaSection
            mode={mode}
            platformId={formData.platformId}
            screenshots={screenshots}
            saveFiles={saveFiles}
            retroarchPlatforms={RETROARCH_PLATFORMS}
            setFormData={setFormData}
            formatRelativeTime={formatRelativeTime}
            downloadSave={downloadSave}
            deleteSave={deleteSave}
          />

          <GameFormActionButtons
            isSubmitting={isSubmitting}
            mode={mode}
            onCancel={onCancel}
            onCancelFallback={() => router.push('/')}
          />
          </div>{/* End Main Content Area */}
        </div>{/* End flex container */}

        <GameFormDialogs
          gameId={gameId}
          platformId={formData.platformId}
          gameTitle={formData.title}
          launchWorkingDirectory={formData.settings?.launch?.workingDirectory}
          showInstallDialog={showInstallDialog}
          showShortcutDialog={showShortcutDialog}
          showFileExplorer={showFileExplorer}
          showRomFileExplorer={showRomFileExplorer}
          showLogsDialog={showLogsDialog}
          showWineMonitorModal={showWineMonitorModal}
          activeInstallPath={activeInstallation?.installPath}
          onInstallDialogClose={() => setShowInstallDialog(false)}
          onInstallSuccess={() => {
            setSuccessMessage('Installation started! Follow the wizard on your display.');
            window.location.reload();
          }}
          onShortcutDialogClose={() => setShowShortcutDialog(false)}
          onSelectShortcut={handleSelectShortcut}
          onBrowseManually={handleBrowseInstallDirectory}
          onFileExplorerClose={() => setShowFileExplorer(false)}
          onFileExplorerSelect={handleFileExplorerSelect}
          onRomExplorerClose={() => setShowRomFileExplorer(false)}
          onRomFileSelect={handleRomFileSelect}
          onLogsClose={() => setShowLogsDialog(false)}
          onWineMonitorClose={() => setShowWineMonitorModal(false)}
          onWineMonitorCancel={() => {
            handleCancelInstallation();
            setShowWineMonitorModal(false);
          }}
          getRomsBrowsePath={getRomsBrowsePath}
        />
      </div>
    </form>
  );
}
