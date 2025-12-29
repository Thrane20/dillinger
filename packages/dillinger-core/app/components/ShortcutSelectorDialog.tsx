'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon, DocumentIcon, MagnifyingGlassIcon, FolderIcon } from '@heroicons/react/24/outline';

export interface ShortcutInfo {
  path: string;
  target: string;
  arguments: string;
  workingDirectory: string;
  description: string;
}

interface ShortcutSelectorDialogProps {
  gameId: string;
  installPath: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectShortcut: (shortcut: ShortcutInfo) => void;
  onBrowseManually: () => void;
}

export default function ShortcutSelectorDialog({
  gameId,
  installPath,
  isOpen,
  onClose,
  onSelectShortcut,
  onBrowseManually,
}: ShortcutSelectorDialogProps) {
  const [shortcuts, setShortcuts] = useState<string[]>([]);
  const [shortcutInfo, setShortcutInfo] = useState<Map<string, ShortcutInfo>>(new Map());
  const [isScanning, setIsScanning] = useState(false);
  const [isParsing, setParsing] = useState<Set<string>>(new Set());

  // Display paths as-is since they are now direct host paths
  const formatInstalledPathForDisplay = (p: string) => p;

  useEffect(() => {
    if (isOpen && gameId) {
      scanForShortcuts();
    }
  }, [isOpen, gameId]);

  const scanForShortcuts = async () => {
    setIsScanning(true);
    try {
      const response = await fetch(`/api/games/${gameId}/shortcuts`);
      const data = await response.json();
      
      if (data.success) {
        setShortcuts(data.shortcuts || []);
      } else {
        console.error('Failed to scan shortcuts:', data.error);
      }
    } catch (error) {
      console.error('Error scanning shortcuts:', error);
    } finally {
      setIsScanning(false);
    }
  };

  const parseShortcut = async (shortcutPath: string) => {
    if (shortcutInfo.has(shortcutPath) || isParsing.has(shortcutPath)) return;

    setParsing(prev => new Set(prev).add(shortcutPath));

    try {
      const response = await fetch(`/api/games/${gameId}/shortcuts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shortcutPath: `${installPath}/${shortcutPath}` }),
      });
      
      const data = await response.json();
      
      if (data.success && data.shortcut) {
        setShortcutInfo(prev => new Map(prev).set(shortcutPath, {
          path: shortcutPath,
          ...data.shortcut,
        }));
      }
    } catch (error) {
      console.error('Error parsing shortcut:', error);
    } finally {
      setParsing(prev => {
        const next = new Set(prev);
        next.delete(shortcutPath);
        return next;
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-text">
            <MagnifyingGlassIcon className="inline w-5 h-5 mr-2" />
            Select Game Shortcut
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="mb-4">
            <p className="text-sm text-muted mb-2">
              Installation path: <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{formatInstalledPathForDisplay(installPath)}</span>
            </p>
          </div>

          {isScanning ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-muted">Scanning for shortcuts...</p>
            </div>
          ) : shortcuts.length === 0 ? (
            <div className="text-center py-8">
              <DocumentIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-muted mb-4">No shortcut files (.lnk) found in the installation directory.</p>
              <button
                type="button"
                onClick={onBrowseManually}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors mx-auto"
              >
                <FolderIcon className="w-4 h-4" />
                Browse Installation Directory
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-text">Found {shortcuts.length} shortcut file(s):</h4>
                <button
                  type="button"
                  onClick={onBrowseManually}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm"
                >
                  <FolderIcon className="w-4 h-4" />
                  Browse Manually
                </button>
              </div>

              {shortcuts.map((shortcut) => {
                const info = shortcutInfo.get(shortcut);
                const parsing = isParsing.has(shortcut);

                return (
                  <div
                    key={shortcut}
                    className="border border-gray-200 dark:border-gray-700 rounded-md p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <DocumentIcon className="w-4 h-4 text-blue-600" />
                          <span className="font-medium text-text">{shortcut}</span>
                        </div>

                        {parsing ? (
                          <div className="text-sm text-muted">
                            <div className="animate-pulse">Parsing shortcut...</div>
                          </div>
                        ) : info ? (
                          <div className="text-sm text-muted space-y-1">
                            {info.target && (
                              <div>
                                <span className="font-medium">Target:</span> {info.target}
                              </div>
                            )}
                            {info.workingDirectory && (
                              <div>
                                <span className="font-medium">Working Dir:</span> {info.workingDirectory}
                              </div>
                            )}
                            {info.arguments && (
                              <div>
                                <span className="font-medium">Arguments:</span> {info.arguments}
                              </div>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => parseShortcut(shortcut)}
                            className="text-sm text-blue-600 hover:text-blue-700"
                          >
                            Parse shortcut →
                          </button>
                        )}
                      </div>

                      {info && info.target && (
                        <button
                          type="button"
                          onClick={() => onSelectShortcut(info)}
                          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                        >
                          Use This
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}