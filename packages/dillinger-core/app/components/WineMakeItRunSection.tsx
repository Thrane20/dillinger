'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import type { WineSectionSharedProps } from './wine-section-types';

const MAKEITRUN_UNLOCKED_PHASES = new Set(['post_install', 'needs_configuration', 'ready', 'running']);

interface MakeItRunCompatibilitySummary {
  suggestedUmuGameId?: string;
  winetricks: string[];
  hasComplexFixes: boolean;
  complexFixNotes?: string;
  protonfixScriptUrl?: string;
}

interface WineMakeItRunSectionProps<TFormData extends {
  settings?: {
    wine?: {
      umuGameId?: string;
      dllOverrides?: string;
      winetricks?: string[];
      registrySettings?: Array<{
        path: string;
        name: string;
        type: 'REG_SZ' | 'REG_DWORD' | 'REG_BINARY' | 'REG_MULTI_SZ' | 'REG_EXPAND_SZ';
        value: string;
      }>;
    };
    launch?: {
      environment?: Record<string, string>;
    };
  };
}> extends WineSectionSharedProps<TFormData> {
  gameId?: string;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  selectedLutrisInstallerId?: number;
  makeItRunCompatLoading: boolean;
  makeItRunCompatSummary: MakeItRunCompatibilitySummary | null;
  makeItRunIoLoading: boolean;
  winetricksVerbQuery: string;
  setWinetricksVerbQuery: React.Dispatch<React.SetStateAction<string>>;
  filteredWinetricksVerbs: string[];
  commonWinetricksVerbs: string[];
  applyDllQuickAdd: (dllName: string, mode: string) => void;
  onAutoDetect: () => void;
  onExportToml: () => void;
  onImportFileSelected: (file: File) => void;
  onRunRegistrySetup: () => Promise<void>;
  onApplyRegistrySettings: () => Promise<void>;
  sectionRef: (el: HTMLDivElement | null) => void;
}

