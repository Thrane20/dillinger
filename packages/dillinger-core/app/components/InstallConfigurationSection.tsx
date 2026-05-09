'use client';

import { FolderIcon } from '@heroicons/react/24/outline';
import type { RetroarchMameAspect } from '@dillinger/shared';
import WineInstallSection from './WineInstallSection';

interface InstallConfigurationSectionProps<TFormData extends {
  platformId: string;
  filePath?: string;
  settings?: {
    wine?: {
      version?: string;
    };
    launch?: {
      command?: string;
    };
    emulator?: {
      settings?: {
        mame?: {
          aspect?: RetroarchMameAspect;
          integerScale?: boolean;
          borderlessFullscreen?: boolean;
        };
      };
    };
  };
}> {
  mode: 'add' | 'edit';
  gameId?: string;
  formData: TFormData;
  setFormData: React.Dispatch<React.SetStateAction<TFormData>>;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  sectionRef: (el: HTMLDivElement | null) => void;
  romPlatforms: string[];
  mameAspectValue: RetroarchMameAspect | 'default';
  mameIntegerScaleSelect: 'default' | 'true' | 'false';
  mameBorderlessSelect: 'default' | 'true' | 'false';
  updateMameOverrides: (updates: { aspect?: RetroarchMameAspect; integerScale?: boolean; borderlessFullscreen?: boolean }) => void;
  onOpenRomExplorer: () => void;
  activeInstallation?: {
    status?: string;
    installPath?: string;
    error?: string;
    installerArgs?: string;
  };
  selectedLutrisInstallerId?: number;
  formatInstalledPathForDisplay: (path: string) => string;
  onOpenWineMonitor: () => void;
  onOpenLogs: () => void;
  onCancelInstallation: () => void;
  onReinstall: () => void;
  onOpenShortcutSelector: () => void;
  onOpenFileExplorer: () => void;
}

export default function InstallConfigurationSection<TFormData extends {
  platformId: string;
  filePath?: string;
  settings?: {
    wine?: {
      version?: string;
    };
    launch?: {
      command?: string;
    };
    emulator?: {
      settings?: {
        mame?: {
          aspect?: RetroarchMameAspect;
          integerScale?: boolean;
          borderlessFullscreen?: boolean;
        };
      };
    };
  };
}>({
  mode,
  gameId,
  formData,
  setFormData,
  handleChange,
  sectionRef,
  romPlatforms,
  mameAspectValue,
  mameIntegerScaleSelect,
  mameBorderlessSelect,
  updateMameOverrides,
  onOpenRomExplorer,
  activeInstallation,
  selectedLutrisInstallerId,
  formatInstalledPathForDisplay,
  onOpenWineMonitor,
  onOpenLogs,
  onCancelInstallation,
  onReinstall,
  onOpenShortcutSelector,
  onOpenFileExplorer,
}: InstallConfigurationSectionProps<TFormData>) {
  if (mode !== 'edit') {
    return null;
  }

  return (
    <div
      id="install"
      ref={sectionRef}
      className="space-y-4 mb-6 border-t border-gray-200 dark:border-gray-700 pt-6"
    >
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold text-text border-b pb-2">Install Configuration</h3>
        {formData.platformId === 'windows-wine' && activeInstallation?.status !== 'installed' && (
          <span className="text-xs text-purple-500 dark:text-purple-400">
            — available when you install
          </span>
        )}
      </div>
      <div className="space-y-4">
        {romPlatforms.includes(formData.platformId) && (
          <div>
            <label htmlFor="filePath" className="block text-sm font-medium text-muted mb-2">
              ROM File
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                id="filePath"
                name="filePath"
                value={formData.filePath || ''}
                onChange={handleChange}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
                placeholder="Select a ROM file"
              />
              <button
                type="button"
                onClick={onOpenRomExplorer}
                className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1"
              >
                <FolderIcon className="w-4 h-4" />
                Select ROM
              </button>
            </div>
            {formData.filePath && (
              <p className="text-xs text-muted mt-2 break-all">
                Selected: {formData.filePath}
              </p>
            )}
          </div>
        )}

        {formData.platformId === 'mame' && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900 space-y-4">
            <div>
              <div className="text-sm font-semibold text-text">MAME Display Overrides</div>
              <div className="text-xs text-muted">
                Leave as Use Global to follow the RetroArch defaults in Settings.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="mameAspectOverride" className="block text-sm font-medium text-muted mb-2">
                  Aspect Ratio
                </label>
                <select
                  id="mameAspectOverride"
                  value={mameAspectValue}
                  onChange={(e) => {
                    const value = e.target.value as RetroarchMameAspect | 'default';
                    updateMameOverrides({ aspect: value === 'default' ? undefined : value });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
                >
                  <option value="default">Use Global</option>
                  <option value="4:3">4:3</option>
                  <option value="3:4">3:4 (Vertical)</option>
                  <option value="2:3">2:3 (Taller Vertical)</option>
                  <option value="5:8">5:8 (Extra Tall Vertical)</option>
                  <option value="1:1">1:1 (Square)</option>
                  <option value="16:15">16:15</option>
                  <option value="8:7">8:7</option>
                  <option value="16:9">16:9</option>
                  <option value="auto">Auto</option>
                </select>
              </div>

              <div>
                <label htmlFor="mameIntegerScaleOverride" className="block text-sm font-medium text-muted mb-2">
                  Integer Scale
                </label>
                <select
                  id="mameIntegerScaleOverride"
                  value={mameIntegerScaleSelect}
                  onChange={(e) => {
                    const value = e.target.value as 'default' | 'true' | 'false';
                    updateMameOverrides({
                      integerScale: value === 'default' ? undefined : value === 'true',
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
                >
                  <option value="default">Use Global</option>
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
              </div>

              <div>
                <label htmlFor="mameBorderlessOverride" className="block text-sm font-medium text-muted mb-2">
                  Borderless Fullscreen
                </label>
                <select
                  id="mameBorderlessOverride"
                  value={mameBorderlessSelect}
                  onChange={(e) => {
                    const value = e.target.value as 'default' | 'true' | 'false';
                    updateMameOverrides({
                      borderlessFullscreen: value === 'default' ? undefined : value === 'true',
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
                >
                  <option value="default">Use Global</option>
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {formData.platformId === 'windows-wine' && (
          <WineInstallSection
            mode={mode}
            gameId={gameId}
            formData={formData}
            setFormData={setFormData}
            handleChange={handleChange}
            activeInstallation={activeInstallation}
            selectedLutrisInstallerId={selectedLutrisInstallerId}
            formatInstalledPathForDisplay={formatInstalledPathForDisplay}
            onOpenWineMonitor={onOpenWineMonitor}
            onOpenLogs={onOpenLogs}
            onCancelInstallation={onCancelInstallation}
            onReinstall={onReinstall}
            onOpenShortcutSelector={onOpenShortcutSelector}
            onOpenFileExplorer={onOpenFileExplorer}
          />
        )}
      </div>
    </div>
  );
}
