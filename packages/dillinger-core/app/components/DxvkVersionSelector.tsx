'use client';

import { useState, useEffect } from 'react';
import { InformationCircleIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface InstalledDxvkVersion {
  id: string;
  type: 'dxvk' | 'dxvk-gplasync' | 'vkd3d-proton';
  version: string;
  displayName: string;
  path: string;
  installedAt: string;
  architectures: ('x32' | 'x64')[];
}

interface AvailableDxvkVersion {
  type: 'dxvk' | 'dxvk-gplasync' | 'vkd3d-proton';
  version: string;
  displayName: string;
  downloadUrl: string;
  size?: number;
  releaseDate: string;
  releaseNotes?: string;
}

interface DxvkVersionSelectorProps {
  enabled: boolean;
  versionId?: string; // Selected DXVK version, undefined = auto/winetricks
  onEnabledChange: (enabled: boolean) => void;
  onVersionChange: (versionId: string | undefined) => void;
  /** If true, show VKD3D-Proton options for DX12 */
  showVkd3d?: boolean;
  vkd3dEnabled?: boolean;
  vkd3dVersionId?: string;
  onVkd3dEnabledChange?: (enabled: boolean) => void;
  onVkd3dVersionChange?: (versionId: string | undefined) => void;
}

export default function DxvkVersionSelector({
  enabled,
  versionId,
  onEnabledChange,
  onVersionChange,
  showVkd3d = false,
  vkd3dEnabled = false,
  vkd3dVersionId,
  onVkd3dEnabledChange,
  onVkd3dVersionChange,
}: DxvkVersionSelectorProps) {
  const [installedVersions, setInstalledVersions] = useState<InstalledDxvkVersion[]>([]);
  const [availableDxvk, setAvailableDxvk] = useState<AvailableDxvkVersion[]>([]);
  const [availableVkd3d, setAvailableVkd3d] = useState<AvailableDxvkVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [installProgress, setInstallProgress] = useState<{ stage: string; percent?: number } | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  // Fetch DXVK versions
  useEffect(() => {
    const fetchVersions = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/dxvk-versions`);
        if (response.ok) {
          const data = await response.json();
          setInstalledVersions(data.installed || []);
          setAvailableDxvk(data.available?.dxvk || []);
          setAvailableVkd3d(data.available?.vkd3dProton || []);
        }
      } catch (error) {
        console.error('Failed to load DXVK versions:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchVersions();
  }, []);

  const installedDxvk = installedVersions.filter(v => v.type === 'dxvk' || v.type === 'dxvk-gplasync');
  const installedVkd3d = installedVersions.filter(v => v.type === 'vkd3d-proton');

  const handleInstall = async (version: AvailableDxvkVersion) => {
    setInstalling(version.version);
    setInstallProgress({ stage: 'Starting...', percent: 0 });

    try {
      const response = await fetch(`${API_BASE_URL}/api/dxvk-versions?stream=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version }),
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n').filter(line => line.startsWith('data: '));

        for (const line of lines) {
          const json = JSON.parse(line.substring(6));
          if (json.type === 'progress') {
            setInstallProgress({ stage: json.stage, percent: json.percent });
          } else if (json.type === 'complete') {
            setInstalledVersions(prev => [...prev, json.version]);
            // Auto-select the newly installed version
            if (version.type === 'vkd3d-proton') {
              onVkd3dVersionChange?.(json.version.id);
            } else {
              onVersionChange(json.version.id);
            }
          } else if (json.type === 'error') {
            throw new Error(json.error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to install DXVK:', error);
      alert(`Failed to install: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setInstalling(null);
      setInstallProgress(null);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'dxvk':
        return <span className="px-1.5 py-0.5 text-xs rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">DXVK</span>;
      case 'dxvk-gplasync':
        return <span className="px-1.5 py-0.5 text-xs rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">GPLAsync</span>;
      case 'vkd3d-proton':
        return <span className="px-1.5 py-0.5 text-xs rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">VKD3D</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="text-sm text-gray-500">Loading DXVK versions...</div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 space-y-4">
      {/* DXVK Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => onEnabledChange(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-muted">
              Enable DXVK (DirectX 9/10/11 → Vulkan)
            </span>
          </label>
          <button
            type="button"
            onClick={() => setShowInfo(!showInfo)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <InformationCircleIcon className="w-5 h-5" />
          </button>
        </div>

        {showInfo && (
          <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md text-xs text-blue-800 dark:text-blue-200">
            <strong>DXVK</strong> translates DirectX 9/10/11 calls to Vulkan for better performance on modern GPUs.
            Recommended for most DX9-11 games. For very old games (DirectDraw/D3D1-7), keep this off and use OpenGL renderer.
          </div>
        )}

        {enabled && (
          <div className="mt-3 space-y-2">
            <label className="block text-xs font-medium text-muted">DXVK Version</label>
            <select
              value={versionId || 'auto'}
              onChange={(e) => onVersionChange(e.target.value === 'auto' ? undefined : e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text text-sm"
            >
              <option value="auto">Auto (via winetricks)</option>
              {installedDxvk.map(v => (
                <option key={v.id} value={v.id}>
                  {v.displayName} {v.architectures.join('/')}
                </option>
              ))}
            </select>

            {/* Available versions to install */}
            {availableDxvk.length > 0 && (
              <div className="mt-2">
                <div className="text-xs text-gray-500 mb-1">Install a specific version:</div>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {availableDxvk.slice(0, 5).map(v => {
                    const isInstalled = installedDxvk.some(iv => iv.version === v.version);
                    const isInstalling = installing === v.version;
                    return (
                      <div key={v.version} className="flex items-center justify-between py-1 px-2 rounded bg-gray-100 dark:bg-gray-800 text-xs">
                        <span className="flex items-center gap-2">
                          {getTypeBadge(v.type)}
                          <span>{v.version}</span>
                        </span>
                        {isInstalled ? (
                          <span className="text-green-600 dark:text-green-400">Installed</span>
                        ) : isInstalling ? (
                          <span className="text-blue-600 dark:text-blue-400">
                            {installProgress?.stage} {installProgress?.percent !== undefined && `${installProgress.percent}%`}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleInstall(v)}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-400"
                          >
                            <ArrowDownTrayIcon className="w-3 h-3" />
                            Install
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* VKD3D-Proton Section (DX12) */}
      {showVkd3d && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={vkd3dEnabled}
                onChange={(e) => onVkd3dEnabledChange?.(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-muted">
                Enable VKD3D-Proton (DirectX 12 → Vulkan)
              </span>
            </label>
          </div>

          <p className="text-xs text-gray-500 mb-2">
            Required for DirectX 12 games. Note: DX12 support in Wine requires recent versions.
          </p>

          {vkd3dEnabled && (
            <div className="space-y-2">
              <select
                value={vkd3dVersionId || 'auto'}
                onChange={(e) => onVkd3dVersionChange?.(e.target.value === 'auto' ? undefined : e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text text-sm"
              >
                <option value="auto">Auto (via winetricks)</option>
                {installedVkd3d.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.displayName}
                  </option>
                ))}
              </select>

              {availableVkd3d.length > 0 && (
                <div className="mt-2">
                  <div className="text-xs text-gray-500 mb-1">Install a specific version:</div>
                  <div className="max-h-24 overflow-y-auto space-y-1">
                    {availableVkd3d.slice(0, 3).map(v => {
                      const isInstalled = installedVkd3d.some(iv => iv.version === v.version);
                      const isInstalling = installing === v.version;
                      return (
                        <div key={v.version} className="flex items-center justify-between py-1 px-2 rounded bg-gray-100 dark:bg-gray-800 text-xs">
                          <span className="flex items-center gap-2">
                            {getTypeBadge(v.type)}
                            <span>{v.version}</span>
                          </span>
                          {isInstalled ? (
                            <span className="text-green-600 dark:text-green-400">Installed</span>
                          ) : isInstalling ? (
                            <span className="text-blue-600 dark:text-blue-400">
                              {installProgress?.stage}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleInstall(v)}
                              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-400"
                            >
                              <ArrowDownTrayIcon className="w-3 h-3" />
                              Install
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
