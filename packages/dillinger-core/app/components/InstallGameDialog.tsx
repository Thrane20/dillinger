'use client';

import { useState, useEffect } from 'react';
import FileExplorer from './FileExplorer';
import type { InstallGameRequest, InstallGameResponse } from '@dillinger/shared';

interface Volume {
  id: string;
  name: string;
  dockerVolumeName: string;
  hostPath: string;
}

interface VolumeDefaults {
  defaults: {
    installers: string | null;
    downloads: string | null;
    installed: string | null;
    roms: string | null;
  };
  volumeMetadata: Record<string, {
    storageType?: 'ssd' | 'platter' | 'archive';
  }>;
}

interface WineVersion {
  id: string;
  name: string;
  type: 'system' | 'wine-staging' | 'ge-proton';
  version?: string;
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
  const [availableVolumes, setAvailableVolumes] = useState<Volume[]>([]);
  const [selectedVolume, setSelectedVolume] = useState<string | null>(null);
  const [volumeDefaults, setVolumeDefaults] = useState<VolumeDefaults | null>(null);
  const isWinePlatform = platformId === 'windows-wine' || platformId.includes('wine');

  // Fetch available volumes and defaults on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load configured volumes (bind mounts)
        const volumesResponse = await fetch('/api/volumes');
        if (volumesResponse.ok) {
          const volumesData = await volumesResponse.json();
          setAvailableVolumes(volumesData.data || []);
        }

        // Load volume defaults
        const defaultsResponse = await fetch('/api/volumes/defaults');
        if (defaultsResponse.ok) {
          const defaultsData = await defaultsResponse.json();
          if (defaultsData.success) {
            setVolumeDefaults(defaultsData.data);
            // Pre-select the default "installed" volume if set
            if (defaultsData.data.defaults.installed) {
              setSelectedVolume(defaultsData.data.defaults.installed);
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

  // Get the volume object by ID
  const getVolumeById = (id: string) => availableVolumes.find(v => v.id === id);

  // Check if a volume is the default for a purpose
  const isDefaultFor = (volumeId: string, purpose: keyof VolumeDefaults['defaults']) => {
    return volumeDefaults?.defaults[purpose] === volumeId;
  };

  // Get the initial path for installer browser (uses 'installers' default volume)
  const getInstallersBrowsePath = (): string | undefined => {
    const installersVolumeId = volumeDefaults?.defaults.installers;
    if (installersVolumeId) {
      const volume = getVolumeById(installersVolumeId);
      if (volume) {
        return volume.hostPath;
      }
    }
    return undefined; // Let FileExplorer use its default
  };

  // Get the initial path for install location browser (uses 'installed' default volume)
  const getInstallLocationBrowsePath = (): string | undefined => {
    const installedVolumeId = volumeDefaults?.defaults.installed;
    if (installedVolumeId) {
      const volume = getVolumeById(installedVolumeId);
      if (volume) {
        return volume.hostPath;
      }
    }
    return undefined; // Let FileExplorer use its default
  };

  const handleVolumeSelect = (volumeId: string) => {
    setSelectedVolume(volumeId);
    const volume = getVolumeById(volumeId);
    if (volume) {
      // Use the volume's host path as base
      setInstallPath(`${volume.hostPath}/${gameId}`);
    }
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

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-text">Install Game</h2>
            <p className="text-sm text-muted mt-1">
              {!installerPath && 'Step 1: Select the installer file'}
              {installerPath && !installPath && 'Step 2: Select installation directory'}
              {isConfirmStep && 'Step 3: Confirm and start installation'}
            </p>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-6">
            {error && (
              <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 rounded">
                {error}
              </div>
            )}

            {!installerPath && (
              <div>
                <p className="text-sm text-muted mb-4">
                  Click the button below to browse for the game installer file (.exe, .msi, etc.)
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
                    {availableVolumes.length > 0 ? (
                      availableVolumes.map((vol) => (
                        <button
                          key={vol.id}
                          type="button"
                          onClick={() => handleVolumeSelect(vol.id)}
                          className={`px-3 py-2 rounded-md text-sm transition-colors ${
                            selectedVolume === vol.id
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200'
                          }`}
                        >
                          {isDefaultFor(vol.id, 'installed') && '🎮 '}
                          {vol.name}
                          {isDefaultFor(vol.id, 'installed') && ' ⭐'}
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-muted">
                        No volumes configured. Add volumes in the Volume Manager on the left sidebar.
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    Click a volume to set the install location. ⭐ indicates your default from Volume Manager.
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
