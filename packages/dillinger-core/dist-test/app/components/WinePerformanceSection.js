'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = WinePerformanceSection;
const jsx_runtime_1 = require("react/jsx-runtime");
const PERFORMANCE_UNLOCKED_PHASES = new Set(['post_install', 'needs_configuration', 'ready', 'running']);
function WinePerformanceSection({ formData, setFormData, handleChange, isLocked, phase, sectionRef, }) {
    const phaseLocked = phase ? !PERFORMANCE_UNLOCKED_PHASES.has(phase) : false;
    const locked = isLocked || phaseLocked;
    return ((0, jsx_runtime_1.jsxs)("div", { id: "performance", ref: sectionRef, className: "space-y-4 mb-6 border-t border-gray-200 dark:border-gray-700 pt-6", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-text border-b pb-2", children: "Performance" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-gray-500", children: "Configure Gamescope upscaling/fullscreen and MangoHUD performance metrics." }), locked ? ((0, jsx_runtime_1.jsx)("div", { className: "rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-200", children: "Install the game first to access performance settings." })) : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2 mb-4", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", id: "settings.gamescope.enabled", checked: formData.settings?.gamescope?.enabled || false, onChange: (e) => {
                                    setFormData((prev) => ({
                                        ...prev,
                                        settings: {
                                            ...prev.settings,
                                            gamescope: {
                                                ...prev.settings?.gamescope,
                                                enabled: e.target.checked,
                                            },
                                        },
                                    }));
                                }, className: "w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" }), (0, jsx_runtime_1.jsx)("label", { htmlFor: "settings.gamescope.enabled", className: "text-sm font-medium text-text", children: "Use Gamescope compositor" }), (0, jsx_runtime_1.jsx)("span", { className: "text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded", children: "Recommended for old games" })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-gray-500 mb-3", children: "Gamescope provides true fullscreen, upscaling (FSR/NIS), and proper resolution handling for older games." }), formData.settings?.gamescope?.enabled && ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4 pl-6 border-l-2 border-blue-500", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "settings.gamescope.width", className: "block text-sm font-medium text-muted mb-2", children: "Output Resolution" }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-2 gap-4", children: [(0, jsx_runtime_1.jsxs)("select", { id: "settings.gamescope.width", name: "settings.gamescope.width", value: formData.settings?.gamescope?.width || 1920, onChange: (e) => {
                                                    const value = parseInt(e.target.value, 10);
                                                    const heightMap = {
                                                        640: 480,
                                                        800: 600,
                                                        1024: 768,
                                                        1280: 720,
                                                        1366: 768,
                                                        1600: 900,
                                                        1920: 1080,
                                                        2560: 1440,
                                                        3840: 2160,
                                                    };
                                                    setFormData((prev) => ({
                                                        ...prev,
                                                        settings: {
                                                            ...prev.settings,
                                                            gamescope: {
                                                                ...prev.settings?.gamescope,
                                                                width: value,
                                                                height: heightMap[value] || prev.settings?.gamescope?.height || 1080,
                                                            },
                                                        },
                                                    }));
                                                }, className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text", children: [(0, jsx_runtime_1.jsx)("option", { value: "640", children: "640x480 (VGA)" }), (0, jsx_runtime_1.jsx)("option", { value: "800", children: "800x600 (SVGA)" }), (0, jsx_runtime_1.jsx)("option", { value: "1024", children: "1024x768 (XGA)" }), (0, jsx_runtime_1.jsx)("option", { value: "1280", children: "1280x720 (HD)" }), (0, jsx_runtime_1.jsx)("option", { value: "1366", children: "1366x768 (WXGA)" }), (0, jsx_runtime_1.jsx)("option", { value: "1600", children: "1600x900 (HD+)" }), (0, jsx_runtime_1.jsx)("option", { value: "1920", children: "1920x1080 (Full HD)" }), (0, jsx_runtime_1.jsx)("option", { value: "2560", children: "2560x1440 (QHD)" }), (0, jsx_runtime_1.jsx)("option", { value: "3840", children: "3840x2160 (4K UHD)" })] }), (0, jsx_runtime_1.jsx)("input", { type: "number", id: "settings.gamescope.height", name: "settings.gamescope.height", value: formData.settings?.gamescope?.height || 1080, onChange: handleChange, className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text", placeholder: "Height" })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "settings.gamescope.inputWidth", className: "block text-sm font-medium text-muted mb-2", children: "Game Internal Resolution (optional)" }), (0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-2 gap-4", children: [(0, jsx_runtime_1.jsxs)("select", { id: "settings.gamescope.inputWidth", name: "settings.gamescope.inputWidth", value: formData.settings?.gamescope?.inputWidth || '', onChange: (e) => {
                                                    const value = e.target.value ? parseInt(e.target.value, 10) : undefined;
                                                    const heightMap = {
                                                        640: 480,
                                                        800: 600,
                                                        1024: 768,
                                                        1280: 720,
                                                        1366: 768,
                                                        1600: 900,
                                                        1920: 1080,
                                                        2560: 1440,
                                                        3840: 2160,
                                                    };
                                                    setFormData((prev) => ({
                                                        ...prev,
                                                        settings: {
                                                            ...prev.settings,
                                                            gamescope: {
                                                                ...prev.settings?.gamescope,
                                                                inputWidth: value,
                                                                inputHeight: value ? heightMap[value] : undefined,
                                                            },
                                                        },
                                                    }));
                                                }, className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text", children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "Same as output" }), (0, jsx_runtime_1.jsx)("option", { value: "640", children: "640x480 (VGA)" }), (0, jsx_runtime_1.jsx)("option", { value: "800", children: "800x600 (SVGA)" }), (0, jsx_runtime_1.jsx)("option", { value: "1024", children: "1024x768 (XGA)" }), (0, jsx_runtime_1.jsx)("option", { value: "1280", children: "1280x720 (HD)" }), (0, jsx_runtime_1.jsx)("option", { value: "1366", children: "1366x768 (WXGA)" }), (0, jsx_runtime_1.jsx)("option", { value: "1600", children: "1600x900 (HD+)" }), (0, jsx_runtime_1.jsx)("option", { value: "1920", children: "1920x1080 (Full HD)" }), (0, jsx_runtime_1.jsx)("option", { value: "2560", children: "2560x1440 (QHD)" }), (0, jsx_runtime_1.jsx)("option", { value: "3840", children: "3840x2160 (4K UHD)" })] }), (0, jsx_runtime_1.jsx)("input", { type: "number", id: "settings.gamescope.inputHeight", name: "settings.gamescope.inputHeight", value: formData.settings?.gamescope?.inputHeight || '', onChange: handleChange, className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text", placeholder: "Height (auto)" })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "settings.gamescope.refreshRate", className: "block text-sm font-medium text-muted mb-2", children: "Refresh Rate" }), (0, jsx_runtime_1.jsxs)("select", { id: "settings.gamescope.refreshRate", name: "settings.gamescope.refreshRate", value: formData.settings?.gamescope?.refreshRate || 60, onChange: handleChange, className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text", children: [(0, jsx_runtime_1.jsx)("option", { value: "30", children: "30 Hz" }), (0, jsx_runtime_1.jsx)("option", { value: "60", children: "60 Hz" }), (0, jsx_runtime_1.jsx)("option", { value: "75", children: "75 Hz" }), (0, jsx_runtime_1.jsx)("option", { value: "90", children: "90 Hz" }), (0, jsx_runtime_1.jsx)("option", { value: "120", children: "120 Hz" }), (0, jsx_runtime_1.jsx)("option", { value: "144", children: "144 Hz" }), (0, jsx_runtime_1.jsx)("option", { value: "165", children: "165 Hz" }), (0, jsx_runtime_1.jsx)("option", { value: "240", children: "240 Hz" })] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "settings.gamescope.upscaler", className: "block text-sm font-medium text-muted mb-2", children: "Upscaler" }), (0, jsx_runtime_1.jsxs)("select", { id: "settings.gamescope.upscaler", name: "settings.gamescope.upscaler", value: formData.settings?.gamescope?.upscaler || 'auto', onChange: handleChange, className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text", children: [(0, jsx_runtime_1.jsx)("option", { value: "auto", children: "Auto" }), (0, jsx_runtime_1.jsx)("option", { value: "fsr", children: "FSR (AMD FidelityFX)" }), (0, jsx_runtime_1.jsx)("option", { value: "nis", children: "NIS (NVIDIA Image Scaling)" }), (0, jsx_runtime_1.jsx)("option", { value: "linear", children: "Linear" }), (0, jsx_runtime_1.jsx)("option", { value: "nearest", children: "Nearest" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", id: "settings.gamescope.fullscreen", checked: formData.settings?.gamescope?.fullscreen || false, onChange: (e) => {
                                            setFormData((prev) => ({
                                                ...prev,
                                                settings: {
                                                    ...prev.settings,
                                                    gamescope: {
                                                        ...prev.settings?.gamescope,
                                                        fullscreen: e.target.checked,
                                                    },
                                                },
                                            }));
                                        }, className: "w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" }), (0, jsx_runtime_1.jsx)("label", { htmlFor: "settings.gamescope.fullscreen", className: "text-sm text-text", children: "Fullscreen" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { htmlFor: "settings.gamescope.limitFps", className: "block text-sm font-medium text-muted mb-2", children: "FPS Limit (optional)" }), (0, jsx_runtime_1.jsx)("input", { type: "number", id: "settings.gamescope.limitFps", name: "settings.gamescope.limitFps", value: formData.settings?.gamescope?.limitFps || '', onChange: handleChange, className: "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text", placeholder: "e.g., 60" })] })] })), (0, jsx_runtime_1.jsxs)("div", { className: "border-t border-gray-200 dark:border-gray-700 pt-4 mt-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", id: "settings.mangohud.enabled", checked: formData.settings?.mangohud?.enabled || false, onChange: (e) => {
                                            setFormData((prev) => ({
                                                ...prev,
                                                settings: {
                                                    ...prev.settings,
                                                    mangohud: {
                                                        ...prev.settings?.mangohud,
                                                        enabled: e.target.checked,
                                                    },
                                                },
                                            }));
                                        }, className: "w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" }), (0, jsx_runtime_1.jsx)("label", { htmlFor: "settings.mangohud.enabled", className: "text-sm font-medium text-text", children: "Enable MangoHUD performance overlay" })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-gray-500 mt-2", children: "Display FPS, frame time, CPU/GPU usage, and other performance metrics in-game." })] })] }))] }));
}
