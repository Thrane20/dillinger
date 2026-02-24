'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DxvkVersionSelector;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const outline_1 = require("@heroicons/react/24/outline");
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';
function DxvkVersionSelector({ enabled, versionId, onEnabledChange, onVersionChange, showVkd3d = false, vkd3dEnabled = false, vkd3dVersionId, onVkd3dEnabledChange, onVkd3dVersionChange, }) {
    const [installedVersions, setInstalledVersions] = (0, react_1.useState)([]);
    const [availableDxvk, setAvailableDxvk] = (0, react_1.useState)([]);
    const [availableVkd3d, setAvailableVkd3d] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [installing, setInstalling] = (0, react_1.useState)(null);
    const [installProgress, setInstallProgress] = (0, react_1.useState)(null);
    const [showInfo, setShowInfo] = (0, react_1.useState)(false);
    // Fetch DXVK versions
    (0, react_1.useEffect)(() => {
        const fetchVersions = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/dxvk-versions`);
                if (response.ok) {
                    const data = await response.json();
                    setInstalledVersions(data.installed || []);
                    setAvailableDxvk(data.available?.dxvk || []);
                    setAvailableVkd3d(data.available?.vkd3dProton || []);
                }
            }
            catch (error) {
                console.error('Failed to load DXVK versions:', error);
            }
            finally {
                setLoading(false);
            }
        };
        fetchVersions();
    }, []);
    const installedDxvk = installedVersions.filter(v => v.type === 'dxvk' || v.type === 'dxvk-gplasync');
    const installedVkd3d = installedVersions.filter(v => v.type === 'vkd3d-proton');
    const handleInstall = async (version) => {
        setInstalling(version.version);
        setInstallProgress({ stage: 'Starting...', percent: 0 });
        try {
            const response = await fetch(`${API_BASE_URL}/api/dxvk-versions?stream=true`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ version }),
            });
            if (!response.body)
                throw new Error('No response body');
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                const text = decoder.decode(value);
                const lines = text.split('\n').filter(line => line.startsWith('data: '));
                for (const line of lines) {
                    const json = JSON.parse(line.substring(6));
                    if (json.type === 'progress') {
                        setInstallProgress({ stage: json.stage, percent: json.percent });
                    }
                    else if (json.type === 'complete') {
                        setInstalledVersions(prev => [...prev, json.version]);
                        // Auto-select the newly installed version
                        if (version.type === 'vkd3d-proton') {
                            onVkd3dVersionChange?.(json.version.id);
                        }
                        else {
                            onVersionChange(json.version.id);
                        }
                    }
                    else if (json.type === 'error') {
                        throw new Error(json.error);
                    }
                }
            }
        }
        catch (error) {
            console.error('Failed to install DXVK:', error);
            alert(`Failed to install: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        finally {
            setInstalling(null);
            setInstallProgress(null);
        }
    };
    const getTypeBadge = (type) => {
        switch (type) {
            case 'dxvk':
                return (0, jsx_runtime_1.jsx)("span", { className: "px-1.5 py-0.5 text-xs rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300", children: "DXVK" });
            case 'dxvk-gplasync':
                return (0, jsx_runtime_1.jsx)("span", { className: "px-1.5 py-0.5 text-xs rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300", children: "GPLAsync" });
            case 'vkd3d-proton':
                return (0, jsx_runtime_1.jsx)("span", { className: "px-1.5 py-0.5 text-xs rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300", children: "VKD3D" });
            default:
                return null;
        }
    };
    if (loading) {
        return ((0, jsx_runtime_1.jsx)("div", { className: "p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900", children: (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-500", children: "Loading DXVK versions..." }) }));
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: "p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between mb-2", children: [(0, jsx_runtime_1.jsxs)("label", { className: "flex items-center space-x-2 cursor-pointer", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: enabled, onChange: (e) => onEnabledChange(e.target.checked), className: "rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm font-medium text-muted", children: "Enable DXVK (DirectX 9/10/11 \u2192 Vulkan)" })] }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setShowInfo(!showInfo), className: "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300", children: (0, jsx_runtime_1.jsx)(outline_1.InformationCircleIcon, { className: "w-5 h-5" }) })] }), showInfo && ((0, jsx_runtime_1.jsxs)("div", { className: "mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md text-xs text-blue-800 dark:text-blue-200", children: [(0, jsx_runtime_1.jsx)("strong", { children: "DXVK" }), " translates DirectX 9/10/11 calls to Vulkan for better performance on modern GPUs. Recommended for most DX9-11 games. For very old games (DirectDraw/D3D1-7), keep this off and use OpenGL renderer."] })), enabled && ((0, jsx_runtime_1.jsxs)("div", { className: "mt-3 space-y-2", children: [(0, jsx_runtime_1.jsx)("label", { className: "block text-xs font-medium text-muted", children: "DXVK Version" }), (0, jsx_runtime_1.jsxs)("select", { value: versionId || 'auto', onChange: (e) => onVersionChange(e.target.value === 'auto' ? undefined : e.target.value), className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text text-sm", children: [(0, jsx_runtime_1.jsx)("option", { value: "auto", children: "Auto (via winetricks)" }), installedDxvk.map(v => ((0, jsx_runtime_1.jsxs)("option", { value: v.id, children: [v.displayName, " ", v.architectures.join('/')] }, v.id)))] }), availableDxvk.length > 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "mt-2", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs text-gray-500 mb-1", children: "Install a specific version:" }), (0, jsx_runtime_1.jsx)("div", { className: "max-h-32 overflow-y-auto space-y-1", children: availableDxvk.slice(0, 5).map(v => {
                                            const isInstalled = installedDxvk.some(iv => iv.version === v.version);
                                            const isInstalling = installing === v.version;
                                            return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between py-1 px-2 rounded bg-gray-100 dark:bg-gray-800 text-xs", children: [(0, jsx_runtime_1.jsxs)("span", { className: "flex items-center gap-2", children: [getTypeBadge(v.type), (0, jsx_runtime_1.jsx)("span", { children: v.version })] }), isInstalled ? ((0, jsx_runtime_1.jsx)("span", { className: "text-green-600 dark:text-green-400", children: "Installed" })) : isInstalling ? ((0, jsx_runtime_1.jsxs)("span", { className: "text-blue-600 dark:text-blue-400", children: [installProgress?.stage, " ", installProgress?.percent !== undefined && `${installProgress.percent}%`] })) : ((0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => handleInstall(v), className: "flex items-center gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-400", children: [(0, jsx_runtime_1.jsx)(outline_1.ArrowDownTrayIcon, { className: "w-3 h-3" }), "Install"] }))] }, v.version));
                                        }) })] }))] }))] }), showVkd3d && ((0, jsx_runtime_1.jsxs)("div", { className: "pt-4 border-t border-gray-200 dark:border-gray-700", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex items-center justify-between mb-2", children: (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center space-x-2 cursor-pointer", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: vkd3dEnabled, onChange: (e) => onVkd3dEnabledChange?.(e.target.checked), className: "rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm font-medium text-muted", children: "Enable VKD3D-Proton (DirectX 12 \u2192 Vulkan)" })] }) }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-gray-500 mb-2", children: "Required for DirectX 12 games. Note: DX12 support in Wine requires recent versions." }), vkd3dEnabled && ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsxs)("select", { value: vkd3dVersionId || 'auto', onChange: (e) => onVkd3dVersionChange?.(e.target.value === 'auto' ? undefined : e.target.value), className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text text-sm", children: [(0, jsx_runtime_1.jsx)("option", { value: "auto", children: "Auto (via winetricks)" }), installedVkd3d.map(v => ((0, jsx_runtime_1.jsx)("option", { value: v.id, children: v.displayName }, v.id)))] }), availableVkd3d.length > 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "mt-2", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs text-gray-500 mb-1", children: "Install a specific version:" }), (0, jsx_runtime_1.jsx)("div", { className: "max-h-24 overflow-y-auto space-y-1", children: availableVkd3d.slice(0, 3).map(v => {
                                            const isInstalled = installedVkd3d.some(iv => iv.version === v.version);
                                            const isInstalling = installing === v.version;
                                            return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between py-1 px-2 rounded bg-gray-100 dark:bg-gray-800 text-xs", children: [(0, jsx_runtime_1.jsxs)("span", { className: "flex items-center gap-2", children: [getTypeBadge(v.type), (0, jsx_runtime_1.jsx)("span", { children: v.version })] }), isInstalled ? ((0, jsx_runtime_1.jsx)("span", { className: "text-green-600 dark:text-green-400", children: "Installed" })) : isInstalling ? ((0, jsx_runtime_1.jsx)("span", { className: "text-blue-600 dark:text-blue-400", children: installProgress?.stage })) : ((0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => handleInstall(v), className: "flex items-center gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-400", children: [(0, jsx_runtime_1.jsx)(outline_1.ArrowDownTrayIcon, { className: "w-3 h-3" }), "Install"] }))] }, v.version));
                                        }) })] }))] }))] }))] }));
}
