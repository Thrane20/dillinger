'use client';

import { useState, useEffect } from 'react';
import FileExplorer from './FileExplorer';
import type { InstallGameRequest, InstallGameResponse } from '@dillinger/shared';

interface InstalledMount {
  name: string;
  mountPath: string;
}

interface WineVersion {
  id: string;
  name: string;
  type: 'system' | 'wine-staging' | 'ge-proton';
  version?: string;
}

interface LutrisInstallerInfo {
  id: number;
  slug: string;
  version: string;
  gameSlug?: string;
  notes?: string;
  script?: {
    game?: { arch?: string; exe?: string };
    wine?: { overrides?: Record<string, string> };
    system?: { env?: Record<string, string> };
    installer?: Array<{ task?: { name: string; app?: string } }>;
  };
}

interface GameData {
  id: string;
  title: string;
  slug?: string;
  tags?: string[];
  platforms?: Array<{
    platformId: string;
    lutrisInstaller?: LutrisInstallerInfo;
    lutrisInstallers?: LutrisInstallerInfo[];
    selectedLutrisInstallerId?: number;
    installation?: {
      status?: string;
      installerPath?: string;
      downloadCachePath?: string;
    };
  }>;
}

interface CachedInstaller {
  filename: string;
  path: string;
  size: number;
}

interface InstallGameDialogProps {
  gameId: string;
  platformId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function InstallGameDialog({ gameId, platformId, onClose, onSuccess }: InstallGameDialogProps) {
  const [installerPath, setInstallerPath] = useState('');
  const [installPath, setInstallPath] = useState('');
  const [installerArgs, setInstallerArgs] = useState('');
  const [debugMode, setDebugMode] = useState(false);
  const [wineVersionId, setWineVersionId] = useState('system');
  const [wineArch, setWineArch] = useState<'win32' | 'win64'>('win64');
  const [wineVersions, setWineVersions] = useState<WineVersion[]>();
  const [showFileExplorer, setShowFileExplorer] = useState<'installer' | 'location' | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installedMounts, setInstalledMounts] = useState<InstalledMount[]>([]);
  const [selectedVolume, setSelectedVolume] = useState<string | null>(null);
  
  // Install mode selection (null = not chosen yet)
  const [installMode, setInstallMode] = useState<'lutris' | 'standard' | null>(null);
  
  // Lutris-aware state
  const [_gameData, setGameData] = useState<GameData | null>(null);
  const [lutrisInstaller, setLutrisInstaller] = useState<LutrisInstallerInfo | null>(null);
  const [lutrisInstallers, setLutrisInstallers] = useState<LutrisInstallerInfo[]>([]);
  const [selectedLutrisInstallerId, setSelectedLutrisInstallerId] = useState<number | null>(null);
  const [cachedInstallers, setCachedInstallers] = useState<CachedInstaller[]>([]);
  const [downloadCachePath, setDownloadCachePath] = useState<string | null>(null);
  const [loadingGameData, setLoadingGameData] = useState(true);
  
  const isWinePlatform = platformId === 'windows-wine' || platformId.includes('wine');

  // Extract Lutris script details for display
  const getLutrisWinetricks = (): string[] => {
    if (!lutrisInstaller?.script?.installer) return [];
    const verbs: string[] = [];
    for (const step of lutrisInstaller.script.installer) {
      if (step.task?.name === 'winetricks' && step.task.app) {
        verbs.push(...step.task.app.split(/\s+/));
      }
    }
    return verbs;
  };

  const getLutrisDllOverrides = (): string[] => {
    if (!lutrisInstaller?.script?.wine?.overrides) return [];
    return Object.keys(lutrisInstaller.script.wine.overrides);
  };

