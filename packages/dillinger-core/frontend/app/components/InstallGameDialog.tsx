'use client';

import { useState } from 'react';
import FileExplorer from './FileExplorer';
import type { InstallGameRequest, InstallGameResponse } from '@dillinger/shared';

interface InstallGameDialogProps {
  gameId: string;
  platformId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function InstallGameDialog({ gameId, platformId, onClose, onSuccess }: InstallGameDialogProps) {
  const [installerPath, setInstallerPath] = useState('');
  const [installPath, setInstallPath] = useState('');
  const [showFileExplorer, setShowFileExplorer] = useState<'installer' | 'location' | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInstallerSelect = (path: string) => {
    setInstallerPath(path);
    setShowFileExplorer('location');
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
                <p className="text-sm text-muted mb-4">
                  Select the directory where the game should be installed.
                </p>
                <button
                  type="button"
                  onClick={() => setShowFileExplorer('location')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Browse for Installation Directory
                </button>
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
        />
      )}
    </>
  );
}
