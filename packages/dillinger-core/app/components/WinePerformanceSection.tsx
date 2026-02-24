'use client';

import type React from 'react';
import type { WineGamePhase } from '@dillinger/shared';

const PERFORMANCE_UNLOCKED_PHASES = new Set(['post_install', 'needs_configuration', 'ready', 'running']);

interface WinePerformanceFormData {
  settings?: {
    gamescope?: {
      enabled?: boolean;
      width?: number;
      height?: number;
      refreshRate?: number;
      fullscreen?: boolean;
      upscaler?: 'auto' | 'fsr' | 'nis' | 'linear' | 'nearest';
      inputWidth?: number;
      inputHeight?: number;
      limitFps?: number;
    };
    mangohud?: {
      enabled?: boolean;
    };
  };
}

interface WinePerformanceSectionProps<T extends WinePerformanceFormData> {
  formData: T;
  setFormData: React.Dispatch<React.SetStateAction<T>>;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  isLocked: boolean;
  phase?: WineGamePhase;
  sectionRef?: (el: HTMLDivElement | null) => void;
}

export default function WinePerformanceSection<T extends WinePerformanceFormData>({
  formData,
  setFormData,
  handleChange,
  isLocked,
  phase,
  sectionRef,
}: WinePerformanceSectionProps<T>) {
  const phaseLocked = phase ? !PERFORMANCE_UNLOCKED_PHASES.has(phase) : false;
  const locked = isLocked || phaseLocked;

  return (
    <div
      id="performance"
      ref={sectionRef}
      className="space-y-4 mb-6 border-t border-gray-200 dark:border-gray-700 pt-6"
    >
      <h3 className="text-lg font-semibold text-text border-b pb-2">Performance</h3>
      <p className="text-sm text-gray-500">
        Configure Gamescope upscaling/fullscreen and MangoHUD performance metrics.
      </p>

      {locked ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-200">
          Install the game first to access performance settings.
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              id="settings.gamescope.enabled"
              checked={formData.settings?.gamescope?.enabled || false}
              onChange={(e) => {
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
              }}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="settings.gamescope.enabled" className="text-sm font-medium text-text">
              Use Gamescope compositor
            </label>
            <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded">
              Recommended for old games
            </span>
          </div>

          <p className="text-xs text-gray-500 mb-3">
            Gamescope provides true fullscreen, upscaling (FSR/NIS), and proper resolution handling for older games.
          </p>

          {formData.settings?.gamescope?.enabled && (
            <div className="space-y-4 pl-6 border-l-2 border-blue-500">
              <div>
                <label htmlFor="settings.gamescope.width" className="block text-sm font-medium text-muted mb-2">
                  Output Resolution
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <select
                    id="settings.gamescope.width"
                    name="settings.gamescope.width"
                    value={formData.settings?.gamescope?.width || 1920}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10);
                      const heightMap: Record<number, number> = {
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
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
                  >
                    <option value="640">640x480 (VGA)</option>
                    <option value="800">800x600 (SVGA)</option>
                    <option value="1024">1024x768 (XGA)</option>
                    <option value="1280">1280x720 (HD)</option>
                    <option value="1366">1366x768 (WXGA)</option>
                    <option value="1600">1600x900 (HD+)</option>
                    <option value="1920">1920x1080 (Full HD)</option>
                    <option value="2560">2560x1440 (QHD)</option>
                    <option value="3840">3840x2160 (4K UHD)</option>
                  </select>
                  <input
                    type="number"
                    id="settings.gamescope.height"
                    name="settings.gamescope.height"
                    value={formData.settings?.gamescope?.height || 1080}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
                    placeholder="Height"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="settings.gamescope.inputWidth" className="block text-sm font-medium text-muted mb-2">
                  Game Internal Resolution (optional)
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <select
                    id="settings.gamescope.inputWidth"
                    name="settings.gamescope.inputWidth"
                    value={formData.settings?.gamescope?.inputWidth || ''}
                    onChange={(e) => {
                      const value = e.target.value ? parseInt(e.target.value, 10) : undefined;
                      const heightMap: Record<number, number> = {
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
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
                  >
                    <option value="">Same as output</option>
                    <option value="640">640x480 (VGA)</option>
                    <option value="800">800x600 (SVGA)</option>
                    <option value="1024">1024x768 (XGA)</option>
                    <option value="1280">1280x720 (HD)</option>
                    <option value="1366">1366x768 (WXGA)</option>
                    <option value="1600">1600x900 (HD+)</option>
                    <option value="1920">1920x1080 (Full HD)</option>
                    <option value="2560">2560x1440 (QHD)</option>
                    <option value="3840">3840x2160 (4K UHD)</option>
                  </select>
                  <input
                    type="number"
                    id="settings.gamescope.inputHeight"
                    name="settings.gamescope.inputHeight"
                    value={formData.settings?.gamescope?.inputHeight || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
                    placeholder="Height (auto)"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="settings.gamescope.refreshRate" className="block text-sm font-medium text-muted mb-2">
                  Refresh Rate
                </label>
                <select
                  id="settings.gamescope.refreshRate"
                  name="settings.gamescope.refreshRate"
                  value={formData.settings?.gamescope?.refreshRate || 60}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
                >
                  <option value="30">30 Hz</option>
                  <option value="60">60 Hz</option>
                  <option value="75">75 Hz</option>
                  <option value="90">90 Hz</option>
                  <option value="120">120 Hz</option>
                  <option value="144">144 Hz</option>
                  <option value="165">165 Hz</option>
                  <option value="240">240 Hz</option>
                </select>
              </div>

              <div>
                <label htmlFor="settings.gamescope.upscaler" className="block text-sm font-medium text-muted mb-2">
                  Upscaler
                </label>
                <select
                  id="settings.gamescope.upscaler"
                  name="settings.gamescope.upscaler"
                  value={formData.settings?.gamescope?.upscaler || 'auto'}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
                >
                  <option value="auto">Auto</option>
                  <option value="fsr">FSR (AMD FidelityFX)</option>
                  <option value="nis">NIS (NVIDIA Image Scaling)</option>
                  <option value="linear">Linear</option>
                  <option value="nearest">Nearest</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="settings.gamescope.fullscreen"
                  checked={formData.settings?.gamescope?.fullscreen || false}
                  onChange={(e) => {
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
                  }}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="settings.gamescope.fullscreen" className="text-sm text-text">Fullscreen</label>
              </div>

              <div>
                <label htmlFor="settings.gamescope.limitFps" className="block text-sm font-medium text-muted mb-2">
                  FPS Limit (optional)
                </label>
                <input
                  type="number"
                  id="settings.gamescope.limitFps"
                  name="settings.gamescope.limitFps"
                  value={formData.settings?.gamescope?.limitFps || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
                  placeholder="e.g., 60"
                />
              </div>
            </div>
          )}

          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="settings.mangohud.enabled"
                checked={formData.settings?.mangohud?.enabled || false}
                onChange={(e) => {
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
                }}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="settings.mangohud.enabled" className="text-sm font-medium text-text">
                Enable MangoHUD performance overlay
              </label>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Display FPS, frame time, CPU/GPU usage, and other performance metrics in-game.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
