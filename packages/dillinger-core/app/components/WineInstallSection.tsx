'use client';

import { MagnifyingGlassIcon, FolderIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import type { WineSectionSharedProps } from './wine-section-types';

interface WineInstallSectionProps<TFormData extends {
  settings?: {
    wine?: {
      version?: string;
    };
    launch?: {
      command?: string;
    };
  };
}> extends WineSectionSharedProps<TFormData> {
  mode: 'add' | 'edit';
  gameId?: string;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  selectedLutrisInstallerId?: number;
  formatInstalledPathForDisplay: (path: string) => string;
  onOpenWineMonitor: () => void;
  onOpenLogs: () => void;
  onCancelInstallation: () => void;
  onReinstall: () => void;
  onOpenShortcutSelector: () => void;
  onOpenFileExplorer: () => void;
}

export default function WineInstallSection<TFormData extends {
  settings?: {
    wine?: {
      version?: string;
    };
    launch?: {
      command?: string;
    };
  };
}>({
  mode,
  gameId,
  formData,
  handleChange,
  activeInstallation,
  selectedLutrisInstallerId,
  formatInstalledPathForDisplay,
  onOpenWineMonitor,
  onOpenLogs,
  onCancelInstallation,
  onReinstall,
  onOpenShortcutSelector,
  onOpenFileExplorer,
}: WineInstallSectionProps<TFormData>) {
  if (mode !== 'edit' || !gameId) {
    return null;
  }

  return (
    <>
      <div className="space-y-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-text">Wine Installation</div>
            <div className="text-xs text-gray-500">
              Pick an installer, run it in the Wine runner, then select what to launch.
            </div>
          </div>

          <Link
            href={`/games/${gameId}/install`}
            className="px-3 py-2 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-sm"
            title="Open the guided install wizard"
          >
            Open Install Wizard
          </Link>
        </div>

        {activeInstallation?.status === 'installing' && (
          <div className="space-y-3">
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-2xl animate-pulse">🍷</span>
                <div className="flex-1">
                  <div className="text-sm font-medium text-purple-900 dark:text-purple-100">
                    Wine Installation Running
                  </div>
                  <div className="text-xs text-purple-700 dark:text-purple-300 mt-0.5">
                    Complete the installer in the Wine desktop, then come back here.
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onOpenWineMonitor}
                className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors flex items-center gap-2"
                title="Open installation monitor with live logs"
              >
                <span>🧘</span>
                Open Monitor
              </button>
              <button
                type="button"
                onClick={onOpenLogs}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-text rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                title="View raw container logs"
              >
                View Logs
              </button>
              <button
                type="button"
                onClick={onCancelInstallation}
                className="px-3 py-1.5 text-sm border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="Stop the installation container and reset to not installed"
              >
                Cancel Installation
              </button>
            </div>
          </div>
        )}

        {activeInstallation?.status === 'failed' && (
          <div className="text-sm text-red-700 dark:text-red-300">
            Installation failed{activeInstallation?.error ? `: ${activeInstallation.error}` : '.'}
          </div>
        )}

        {activeInstallation?.status === 'installed' && activeInstallation?.installPath && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-green-700 dark:text-green-300">✓ Installed (read-only summary)</div>
              <button
                type="button"
                onClick={onReinstall}
                className="px-3 py-1.5 text-sm border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="Reset installation status and reopen install wizard"
              >
                Reinstall
              </button>
            </div>
            <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-xs text-gray-600 dark:text-gray-300 space-y-1">
              <div>
                Wine version: <span className="font-medium text-text">{formData.settings?.wine?.version || 'default'}</span>
              </div>
              {selectedLutrisInstallerId && (
                <div>
                  Lutris installer ID: <span className="font-medium text-text">{selectedLutrisInstallerId}</span>
                </div>
              )}
              <div>
                Install path: <span className="font-mono break-all text-text">{formatInstalledPathForDisplay(activeInstallation.installPath)}</span>
              </div>
            </div>
            {typeof activeInstallation.installerArgs === 'string' && activeInstallation.installerArgs.trim() !== '' && (
              <div className="text-xs text-gray-500">
                Installer args: <span className="font-mono break-all">{activeInstallation.installerArgs}</span>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onOpenShortcutSelector}
                className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                title="Search for Windows shortcuts (.lnk)"
              >
                <MagnifyingGlassIcon className="w-4 h-4" />
                Find Shortcuts
              </button>
              <button
                type="button"
                onClick={onOpenFileExplorer}
                className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                title="Browse installation directory to pick an executable"
              >
                <FolderIcon className="w-4 h-4" />
                Browse Install Folder
              </button>
            </div>
          </div>
        )}
      </div>

      {activeInstallation?.status === 'installed' && (
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
            {activeInstallation.installPath && (
              <>
                <button
                  type="button"
                  onClick={onOpenShortcutSelector}
                  className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center gap-1"
                  title="Search for shortcut files"
                >
                  <MagnifyingGlassIcon className="w-4 h-4" />
                  Shortcuts
                </button>
                <button
                  type="button"
                  onClick={onOpenFileExplorer}
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
      )}
    </>
  );
}
