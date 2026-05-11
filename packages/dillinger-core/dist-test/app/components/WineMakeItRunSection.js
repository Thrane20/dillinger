'use client';
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = WineMakeItRunSection;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const link_1 = __importDefault(require("next/link"));
const MAKEITRUN_UNLOCKED_PHASES = new Set(['post_install', 'needs_configuration', 'ready', 'running']);
function WineMakeItRunSection({ gameId, formData, setFormData, handleChange, selectedLutrisInstallerId, makeItRunCompatLoading, makeItRunCompatSummary, makeItRunIoLoading, winetricksVerbQuery, setWinetricksVerbQuery, filteredWinetricksVerbs, commonWinetricksVerbs, applyDllQuickAdd, onAutoDetect, onExportToml, onImportFileSelected, onRunRegistrySetup, onApplyRegistrySettings, phase, sectionRef, }) {
    const importRef = (0, react_1.useRef)(null);
    const [registrySetupRunning, setRegistrySetupRunning] = (0, react_1.useState)(false);
    const [registrySetupError, setRegistrySetupError] = (0, react_1.useState)(null);
    const [registrySetupSuccess, setRegistrySetupSuccess] = (0, react_1.useState)(null);
    const [registryApplyRunning, setRegistryApplyRunning] = (0, react_1.useState)(false);
    const [registryApplyError, setRegistryApplyError] = (0, react_1.useState)(null);
    const [registryApplySuccess, setRegistryApplySuccess] = (0, react_1.useState)(null);
    const isLocked = phase ? !MAKEITRUN_UNLOCKED_PHASES.has(phase) : false;
    return ((0, jsx_runtime_1.jsxs)("div", { id: "makeitrun-config", ref: sectionRef, className: "space-y-4 mb-6 border-t border-gray-200 dark:border-gray-700 pt-6", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-text border-b pb-2", children: "MakeItRun Configuration" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-gray-500", children: "Configure protonfixes/UMU, Lutris-derived tweaks, winetricks, DLL overrides, environment variables, and registry rules." }), isLocked ? ((0, jsx_runtime_1.jsx)("div", { className: "rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-200", children: "Install the game first to access MakeItRun configuration." })) : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("div", { className: "rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/20 p-3 space-y-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "settings.wine.umuGameId", className: "text-sm font-medium text-muted", children: "UMU Game ID" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: onAutoDetect, disabled: makeItRunCompatLoading || !gameId, className: "px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50", children: makeItRunCompatLoading ? 'Detecting…' : 'Auto-detect' }), (0, jsx_runtime_1.jsx)("a", { href: "https://github.com/Open-Wine-Components/umu-protonfixes", target: "_blank", rel: "noopener noreferrer", className: "text-xs text-blue-600 hover:underline", children: "protonfixes docs \u2192" })] })] }), (0, jsx_runtime_1.jsx)("input", { type: "text", id: "settings.wine.umuGameId", name: "settings.wine.umuGameId", value: formData.settings?.wine?.umuGameId || '', onChange: handleChange, className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text", placeholder: "umu-game-id" }), makeItRunCompatSummary && ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-3 text-xs text-green-800 dark:text-green-200 space-y-1", children: [(0, jsx_runtime_1.jsxs)("div", { children: ["Suggested UMU ID: ", (0, jsx_runtime_1.jsx)("span", { className: "font-medium", children: makeItRunCompatSummary.suggestedUmuGameId || 'n/a' })] }), (0, jsx_runtime_1.jsxs)("div", { children: ["Suggested winetricks: ", (0, jsx_runtime_1.jsx)("span", { className: "font-medium", children: makeItRunCompatSummary.winetricks.length })] }), makeItRunCompatSummary.hasComplexFixes && ((0, jsx_runtime_1.jsxs)("div", { className: "rounded border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-2 text-amber-800 dark:text-amber-200", children: ["Complex protonfix logic detected. ", makeItRunCompatSummary.complexFixNotes || 'Review script details before applying all tweaks.'] })), makeItRunCompatSummary.protonfixScriptUrl && ((0, jsx_runtime_1.jsx)("a", { href: makeItRunCompatSummary.protonfixScriptUrl, target: "_blank", rel: "noopener noreferrer", className: "text-blue-700 dark:text-blue-300 underline", children: "View matched protonfix script" }))] }))] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-xs text-gray-600 dark:text-gray-300 space-y-1", children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium text-text", children: "Lutris Configuration" }), (0, jsx_runtime_1.jsxs)("div", { children: ["Applied installer ID: ", (0, jsx_runtime_1.jsx)("span", { className: "font-medium text-text", children: selectedLutrisInstallerId || 'none' })] }), (0, jsx_runtime_1.jsx)("div", { children: "Uses installer-derived tweaks captured at install-time; rerun compatibility to refresh recommended settings." }), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-2 pt-1", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: onAutoDetect, disabled: makeItRunCompatLoading || !gameId, className: "px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50", children: "Re-apply Lutris/Compatibility" }), gameId && ((0, jsx_runtime_1.jsx)(link_1.default, { href: `/games/${gameId}/install`, className: "px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700", children: "Change Lutris Installer" }))] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mb-4", children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "settings.wine.dllOverrides", className: "block text-sm font-medium text-muted mb-2", children: "DLL Overrides (WINEDLLOVERRIDES)" }), (0, jsx_runtime_1.jsx)("input", { type: "text", id: "settings.wine.dllOverrides", name: "settings.wine.dllOverrides", value: formData.settings?.wine?.dllOverrides || '', onChange: (e) => {
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
                                }, className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text", placeholder: "e.g., quartz=disabled;wmvcore=disabled" }), (0, jsx_runtime_1.jsxs)("p", { className: "text-xs text-gray-500 mt-1", children: ["Semicolon-separated DLL overrides. Common modes: ", (0, jsx_runtime_1.jsx)("code", { className: "bg-gray-100 dark:bg-gray-800 px-1 rounded", children: "disabled" }), ", ", (0, jsx_runtime_1.jsx)("code", { className: "bg-gray-100 dark:bg-gray-800 px-1 rounded", children: "native" }), ", ", (0, jsx_runtime_1.jsx)("code", { className: "bg-gray-100 dark:bg-gray-800 px-1 rounded", children: "builtin" }), ", ", (0, jsx_runtime_1.jsx)("code", { className: "bg-gray-100 dark:bg-gray-800 px-1 rounded", children: "native,builtin" })] }), (0, jsx_runtime_1.jsx)("div", { className: "mt-2 flex flex-wrap gap-2", children: [
                                    ['ddraw', 'native,builtin'],
                                    ['d3d9', 'native,builtin'],
                                    ['quartz', 'disabled'],
                                    ['wmvcore', 'disabled'],
                                ].map(([dll, mode]) => ((0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => applyDllQuickAdd(dll, mode), className: "px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700", children: ["+ ", dll, "=", mode] }, `${dll}-${mode}`))) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mb-4", children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-muted mb-2", children: "Winetricks Components" }), (0, jsx_runtime_1.jsxs)("div", { className: "mb-2 space-y-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "text", list: "winetricks-verb-suggestions", value: winetricksVerbQuery, onChange: (e) => setWinetricksVerbQuery(e.target.value), className: "md:col-span-3 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text", placeholder: "Search winetricks verb (e.g., vcrun2019, d3dx9, dotnet48)" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => {
                                                    const nextVerb = winetricksVerbQuery.trim();
                                                    if (!nextVerb)
                                                        return;
                                                    const current = formData.settings?.wine?.winetricks || [];
                                                    if (current.includes(nextVerb))
                                                        return;
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
                                                }, className: "px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm", children: "Add Verb" })] }), (0, jsx_runtime_1.jsx)("datalist", { id: "winetricks-verb-suggestions", children: commonWinetricksVerbs.map((verb) => ((0, jsx_runtime_1.jsx)("option", { value: verb }, verb))) }), filteredWinetricksVerbs.length > 0 && ((0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap gap-2", children: filteredWinetricksVerbs.map((verb) => ((0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => {
                                                const current = formData.settings?.wine?.winetricks || [];
                                                if (current.includes(verb))
                                                    return;
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
                                            }, className: "px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700", children: ["+ ", verb] }, verb))) }))] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(formData.settings?.wine?.winetricks || []).map((verb, index) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "text", value: verb, onChange: (e) => {
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
                                                }, className: "flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text", placeholder: "e.g., vcrun2019, dxvk, d3dx9" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => {
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
                                                }, className: "px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700", children: "Remove" })] }, index))), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => {
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
                                        }, className: "px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm", children: "+ Add Winetricks Verb" })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-gray-500 mt-1", children: "Install Windows components before launching. Common: vcrun2019, dxvk, d3dx9, physx, dotnet48" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mb-4", children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-muted mb-2", children: "Environment Variables" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [Object.entries(formData.settings?.launch?.environment || {}).map(([key, envValue]) => ((0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-5 gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "text", value: key, onChange: (e) => {
                                                    const oldEnv = formData.settings?.launch?.environment || {};
                                                    const nextEnv = {};
                                                    Object.entries(oldEnv).forEach(([k, v]) => {
                                                        if (k === key) {
                                                            nextEnv[e.target.value] = v;
                                                        }
                                                        else {
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
                                                }, className: "md:col-span-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-text text-sm", placeholder: "KEY" }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: envValue, onChange: (e) => {
                                                    const oldEnv = formData.settings?.launch?.environment || {};
                                                    const nextEnv = { ...oldEnv, [key]: e.target.value };
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
                                                }, className: "md:col-span-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-text text-sm", placeholder: "value" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => {
                                                    const oldEnv = formData.settings?.launch?.environment || {};
                                                    const nextEnv = {};
                                                    Object.entries(oldEnv).forEach(([k, v]) => {
                                                        if (k !== key)
                                                            nextEnv[k] = v;
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
                                                }, className: "px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm", children: "Remove" })] }, key))), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => {
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
                                        }, className: "px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm", children: "+ Add Environment Variable" })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-gray-500 mt-1", children: "Extra environment variables are passed through launch settings at runtime." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mb-4", children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-sm font-medium text-muted mb-2", children: "Windows Registry Settings" }), (0, jsx_runtime_1.jsxs)("div", { className: "mb-3 flex flex-wrap items-center gap-2", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: async () => {
                                            setRegistryApplyRunning(true);
                                            setRegistryApplyError(null);
                                            setRegistryApplySuccess(null);
                                            try {
                                                await onApplyRegistrySettings();
                                                setRegistryApplySuccess('Configured registry settings applied successfully.');
                                            }
                                            catch (error) {
                                                setRegistryApplyError(error instanceof Error ? error.message : 'Failed to apply configured registry settings.');
                                            }
                                            finally {
                                                setRegistryApplyRunning(false);
                                            }
                                        }, disabled: registryApplyRunning || !gameId, className: "px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm disabled:opacity-50", children: registryApplyRunning ? 'Applying Settings…' : 'Execute Registry Settings' }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: async () => {
                                            setRegistrySetupRunning(true);
                                            setRegistrySetupError(null);
                                            setRegistrySetupSuccess(null);
                                            try {
                                                await onRunRegistrySetup();
                                                setRegistrySetupSuccess('Wine registry setup completed successfully.');
                                            }
                                            catch (error) {
                                                setRegistrySetupError(error instanceof Error ? error.message : 'Failed to run Wine registry setup.');
                                            }
                                            finally {
                                                setRegistrySetupRunning(false);
                                            }
                                        }, disabled: registrySetupRunning || !gameId, className: "px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm disabled:opacity-50", children: registrySetupRunning ? 'Running Regedit…' : 'Run Regedit Setup' }), (0, jsx_runtime_1.jsx)("span", { className: "text-xs text-gray-500", children: "Opens Wine regedit for this game's Wine prefix." })] }), registryApplySuccess && ((0, jsx_runtime_1.jsx)("div", { className: "mb-3 rounded-md border border-green-200 bg-green-50 p-2 text-xs text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200", children: registryApplySuccess })), registryApplyError && ((0, jsx_runtime_1.jsx)("div", { className: "mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200", children: registryApplyError })), registrySetupSuccess && ((0, jsx_runtime_1.jsx)("div", { className: "mb-3 rounded-md border border-green-200 bg-green-50 p-2 text-xs text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200", children: registrySetupSuccess })), registrySetupError && ((0, jsx_runtime_1.jsx)("div", { className: "mb-3 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200", children: registrySetupError })), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(formData.settings?.wine?.registrySettings || []).map((reg, index) => ((0, jsx_runtime_1.jsxs)("div", { className: "p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800", children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-2 mb-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "text", value: reg.path, onChange: (e) => {
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
                                                        }, className: "px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text text-sm", placeholder: "HKCU\\Software\\MyGame" }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: reg.name, onChange: (e) => {
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
                                                        }, className: "px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text text-sm", placeholder: "ValueName" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-2", children: [(0, jsx_runtime_1.jsxs)("select", { value: reg.type, onChange: (e) => {
                                                            const newSettings = [...(formData.settings?.wine?.registrySettings || [])];
                                                            newSettings[index] = {
                                                                ...newSettings[index],
                                                                type: e.target.value,
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
                                                        }, className: "px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text text-sm", children: [(0, jsx_runtime_1.jsx)("option", { value: "REG_SZ", children: "REG_SZ (String)" }), (0, jsx_runtime_1.jsx)("option", { value: "REG_DWORD", children: "REG_DWORD (Integer)" }), (0, jsx_runtime_1.jsx)("option", { value: "REG_BINARY", children: "REG_BINARY" }), (0, jsx_runtime_1.jsx)("option", { value: "REG_MULTI_SZ", children: "REG_MULTI_SZ" }), (0, jsx_runtime_1.jsx)("option", { value: "REG_EXPAND_SZ", children: "REG_EXPAND_SZ" })] }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: reg.value, onChange: (e) => {
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
                                                        }, className: "px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text text-sm", placeholder: "Value (e.g., 0x1 for DWORD)" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => {
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
                                                        }, className: "px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm", children: "Remove" })] })] }, index))), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => {
                                            setFormData((prev) => ({
                                                ...prev,
                                                settings: {
                                                    ...prev.settings,
                                                    wine: {
                                                        ...prev.settings?.wine,
                                                        registrySettings: [
                                                            ...(prev.settings?.wine?.registrySettings || []),
                                                            { path: '', name: '', type: 'REG_DWORD', value: '' },
                                                        ],
                                                    },
                                                },
                                            }));
                                        }, className: "px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm", children: "+ Add Registry Setting" })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-gray-500 mt-1", children: "Set Windows registry values before launching. Useful for game-specific settings like disabling intro videos." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm font-medium text-muted", children: "Export / Import MakeItRun Config" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-2", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: onExportToml, disabled: makeItRunIoLoading || !gameId, className: "px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm disabled:opacity-50", children: makeItRunIoLoading ? 'Working…' : 'Export as TOML' }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => importRef.current?.click(), disabled: makeItRunIoLoading || !gameId, className: "px-3 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800 text-sm disabled:opacity-50", children: "Import TOML" }), (0, jsx_runtime_1.jsx)("button", { type: "button", disabled: true, title: "Coming soon \u2014 share on DillingerGaming", className: "px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-500 rounded-md text-sm cursor-not-allowed", children: "Share" })] }), (0, jsx_runtime_1.jsx)("input", { ref: importRef, type: "file", accept: ".toml,text/plain", className: "hidden", onChange: (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        onImportFileSelected(file);
                                    }
                                } })] })] }))] }));
}