  // Fetch game data and check for Lutris installer on mount
  useEffect(() => {
    const loadGameData = async () => {
      setLoadingGameData(true);
      try {
        // Load game data
        const gameResponse = await fetch(`/api/games/${gameId}`);
        if (gameResponse.ok) {
          const gameResult = await gameResponse.json();
          if (gameResult.success && gameResult.data) {
            setGameData(gameResult.data);
            
            // Check if this platform has Lutris installers configured
            const platformConfig = gameResult.data.platforms?.find(
              (p: any) => p.platformId === platformId
            );
            
            // Handle both single (deprecated) and multiple installers
            const installers: LutrisInstallerInfo[] = platformConfig?.lutrisInstallers || 
              (platformConfig?.lutrisInstaller ? [platformConfig.lutrisInstaller] : []);
            
            if (installers.length > 0) {
              setLutrisInstallers(installers);
              
              // Check if there's a pre-selected installer
              const preselectedId = platformConfig?.selectedLutrisInstallerId;
              if (preselectedId && installers.find(i => i.id === preselectedId)) {
                setSelectedLutrisInstallerId(preselectedId);
                const selected = installers.find(i => i.id === preselectedId);
                if (selected) {
                  setLutrisInstaller(selected);
                  // Apply Lutris settings from selected installer
                  if (selected.script?.game?.arch) {
                    setWineArch(selected.script.game.arch as 'win32' | 'win64');
                  }
                }
              } else if (installers.length === 1) {
                // Auto-select if only one installer
                setSelectedLutrisInstallerId(installers[0].id);
                setLutrisInstaller(installers[0]);
                if (installers[0].script?.game?.arch) {
                  setWineArch(installers[0].script.game.arch as 'win32' | 'win64');
                }
              }
            }
            
            // Store download cache path if available
            if (platformConfig?.installation?.downloadCachePath) {
              setDownloadCachePath(platformConfig.installation.downloadCachePath);
            }
            
            // For GOG games, check the cache for installer files
            if (gameResult.data.tags?.includes('gog')) {
              const cacheResponse = await fetch(`/api/gog/cache/${gameId}/files`);
              if (cacheResponse.ok) {
                const cacheResult = await cacheResponse.json();
                if (cacheResult.success && cacheResult.files?.length > 0) {
                  setCachedInstallers(cacheResult.files);
                  // Auto-select the first installer
                  if (cacheResult.files.length === 1) {
                    setInstallerPath(cacheResult.files[0].path);
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to load game data:', err);
      } finally {
        setLoadingGameData(false);
      }
    };
    loadGameData();
  }, [gameId, platformId]);

  // Fetch available volumes and first-class installed mounts on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const detectedResponse = await fetch('/api/volumes/detected');
        if (detectedResponse.ok) {
          const detectedData = await detectedResponse.json();
          if (detectedData.success && detectedData.data?.volumes) {
            const mounted = detectedData.data.volumes
              .filter((v: any) => typeof v.mountPath === 'string' && v.mountPath.startsWith('/installed'))
              .map((v: any) => ({
                name: v.dockerVolumeName || v.mountPath,
                mountPath: v.mountPath,
              }));
            setInstalledMounts(mounted);
            if (mounted[0]) {
              setSelectedVolume(mounted[0].mountPath);
            }
          }
        }

        // Load available Wine versions (for Wine platform)
        if (isWinePlatform) {
          const wineResponse = await fetch('/api/wine-versions');
          if (wineResponse.ok) {
            const wineData = await wineResponse.json();
            if (wineData.success) {
              setWineVersions(wineData.data.installedVersions || []);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load volumes/settings:', err);
      }
    };
    loadData();
  }, [isWinePlatform]);

  // Get the initial path for installer browser (cache-first convention)
  const getInstallersBrowsePath = (): string | undefined => {
    // First priority: use the download cache path from the game
    if (downloadCachePath) {
      return downloadCachePath;
    }
    return '/cache';
  };

  // Get the initial path for install location browser
  const getInstallLocationBrowsePath = (): string | undefined => {
    return installedMounts[0]?.mountPath || '/installed';
  };

  const handleVolumeSelect = (mountPath: string) => {
    setSelectedVolume(mountPath);
    setInstallPath(`${mountPath}/${gameId}`);
  };

  const handleInstallerSelect = (path: string) => {
    setInstallerPath(path);

    // Don't auto-populate install path - let the user choose from volume buttons first
    // This ensures step 2 (volume selection) is shown
    setShowFileExplorer(null);
  };

  const handleLocationSelect = (path: string) => {
    setInstallPath(path);
    setShowFileExplorer(null);
  };

  const handleInstall = async () => {
    if (!installerPath || !installPath) {
      setError('Please select both installer and installation location');
      return;
    }

    try {
      setIsInstalling(true);
      setError(null);

      const payload: InstallGameRequest = {
        installerPath,
        installPath,
        platformId,
      };

      // Backwards-compatible: only include optional fields if provided
      (payload as any).installerArgs = installerArgs || undefined;
      (payload as any).debugMode = debugMode || undefined;
      if (isWinePlatform) {
        (payload as any).wineVersionId = wineVersionId || 'system';
        (payload as any).wineArch = wineArch || 'win64';
      }

      const response = await fetch(`/api/games/${gameId}/install`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data: InstallGameResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to start installation');
      }

      // Installation started successfully
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to start installation:', err);
      setError(err instanceof Error ? err.message : 'Failed to start installation');
    } finally {
      setIsInstalling(false);
    }
  };

  const isConfirmStep = installerPath && installPath;
  
  // Determine if we need to show the install mode selection
  // Only show if Lutris installers are available and mode hasn't been chosen
  const hasLutrisInstallers = lutrisInstallers.length > 0;
  const needsInstallModeSelection = hasLutrisInstallers && installMode === null && !loadingGameData;
  
  // Helper to get step description
  const getStepDescription = () => {
    if (loadingGameData) return 'Checking for Lutris installer and cached files...';
    if (needsInstallModeSelection) return 'Step 1: Choose installation method';
    if (!installerPath) return hasLutrisInstallers ? 'Step 2: Select the installer file' : 'Step 1: Select the installer file';
    if (!installPath) return hasLutrisInstallers ? 'Step 3: Select installation directory' : 'Step 2: Select installation directory';
    return hasLutrisInstallers ? 'Step 4: Confirm and start installation' : 'Step 3: Confirm and start installation';
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-text">
              {loadingGameData ? 'Loading...' : 'Install Game'}
            </h2>
            <p className="text-sm text-muted mt-1">
              {getStepDescription()}
            </p>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-6">
            {error && (
              <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 rounded">
                {error}
              </div>
            )}

            {/* Install Mode Selection - first step when Lutris installers are available */}
            {needsInstallModeSelection && (
              <div className="space-y-4">
                <p className="text-sm text-muted">
                  This game has Lutris installer scripts available. Choose how you want to install:
                </p>
                
                {/* Lutris Install Option */}
                <button
                  type="button"
                  onClick={() => {
                    setInstallMode('lutris');
                    // Auto-select single installer
                    if (lutrisInstallers.length === 1) {
                      setSelectedLutrisInstallerId(lutrisInstallers[0].id);
                      setLutrisInstaller(lutrisInstallers[0]);
                      if (lutrisInstallers[0].script?.game?.arch) {
                        setWineArch(lutrisInstallers[0].script.game.arch as 'win32' | 'win64');
                      }
                    }
                  }}
                  className="w-full p-4 rounded-lg border-2 border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 hover:border-purple-400 dark:hover:border-purple-600 transition-colors text-left"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">🎮</span>
                    <div className="flex-1">
                      <div className="font-semibold text-purple-900 dark:text-purple-100">
                        Use Lutris Installer Script
                      </div>
                      <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                        Community-tested installation with automatic configuration (winetricks, DLL overrides, registry settings)
                      </p>
                      <div className="mt-2 text-xs text-purple-600 dark:text-purple-400">
                        {lutrisInstallers.length} script{lutrisInstallers.length !== 1 ? 's' : ''} available
                      </div>
                    </div>
                    <span className="text-purple-400">→</span>
                  </div>
                </button>

                {/* Standard Install Option */}
                <button
                  type="button"
                  onClick={() => {
                    setInstallMode('standard');
                    // Clear any Lutris installer selection
                    setLutrisInstaller(null);
                    setSelectedLutrisInstallerId(null);
                  }}
                  className="w-full p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 hover:border-gray-400 dark:hover:border-gray-500 transition-colors text-left"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">📦</span>
                    <div className="flex-1">
                      <div className="font-semibold text-text">
                        Standard Installation
                      </div>
                      <p className="text-sm text-muted mt-1">
                        Run the installer manually without Lutris script configuration
                      </p>
                      <div className="mt-2 text-xs text-gray-500">
                        Full control over the installation process
                      </div>
                    </div>
                    <span className="text-gray-400">→</span>
                  </div>
                </button>
              </div>
            )}

            {/* Lutris Installer Selection - show when Lutris mode selected and multiple installers available */}
            {installMode === 'lutris' && lutrisInstallers.length > 1 && !installerPath && (
              <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">🎮</span>
                  <div>
                    <h3 className="font-semibold text-purple-900 dark:text-purple-100">
                      Select Lutris Installer
                    </h3>
                    <p className="text-xs text-purple-600 dark:text-purple-400">
                      {lutrisInstallers.length} installers available - pick one to use
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {lutrisInstallers.map((installer) => {
                    const isSelected = selectedLutrisInstallerId === installer.id;
                    const winetricks = installer.script?.installer
                      ?.filter((step: any) => step.task?.name === 'winetricks' && step.task.app)
                      .map((step: any) => step.task.app.split(/\s+/))
                      .flat() || [];

                    return (
                      <label
                        key={installer.id}
                        className={`block p-3 rounded border cursor-pointer transition-colors ${
                          isSelected
                            ? 'border-purple-500 bg-purple-100 dark:bg-purple-800/30'
                            : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="radio"
                            name="lutrisInstallerSelect"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedLutrisInstallerId(installer.id);
                              setLutrisInstaller(installer);
                              if (installer.script?.game?.arch) {
                                setWineArch(installer.script.game.arch as 'win32' | 'win64');
                              }
                            }}
                            className="mt-1 h-4 w-4 text-purple-600"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-text">{installer.version}</span>
                              <span className="text-xs text-muted">({installer.slug})</span>
                            </div>
                            {installer.notes && (
                              <p className="text-xs text-muted mt-1">{installer.notes}</p>
                            )}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {installer.script?.game?.arch && (
                                <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">
                                  {installer.script.game.arch}
                                </span>
                              )}
                              {winetricks.length > 0 && (
                                <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded">
                                  winetricks
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Lutris Installer Banner - show when Lutris mode selected with single installer */}
            {installMode === 'lutris' && lutrisInstaller && !installerPath && lutrisInstallers.length <= 1 && (
              <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">🎮</span>
                  <div className="flex-1">
                    <h3 className="font-semibold text-purple-900 dark:text-purple-100">
                      Lutris Installer Configured
                    </h3>
                    <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                      <strong>{lutrisInstaller.version}</strong> by {lutrisInstaller.slug}
                    </p>
                    {lutrisInstaller.notes && (
                      <p className="text-xs text-purple-600 dark:text-purple-400 mt-1 italic">
                        {lutrisInstaller.notes}
                      </p>
                    )}
                    
                    {/* Show what the Lutris script will do */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {getLutrisWinetricks().length > 0 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 dark:bg-purple-800 text-purple-800 dark:text-purple-200">
                          🧪 Winetricks: {getLutrisWinetricks().join(', ')}
                        </span>
                      )}
                      {getLutrisDllOverrides().length > 0 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 dark:bg-purple-800 text-purple-800 dark:text-purple-200">
                          📦 DLL Overrides: {getLutrisDllOverrides().join(', ')}
                        </span>
                      )}
                      {lutrisInstaller.script?.game?.arch && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 dark:bg-purple-800 text-purple-800 dark:text-purple-200">
                          🖥️ {lutrisInstaller.script.game.arch === 'win32' ? '32-bit' : '64-bit'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Download Cache Path - show where GOG files are stored */}
            {downloadCachePath && !installerPath && !needsInstallModeSelection && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
                  <span>📁</span>
                  <span>Downloaded files location:</span>
                  <code className="text-xs bg-blue-100 dark:bg-blue-800 px-2 py-0.5 rounded">
                    {downloadCachePath}
                  </code>
                </div>
              </div>
            )}

            {/* Cached GOG Installers */}
            {!installerPath && cachedInstallers.length > 0 && !needsInstallModeSelection && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-muted mb-2">
                  📥 Downloaded Installers (from GOG)
                </label>
                <div className="space-y-2">
                  {cachedInstallers.map((installer, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setInstallerPath(installer.path)}
                      className="w-full text-left p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium">{installer.filename}</span>
                          <span className="text-sm text-muted ml-2">
                            ({(installer.size / (1024 * 1024)).toFixed(1)} MB)
                          </span>
                        </div>
                        <span className="text-blue-600 dark:text-blue-400">Select →</span>
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  These installers were downloaded from GOG and are ready to use.
                </p>
              </div>
            )}

            {!installerPath && !needsInstallModeSelection && (
              <div>
                <p className="text-sm text-muted mb-4">
                  {cachedInstallers.length > 0 
                    ? 'Or browse for a different installer file:'
                    : 'Click the button below to browse for the game installer file (.exe, .msi, etc.)'
                  }
                </p>
                <button
                  type="button"
                  onClick={() => setShowFileExplorer('installer')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Browse for Installer
                </button>
              </div>
            )}

            {installerPath && !installPath && (
              <div>
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    ✓ Installer: <span className="font-mono text-xs">{installerPath}</span>
                  </p>
                </div>

                {/* Volume Quick Select */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-muted mb-2">
                    📦 Quick Select Volume
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {installedMounts.length > 0 ? (
                      installedMounts.map((vol) => (
                        <button
                          key={vol.mountPath}
                          type="button"
                          onClick={() => handleVolumeSelect(vol.mountPath)}
                          className={`px-3 py-2 rounded-md text-sm transition-colors ${
                            selectedVolume === vol.mountPath
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200'
                          }`}
                        >
                          {vol.name}
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-muted">
                        No `/installed` mounts detected. Add `dillinger_installed_*` volumes and restart.
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Click a mounted install root to set the install location quickly.
                  </p>
                </div>

                <p className="text-sm text-muted mb-4">
                  Or browse to select a custom installation directory:
                </p>
                <button
                  type="button"
                  onClick={() => setShowFileExplorer('location')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Browse for Installation Directory
                </button>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-muted mb-2">
                    Installer Arguments (optional)
                  </label>
                  <input
                    type="text"
                    value={installerArgs}
                    onChange={(e) => setInstallerArgs(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
                    placeholder="e.g. /S or /VERYSILENT"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Some installers support silent switches. Leave empty for normal GUI install.
                  </p>
                </div>

                {/* Wine Version Selector */}
                {isWinePlatform && wineVersions && wineVersions.length > 0 && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-muted mb-2">
                      🍷 Wine Version
                    </label>
                    <select
                      value={wineVersionId}
                      onChange={(e) => setWineVersionId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
                    >
                      {wineVersions.map((wv) => (
                        <option key={wv.id} value={wv.id}>
                          {wv.name} {wv.type === 'ge-proton' ? '(GE-Proton)' : wv.type === 'wine-staging' ? '(Staging)' : ''}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Select the Wine version to use for this installation. GE-Proton is recommended for modern games.
                    </p>
                  </div>
                )}

                {/* Wine Architecture Selector */}
                {isWinePlatform && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-muted mb-2">
                      🖥️ Wine Architecture (Legacy)
                    </label>
                    <select
                      value={wineArch}
                      onChange={(e) => setWineArch(e.target.value as 'win32' | 'win64')}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
                    >
                      <option value="win64">64-bit (default)</option>
                      <option value="win32">32-bit (legacy Wine only)</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      <strong>Note:</strong> Modern Wine (9.x+, GE-Proton) uses WoW64 mode which runs both 32-bit and 64-bit games automatically. This setting is ignored for modern Wine.
                    </p>
                  </div>
                )}
              </div>
            )}

            {isConfirmStep && (
              <div className="space-y-4">
                {/* Lutris Installer Summary in Confirmation */}
                {lutrisInstaller && (
                  <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">🎮</span>
                      <h4 className="font-semibold text-purple-900 dark:text-purple-100">Lutris Configuration Active</h4>
                    </div>
                    <p className="text-sm text-purple-700 dark:text-purple-300 mb-2">
                      Using <strong>{lutrisInstaller.version}</strong> installer script
                    </p>
                    <div className="text-xs text-purple-600 dark:text-purple-400 space-y-1">
                      {getLutrisWinetricks().length > 0 && (
                        <p>• Winetricks: {getLutrisWinetricks().join(', ')}</p>
                      )}
                      {getLutrisDllOverrides().length > 0 && (
                        <p>• DLL Overrides: {getLutrisDllOverrides().join(', ')}</p>
                      )}
                      {lutrisInstaller.script?.game?.arch && (
                        <p>• Architecture: {lutrisInstaller.script.game.arch}</p>
                      )}
                      {lutrisInstaller.script?.system?.env && Object.keys(lutrisInstaller.script.system.env).length > 0 && (
                        <p>• Environment: {Object.keys(lutrisInstaller.script.system.env).join(', ')}</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-3">
                  <div>
                    <label className="text-sm font-medium text-muted">Installer:</label>
                    <p className="font-mono text-sm mt-1 break-all">{installerPath}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted">Installation Directory:</label>
                    <p className="font-mono text-sm mt-1 break-all">{installPath}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted">Platform:</label>
                    <p className="font-mono text-sm mt-1">{platformId}</p>
                  </div>
                  {isWinePlatform && (
                    <div>
                      <label className="text-sm font-medium text-muted">Wine Version:</label>
                      <p className="font-mono text-sm mt-1">
                        {wineVersions?.find(wv => wv.id === wineVersionId)?.name || wineVersionId}
                      </p>
                    </div>
                  )}
                  {isWinePlatform && (
                    <div>
                      <label className="text-sm font-medium text-muted">Wine Architecture:</label>
                      <p className="font-mono text-sm mt-1">
                        {wineArch === 'win32' ? '32-bit (win32)' : '64-bit (win64)'}
                      </p>
                    </div>
                  )}
                  {installerArgs && (
                    <div>
                      <label className="text-sm font-medium text-muted">Installer Args:</label>
                      <p className="font-mono text-sm mt-1 break-all">{installerArgs}</p>
                    </div>
                  )}
                </div>

                {/* Debug Mode Option */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={debugMode}
                      onChange={(e) => setDebugMode(e.target.checked)}
                      className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-medium text-gray-900 dark:text-gray-100">Debug Mode</span>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Keep the installation container after it exits. Use this to inspect logs if installation fails.
                        You can view container logs with: <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">docker logs dillinger-install-debug-*</code>
                      </p>
                    </div>
                  </label>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    ⚠️ <strong>Important:</strong> The installation GUI will appear on your display. 
                    Follow the installer wizard to complete the installation.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
            <div>
              {installerPath && !isInstalling && (
                <button
                  type="button"
                  onClick={() => {
                    if (!installPath) {
                      setInstallerPath('');
                    } else {
                      setInstallPath('');
                    }
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  ← Back
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                disabled={isInstalling}
              >
                Cancel
              </button>
              {isConfirmStep && (
                <button
                  type="button"
                  onClick={handleInstall}
                  disabled={isInstalling}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isInstalling ? 'Starting...' : 'Start Installation'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* File Explorer Modal */}
      {showFileExplorer === 'installer' && (
        <FileExplorer
          isOpen={true}
          onClose={() => setShowFileExplorer(null)}
          onSelect={handleInstallerSelect}
          title="Select Installer File"
          selectMode="file"
          showVolumes={true}
          initialPath={getInstallersBrowsePath()}
        />
      )}

      {showFileExplorer === 'location' && (
        <FileExplorer
          isOpen={true}
          onClose={() => setShowFileExplorer(null)}
          onSelect={handleLocationSelect}
          title="Select Installation Directory"
          selectMode="directory"
          showVolumes={true}
          initialPath={getInstallLocationBrowsePath()}
        />
      )}
    </>
  );
}