export default function WineMakeItRunSection<TFormData extends {
  settings?: {
    wine?: {
      umuGameId?: string;
      dllOverrides?: string;
      winetricks?: string[];
      registrySettings?: Array<{
        path: string;
        name: string;
        type: 'REG_SZ' | 'REG_DWORD' | 'REG_BINARY' | 'REG_MULTI_SZ' | 'REG_EXPAND_SZ';
        value: string;
      }>;
    };
    launch?: {
      environment?: Record<string, string>;
    };
  };
}>({
  gameId,
  formData,
  setFormData,
  handleChange,
  selectedLutrisInstallerId,
  makeItRunCompatLoading,
  makeItRunCompatSummary,
  makeItRunIoLoading,
  winetricksVerbQuery,
  setWinetricksVerbQuery,
  filteredWinetricksVerbs,
  commonWinetricksVerbs,
  applyDllQuickAdd,
  onAutoDetect,
  onExportToml,
  onImportFileSelected,
  onRunRegistrySetup,
  onApplyRegistrySettings,
  phase,
  sectionRef,
}: WineMakeItRunSectionProps<TFormData>) {
  const importRef = useRef<HTMLInputElement | null>(null);
  const [registrySetupRunning, setRegistrySetupRunning] = useState(false);
  const [registrySetupError, setRegistrySetupError] = useState<string | null>(null);
  const [registrySetupSuccess, setRegistrySetupSuccess] = useState<string | null>(null);
  const [registryApplyRunning, setRegistryApplyRunning] = useState(false);
  const [registryApplyError, setRegistryApplyError] = useState<string | null>(null);
  const [registryApplySuccess, setRegistryApplySuccess] = useState<string | null>(null);
  const isLocked = phase ? !MAKEITRUN_UNLOCKED_PHASES.has(phase) : false;

  return (
    <div
      id="makeitrun-config"
      ref={sectionRef}
      className="space-y-4 mb-6 border-t border-gray-200 dark:border-gray-700 pt-6"
    >
      <h3 className="text-lg font-semibold text-text border-b pb-2">MakeItRun Configuration</h3>
      <p className="text-sm text-gray-500">
        Configure protonfixes/UMU, Lutris-derived tweaks, winetricks, DLL overrides, environment variables, and registry rules.
      </p>

      {isLocked ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-200">
          Install the game first to access MakeItRun configuration.
        </div>
      ) : (
      <>

      <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/20 p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="settings.wine.umuGameId" className="text-sm font-medium text-muted">
            UMU Game ID
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onAutoDetect}
              disabled={makeItRunCompatLoading || !gameId}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {makeItRunCompatLoading ? 'Detecting…' : 'Auto-detect'}
            </button>
            <a
              href="https://github.com/Open-Wine-Components/umu-protonfixes"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline"
            >
              protonfixes docs →
            </a>
          </div>
        </div>

        <input
          type="text"
          id="settings.wine.umuGameId"
          name="settings.wine.umuGameId"
          value={formData.settings?.wine?.umuGameId || ''}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
          placeholder="umu-game-id"
        />

        {makeItRunCompatSummary && (
          <div className="rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3 text-xs text-green-800 dark:text-green-200 space-y-1">
            <div>
              Suggested UMU ID: <span className="font-medium">{makeItRunCompatSummary.suggestedUmuGameId || 'n/a'}</span>
            </div>
            <div>
              Suggested winetricks: <span className="font-medium">{makeItRunCompatSummary.winetricks.length}</span>
            </div>
            {makeItRunCompatSummary.hasComplexFixes && (
              <div className="rounded border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-2 text-amber-800 dark:text-amber-200">
                Complex protonfix logic detected. {makeItRunCompatSummary.complexFixNotes || 'Review script details before applying all tweaks.'}
              </div>
            )}
            {makeItRunCompatSummary.protonfixScriptUrl && (
              <a
                href={makeItRunCompatSummary.protonfixScriptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 dark:text-blue-300 underline"
              >
                View matched protonfix script
              </a>
            )}
          </div>
        )}
      </div>

      <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-xs text-gray-600 dark:text-gray-300 space-y-1">
        <div className="font-medium text-text">Lutris Configuration</div>
        <div>
          Applied installer ID: <span className="font-medium text-text">{selectedLutrisInstallerId || 'none'}</span>
        </div>
        <div>
          Uses installer-derived tweaks captured at install-time; rerun compatibility to refresh recommended settings.
        </div>
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onAutoDetect}
            disabled={makeItRunCompatLoading || !gameId}
            className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            Re-apply Lutris/Compatibility
          </button>
          {gameId && (
            <Link
              href={`/games/${gameId}/install`}
              className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Change Lutris Installer
            </Link>
          )}
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="settings.wine.dllOverrides" className="block text-sm font-medium text-muted mb-2">
          DLL Overrides (WINEDLLOVERRIDES)
        </label>
        <input
          type="text"
          id="settings.wine.dllOverrides"
          name="settings.wine.dllOverrides"
          value={formData.settings?.wine?.dllOverrides || ''}
          onChange={(e) => {
            setFormData((prev) => ({
              ...prev,
              settings: {
                ...prev.settings,
                wine: {
                  ...prev.settings?.wine,
                  dllOverrides: e.target.value,
                },
              },
            }));
          }}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
          placeholder="e.g., quartz=disabled;wmvcore=disabled"
        />
        <p className="text-xs text-gray-500 mt-1">
          Semicolon-separated DLL overrides. Common modes: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">disabled</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">native</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">builtin</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">native,builtin</code>
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {[
            ['ddraw', 'native,builtin'],
            ['d3d9', 'native,builtin'],
            ['quartz', 'disabled'],
            ['wmvcore', 'disabled'],
          ].map(([dll, mode]) => (
            <button
              key={`${dll}-${mode}`}
              type="button"
              onClick={() => applyDllQuickAdd(dll, mode)}
              className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              + {dll}={mode}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-muted mb-2">
          Winetricks Components
        </label>
        <div className="mb-2 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <input
              type="text"
              list="winetricks-verb-suggestions"
              value={winetricksVerbQuery}
              onChange={(e) => setWinetricksVerbQuery(e.target.value)}
              className="md:col-span-3 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
              placeholder="Search winetricks verb (e.g., vcrun2019, d3dx9, dotnet48)"
            />
            <button
              type="button"
              onClick={() => {
                const nextVerb = winetricksVerbQuery.trim();
                if (!nextVerb) return;
                const current = formData.settings?.wine?.winetricks || [];
                if (current.includes(nextVerb)) return;
                setFormData((prev) => ({
                  ...prev,
                  settings: {
                    ...prev.settings,
                    wine: {
                      ...prev.settings?.wine,
                      winetricks: [...current, nextVerb],
                    },
                  },
                }));
                setWinetricksVerbQuery('');
              }}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              Add Verb
            </button>
          </div>
          <datalist id="winetricks-verb-suggestions">
            {commonWinetricksVerbs.map((verb) => (
              <option key={verb} value={verb} />
            ))}
          </datalist>
          {filteredWinetricksVerbs.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {filteredWinetricksVerbs.map((verb) => (
                <button
                  key={verb}
                  type="button"
                  onClick={() => {
                    const current = formData.settings?.wine?.winetricks || [];
                    if (current.includes(verb)) return;
                    setFormData((prev) => ({
                      ...prev,
                      settings: {
                        ...prev.settings,
                        wine: {
                          ...prev.settings?.wine,
                          winetricks: [...current, verb],
                        },
                      },
                    }));
                    setWinetricksVerbQuery('');
                  }}
                  className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  + {verb}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-2">
          {(formData.settings?.wine?.winetricks || []).map((verb, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={verb}
                onChange={(e) => {
                  const newWinetricks = [...(formData.settings?.wine?.winetricks || [])];
                  newWinetricks[index] = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    settings: {
                      ...prev.settings,
                      wine: {
                        ...prev.settings?.wine,
                        winetricks: newWinetricks,
                      },
                    },
                  }));
                }}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
                placeholder="e.g., vcrun2019, dxvk, d3dx9"
              />
              <button
                type="button"
                onClick={() => {
                  const newWinetricks = (formData.settings?.wine?.winetricks || []).filter((_, i) => i !== index);
                  setFormData((prev) => ({
                    ...prev,
                    settings: {
                      ...prev.settings,
                      wine: {
                        ...prev.settings?.wine,
                        winetricks: newWinetricks,
                      },
                    },
                  }));
                }}
                className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              setFormData((prev) => ({
                ...prev,
                settings: {
                  ...prev.settings,
                  wine: {
                    ...prev.settings?.wine,
                    winetricks: [...(prev.settings?.wine?.winetricks || []), ''],
                  },
                },
              }));
            }}
            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            + Add Winetricks Verb
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Install Windows components before launching. Common: vcrun2019, dxvk, d3dx9, physx, dotnet48
        </p>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-muted mb-2">
          Environment Variables
        </label>
        <div className="space-y-2">
          {Object.entries(formData.settings?.launch?.environment || {}).map(([key, envValue]) => (
            <div key={key} className="grid grid-cols-1 md:grid-cols-5 gap-2">
              <input
                type="text"
                value={key}
                onChange={(e) => {
                  const oldEnv = formData.settings?.launch?.environment || {};
                  const nextEnv: Record<string, string> = {};
                  Object.entries(oldEnv).forEach(([k, v]) => {
                    if (k === key) {
                      nextEnv[e.target.value] = v;
                    } else {
                      nextEnv[k] = v;
                    }
                  });
                  setFormData((prev) => ({
                    ...prev,
                    settings: {
                      ...prev.settings,
                      launch: {
                        ...prev.settings?.launch,
                        environment: nextEnv,
                      },
                    },
                  }));
                }}
                className="md:col-span-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-text text-sm"
                placeholder="KEY"
              />
              <input
                type="text"
                value={envValue}
                onChange={(e) => {
                  const oldEnv = formData.settings?.launch?.environment || {};
                  const nextEnv: Record<string, string> = { ...oldEnv, [key]: e.target.value };
                  setFormData((prev) => ({
                    ...prev,
                    settings: {
                      ...prev.settings,
                      launch: {
                        ...prev.settings?.launch,
                        environment: nextEnv,
                      },
                    },
                  }));
                }}
                className="md:col-span-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-text text-sm"
                placeholder="value"
              />
              <button
                type="button"
                onClick={() => {
                  const oldEnv = formData.settings?.launch?.environment || {};
                  const nextEnv: Record<string, string> = {};
                  Object.entries(oldEnv).forEach(([k, v]) => {
                    if (k !== key) nextEnv[k] = v;
                  });
                  setFormData((prev) => ({
                    ...prev,
                    settings: {
                      ...prev.settings,
                      launch: {
                        ...prev.settings?.launch,
                        environment: nextEnv,
                      },
                    },
                  }));
                }}
                className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              const oldEnv = formData.settings?.launch?.environment || {};
              let newKey = 'KEY';
              let index = 1;
              while (Object.prototype.hasOwnProperty.call(oldEnv, newKey)) {
                newKey = `KEY_${index}`;
                index += 1;
              }
              setFormData((prev) => ({
                ...prev,
                settings: {
                  ...prev.settings,
                  launch: {
                    ...prev.settings?.launch,
                    environment: {
                      ...oldEnv,
                      [newKey]: '',
                    },
                  },
                },
              }));
            }}
            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            + Add Environment Variable
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Extra environment variables are passed through launch settings at runtime.
        </p>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-muted mb-2">
          Windows Registry Settings
        </label>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              setRegistryApplyRunning(true);
              setRegistryApplyError(null);
              setRegistryApplySuccess(null);
              try {
                await onApplyRegistrySettings();
                setRegistryApplySuccess('Configured registry settings applied successfully.');
              } catch (error) {
                setRegistryApplyError(error instanceof Error ? error.message : 'Failed to apply configured registry settings.');
              } finally {
                setRegistryApplyRunning(false);
              }
            }}
            disabled={registryApplyRunning || !gameId}
            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm disabled:opacity-50"
          >
            {registryApplyRunning ? 'Applying Settings…' : 'Execute Registry Settings'}
          </button>
          <button
            type="button"
            onClick={async () => {
              setRegistrySetupRunning(true);
              setRegistrySetupError(null);
              setRegistrySetupSuccess(null);
              try {
                await onRunRegistrySetup();
                setRegistrySetupSuccess('Wine registry setup completed successfully.');
              } catch (error) {
                setRegistrySetupError(error instanceof Error ? error.message : 'Failed to run Wine registry setup.');
              } finally {
                setRegistrySetupRunning(false);
              }
            }}
            disabled={registrySetupRunning || !gameId}
            className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm disabled:opacity-50"
          >
            {registrySetupRunning ? 'Running Regedit…' : 'Run Regedit Setup'}
          </button>
          <span className="text-xs text-gray-500">
            Opens Wine regedit for this game&apos;s Wine prefix.
          </span>
        </div>
        {registryApplySuccess && (
          <div className="mb-3 rounded-md border border-green-200 bg-green-50 p-2 text-xs text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">
            {registryApplySuccess}
          </div>
        )}
        {registryApplyError && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            {registryApplyError}
          </div>
        )}
        {registrySetupSuccess && (
          <div className="mb-3 rounded-md border border-green-200 bg-green-50 p-2 text-xs text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">
            {registrySetupSuccess}
          </div>
        )}
        {registrySetupError && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            {registrySetupError}
          </div>
        )}
        <div className="space-y-2">
          {(formData.settings?.wine?.registrySettings || []).map((reg, index) => (
            <div key={index} className="p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                <input
                  type="text"
                  value={reg.path}
                  onChange={(e) => {
                    const newSettings = [...(formData.settings?.wine?.registrySettings || [])];
                    newSettings[index] = { ...newSettings[index], path: e.target.value };
                    setFormData((prev) => ({
                      ...prev,
                      settings: {
                        ...prev.settings,
                        wine: {
                          ...prev.settings?.wine,
                          registrySettings: newSettings,
                        },
                      },
                    }));
                  }}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text text-sm"
                  placeholder="HKCU\Software\MyGame"
                />
                <input
                  type="text"
                  value={reg.name}
                  onChange={(e) => {
                    const newSettings = [...(formData.settings?.wine?.registrySettings || [])];
                    newSettings[index] = { ...newSettings[index], name: e.target.value };
                    setFormData((prev) => ({
                      ...prev,
                      settings: {
                        ...prev.settings,
                        wine: {
                          ...prev.settings?.wine,
                          registrySettings: newSettings,
                        },
                      },
                    }));
                  }}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text text-sm"
                  placeholder="ValueName"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <select
                  value={reg.type}
                  onChange={(e) => {
                    const newSettings = [...(formData.settings?.wine?.registrySettings || [])];
                    newSettings[index] = {
                      ...newSettings[index],
                      type: e.target.value as 'REG_SZ' | 'REG_DWORD' | 'REG_BINARY' | 'REG_MULTI_SZ' | 'REG_EXPAND_SZ',
                    };
                    setFormData((prev) => ({
                      ...prev,
                      settings: {
                        ...prev.settings,
                        wine: {
                          ...prev.settings?.wine,
                          registrySettings: newSettings,
                        },
                      },
                    }));
                  }}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text text-sm"
                >
                  <option value="REG_SZ">REG_SZ (String)</option>
                  <option value="REG_DWORD">REG_DWORD (Integer)</option>
                  <option value="REG_BINARY">REG_BINARY</option>
                  <option value="REG_MULTI_SZ">REG_MULTI_SZ</option>
                  <option value="REG_EXPAND_SZ">REG_EXPAND_SZ</option>
                </select>
                <input
                  type="text"
                  value={reg.value}
                  onChange={(e) => {
                    const newSettings = [...(formData.settings?.wine?.registrySettings || [])];
                    newSettings[index] = { ...newSettings[index], value: e.target.value };
                    setFormData((prev) => ({
                      ...prev,
                      settings: {
                        ...prev.settings,
                        wine: {
                          ...prev.settings?.wine,
                          registrySettings: newSettings,
                        },
                      },
                    }));
                  }}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text text-sm"
                  placeholder="Value (e.g., 0x1 for DWORD)"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newSettings = (formData.settings?.wine?.registrySettings || []).filter((_, i) => i !== index);
                    setFormData((prev) => ({
                      ...prev,
                      settings: {
                        ...prev.settings,
                        wine: {
                          ...prev.settings?.wine,
                          registrySettings: newSettings,
                        },
                      },
                    }));
                  }}
                  className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              setFormData((prev) => ({
                ...prev,
                settings: {
                  ...prev.settings,
                  wine: {
                    ...prev.settings?.wine,
                    registrySettings: [
                      ...(prev.settings?.wine?.registrySettings || []),
                      { path: '', name: '', type: 'REG_DWORD' as const, value: '' },
                    ],
                  },
                },
              }));
            }}
            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            + Add Registry Setting
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Set Windows registry values before launching. Useful for game-specific settings like disabling intro videos.
        </p>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
        <div className="text-sm font-medium text-muted">Export / Import MakeItRun Config</div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onExportToml}
            disabled={makeItRunIoLoading || !gameId}
            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm disabled:opacity-50"
          >
            {makeItRunIoLoading ? 'Working…' : 'Export as TOML'}
          </button>
          <button
            type="button"
            onClick={() => importRef.current?.click()}
            disabled={makeItRunIoLoading || !gameId}
            className="px-3 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800 text-sm disabled:opacity-50"
          >
            Import TOML
          </button>
          <button
            type="button"
            disabled
            title="Coming soon — share on DillingerGaming"
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-500 rounded-md text-sm cursor-not-allowed"
          >
            Share
          </button>
        </div>
        <input
          ref={importRef}
          type="file"
          accept=".toml,text/plain"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              onImportFileSelected(file);
            }
          }}
        />
      </div>
      </>
      )}
    </div>
  );
}
