'use client';

import { InformationCircleIcon } from '@heroicons/react/24/outline';

interface Screenshot {
  filename: string;
  path: string;
  size: number;
  modified: string;
  modifiedTimestamp: number;
}

interface SaveFile {
  filename: string;
  type: 'sram' | 'state';
  size: number;
  modified: string;
  modifiedTimestamp: number;
  slot?: number;
}

interface RetroMediaSectionProps<TFormData extends {
  metadata: {
    primaryImage?: string;
    backdropImage?: string;
  };
}> {
  mode: 'add' | 'edit';
  platformId: string;
  screenshots: Screenshot[];
  saveFiles: { sram: SaveFile[]; states: SaveFile[] };
  retroarchPlatforms: string[];
  setFormData: React.Dispatch<React.SetStateAction<TFormData>>;
  formatRelativeTime: (isoDate: string) => string;
  downloadSave: (filename: string, type: 'sram' | 'state') => void;
  deleteSave: (filename: string, type: 'sram' | 'state') => void;
}

export default function RetroMediaSection<TFormData extends {
  metadata: {
    primaryImage?: string;
    backdropImage?: string;
  };
}>({
  mode,
  platformId,
  screenshots,
  saveFiles,
  retroarchPlatforms,
  setFormData,
  formatRelativeTime,
  downloadSave,
  deleteSave,
}: RetroMediaSectionProps<TFormData>) {
  const showViceScreenshots = mode === 'edit' && ['c64', 'c128', 'vic20', 'plus4', 'pet'].includes(platformId) && screenshots.length > 0;
  const showRetroarchSaves = mode === 'edit' && retroarchPlatforms.includes(platformId);

  return (
    <>
      {showViceScreenshots && (
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
                  <div className="flex-shrink-0">
                    <img
                      src={screenshot.path}
                      alt={`Screenshot ${index + 1}`}
                      className="w-32 h-24 object-cover rounded border border-gray-300 dark:border-gray-600"
                    />
                  </div>

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

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          metadata: { ...prev.metadata, primaryImage: screenshot.path },
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
                          metadata: { ...prev.metadata, backdropImage: screenshot.path },
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

      {showRetroarchSaves && (
        <div className="space-y-4 mb-6 border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-lg font-semibold text-text border-b pb-2">💾 Saves & States</h3>

          {saveFiles.sram.length === 0 && saveFiles.states.length === 0 ? (
            <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center">
              <p className="text-muted">No save files found for this game.</p>
              <p className="text-sm text-gray-500 mt-2">
                Save files and save states will appear here after you play the game.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {saveFiles.states.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h4 className="font-medium text-text mb-3 flex items-center gap-2">
                    <span>📸</span> Save States ({saveFiles.states.length})
                  </h4>
                  <div className="space-y-2">
                    {saveFiles.states.map((save) => (
                      <div
                        key={save.filename}
                        className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-text truncate">
                              {save.slot !== undefined ? `Slot ${save.slot}` : save.filename}
                            </span>
                            <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                              {(save.size / 1024).toFixed(1)} KB
                            </span>
                          </div>
                          <p className="text-xs text-muted mt-1">
                            {formatRelativeTime(save.modified)} • {new Date(save.modified).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            type="button"
                            onClick={() => downloadSave(save.filename, 'state')}
                            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                          >
                            Download
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSave(save.filename, 'state')}
                            className="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {saveFiles.sram.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h4 className="font-medium text-text mb-3 flex items-center gap-2">
                    <span>🎮</span> In-Game Saves ({saveFiles.sram.length})
                  </h4>
                  <p className="text-xs text-gray-500 mb-3">
                    Battery/SRAM saves created by the game itself (memory card saves, etc.)
                  </p>
                  <div className="space-y-2">
                    {saveFiles.sram.map((save) => (
                      <div
                        key={save.filename}
                        className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-text truncate">
                              {save.filename}
                            </span>
                            <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                              {(save.size / 1024).toFixed(1)} KB
                            </span>
                          </div>
                          <p className="text-xs text-muted mt-1">
                            {formatRelativeTime(save.modified)} • {new Date(save.modified).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            type="button"
                            onClick={() => downloadSave(save.filename, 'sram')}
                            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                          >
                            Download
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteSave(save.filename, 'sram')}
                            className="px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
