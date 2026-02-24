'use client';
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = WineRenderingSection;
const jsx_runtime_1 = require("react/jsx-runtime");
const DxvkVersionSelector_1 = __importDefault(require("./DxvkVersionSelector"));
const RENDERING_UNLOCKED_PHASES = new Set(['post_install', 'needs_configuration', 'ready', 'running']);
function WineRenderingSection({ formData, handleChange, setFormData, phase, sectionRef, }) {
    const isLocked = phase ? !RENDERING_UNLOCKED_PHASES.has(phase) : false;
    return ((0, jsx_runtime_1.jsxs)("div", { id: "rendering", ref: sectionRef, className: "space-y-4 mb-6 border-t border-gray-200 dark:border-gray-700 pt-6", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-text border-b pb-2", children: "Rendering" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-gray-500 mb-4", children: "Configure graphics rendering for DirectX translation and display options." }), isLocked ? ((0, jsx_runtime_1.jsx)("div", { className: "rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-200", children: "Install the game first to access rendering settings." })) : ((0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "settings.wine.renderer", className: "block text-sm font-medium text-muted mb-2", children: "WineD3D Renderer" }), (0, jsx_runtime_1.jsxs)("select", { id: "settings.wine.renderer", name: "settings.wine.renderer", value: formData.settings?.wine?.renderer || 'opengl', onChange: handleChange, className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text", children: [(0, jsx_runtime_1.jsx)("option", { value: "opengl", children: "OpenGL \u2014 Most Compatible" }), (0, jsx_runtime_1.jsx)("option", { value: "vulkan", children: "Vulkan \u2014 Experimental (WineD3D)" }), (0, jsx_runtime_1.jsx)("option", { value: "gdi", children: "GDI \u2014 Software/2D Games Only" })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-gray-500 mt-1", children: "This sets how WineD3D translates DirectDraw/D3D calls. OpenGL is recommended for most games. For DX9-11 games with DXVK enabled, this setting is bypassed." })] }), (0, jsx_runtime_1.jsx)("div", { className: "col-span-2", children: (0, jsx_runtime_1.jsx)(DxvkVersionSelector_1.default, { enabled: formData.settings?.wine?.useDxvk || false, versionId: formData.settings?.wine?.dxvkVersion, onEnabledChange: (enabled) => {
                                setFormData((prev) => ({
                                    ...prev,
                                    settings: {
                                        ...prev.settings,
                                        wine: {
                                            ...prev.settings?.wine,
                                            useDxvk: enabled,
                                        },
                                    },
                                }));
                            }, onVersionChange: (versionId) => {
                                setFormData((prev) => ({
                                    ...prev,
                                    settings: {
                                        ...prev.settings,
                                        wine: {
                                            ...prev.settings?.wine,
                                            dxvkVersion: versionId,
                                        },
                                    },
                                }));
                            }, showVkd3d: true, vkd3dEnabled: formData.settings?.wine?.useVkd3dProton || false, vkd3dVersionId: formData.settings?.wine?.vkd3dVersion, onVkd3dEnabledChange: (enabled) => {
                                setFormData((prev) => ({
                                    ...prev,
                                    settings: {
                                        ...prev.settings,
                                        wine: {
                                            ...prev.settings?.wine,
                                            useVkd3dProton: enabled,
                                        },
                                    },
                                }));
                            }, onVkd3dVersionChange: (versionId) => {
                                setFormData((prev) => ({
                                    ...prev,
                                    settings: {
                                        ...prev.settings,
                                        wine: {
                                            ...prev.settings?.wine,
                                            vkd3dVersion: versionId,
                                        },
                                    },
                                }));
                            } }) }), (0, jsx_runtime_1.jsx)("div", { className: "col-span-2", children: (() => {
                            const wineVersion = formData.settings?.wine?.version || '';
                            const isProton = /^ge-|proton|umu/i.test(wineVersion);
                            return ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("label", { className: `flex items-center space-x-2 ${isProton ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`, children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: formData.settings?.launch?.fullscreen || false, disabled: isProton, onChange: (e) => {
                                                    setFormData((prev) => ({
                                                        ...prev,
                                                        settings: {
                                                            ...prev.settings,
                                                            launch: {
                                                                ...prev.settings?.launch,
                                                                fullscreen: e.target.checked,
                                                            },
                                                        },
                                                    }));
                                                }, className: "rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 disabled:opacity-50" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm font-medium text-muted", children: "Wine virtual desktop" })] }), isProton ? ((0, jsx_runtime_1.jsx)("p", { className: "text-xs text-amber-600 dark:text-amber-400 mt-1 ml-6", children: "\u26A0\uFE0F Not compatible with GE-Proton \u2014 use Gamescope for fullscreen instead" })) : ((0, jsx_runtime_1.jsxs)("p", { className: "text-xs text-gray-500 mt-1 ml-6", children: ["Creates a desktop window containing the game. Note: Old games run at their native resolution inside this window. For true fullscreen with upscaling, use ", (0, jsx_runtime_1.jsx)("strong", { children: "Gamescope" }), " below."] }))] }));
                        })() }), formData.settings?.launch?.fullscreen && ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "settings.launch.resolution", className: "block text-sm font-medium text-muted mb-2", children: "Resolution" }), (0, jsx_runtime_1.jsxs)("select", { id: "settings.launch.resolution", name: "settings.launch.resolution", value: formData.settings?.launch?.resolution || '1920x1080', onChange: handleChange, className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text", children: [(0, jsx_runtime_1.jsx)("option", { value: "1920x1080", children: "1920x1080 (Full HD)" }), (0, jsx_runtime_1.jsx)("option", { value: "2560x1440", children: "2560x1440 (QHD)" }), (0, jsx_runtime_1.jsx)("option", { value: "3840x2160", children: "3840x2160 (4K)" }), (0, jsx_runtime_1.jsx)("option", { value: "1600x900", children: "1600x900" }), (0, jsx_runtime_1.jsx)("option", { value: "1440x900", children: "1440x900" }), (0, jsx_runtime_1.jsx)("option", { value: "1366x768", children: "1366x768" }), (0, jsx_runtime_1.jsx)("option", { value: "1280x1024", children: "1280x1024" }), (0, jsx_runtime_1.jsx)("option", { value: "1280x720", children: "1280x720 (HD)" }), (0, jsx_runtime_1.jsx)("option", { value: "1024x768", children: "1024x768" }), (0, jsx_runtime_1.jsx)("option", { value: "800x600", children: "800x600" })] })] })), formData.settings?.launch?.fullscreen && ((0, jsx_runtime_1.jsxs)("div", { className: "col-span-2", children: [(0, jsx_runtime_1.jsxs)("label", { className: "flex items-center space-x-2 cursor-pointer", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: formData.settings?.launch?.useXrandr || false, onChange: (e) => {
                                            setFormData((prev) => ({
                                                ...prev,
                                                settings: {
                                                    ...prev.settings,
                                                    launch: {
                                                        ...prev.settings?.launch,
                                                        useXrandr: e.target.checked,
                                                    },
                                                },
                                            }));
                                        }, className: "rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm font-medium text-muted", children: "Set display resolution before launch (xrandr)" })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-gray-500 mt-1 ml-6", children: "Automatically changes your display resolution to match the game. Useful for older games that do not handle resolution scaling well." })] })), formData.settings?.launch?.fullscreen && formData.settings?.launch?.useXrandr && ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "settings.launch.xrandrMode", className: "block text-sm font-medium text-muted mb-2", children: "xrandr Resolution" }), (0, jsx_runtime_1.jsx)("input", { type: "text", id: "settings.launch.xrandrMode", name: "settings.launch.xrandrMode", value: formData.settings?.launch?.xrandrMode || formData.settings?.launch?.resolution || '1920x1080', onChange: handleChange, className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text", placeholder: "e.g., 1920x1080" }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-gray-500 mt-1", children: "Display resolution to set via xrandr (defaults to game resolution above)" })] }))] }))] }));
}
