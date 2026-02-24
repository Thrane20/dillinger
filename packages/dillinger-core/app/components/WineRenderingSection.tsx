'use client';

import DxvkVersionSelector from './DxvkVersionSelector';
import type { WineSectionSharedProps } from './wine-section-types';

const RENDERING_UNLOCKED_PHASES = new Set(['post_install', 'needs_configuration', 'ready', 'running']);

interface WineRenderingSectionProps<TFormData extends {
  settings?: {
    wine?: {
      renderer?: 'vulkan' | 'opengl' | 'gdi';
      version?: string;
      useDxvk?: boolean;
      dxvkVersion?: string;
      useVkd3dProton?: boolean;
      vkd3dVersion?: string;
    };
    launch?: {
      fullscreen?: boolean;
      resolution?: string;
      useXrandr?: boolean;
      xrandrMode?: string;
    };
  };
}> extends WineSectionSharedProps<TFormData> {
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  sectionRef: (el: HTMLDivElement | null) => void;
}

export default function WineRenderingSection<TFormData extends {
  settings?: {
    wine?: {
      renderer?: 'vulkan' | 'opengl' | 'gdi';
      version?: string;
      useDxvk?: boolean;
      dxvkVersion?: string;
      useVkd3dProton?: boolean;
      vkd3dVersion?: string;
    };
    launch?: {
      fullscreen?: boolean;
      resolution?: string;
      useXrandr?: boolean;
      xrandrMode?: string;
    };
  };
}>({
  formData,
  handleChange,
  setFormData,
  phase,
  sectionRef,
}: WineRenderingSectionProps<TFormData>) {
  const isLocked = phase ? !RENDERING_UNLOCKED_PHASES.has(phase) : false;

  return (
    <div
      id="rendering"
      ref={sectionRef}
      className="space-y-4 mb-6 border-t border-gray-200 dark:border-gray-700 pt-6"
    >
      <h3 className="text-lg font-semibold text-text border-b pb-2">Rendering</h3>
      <p className="text-sm text-gray-500 mb-4">
        Configure graphics rendering for DirectX translation and display options.
      </p>

      {isLocked ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-200">
          Install the game first to access rendering settings.
        </div>
      ) : (

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="settings.wine.renderer" className="block text-sm font-medium text-muted mb-2">
            WineD3D Renderer
          </label>
          <select
            id="settings.wine.renderer"
            name="settings.wine.renderer"
            value={formData.settings?.wine?.renderer || 'opengl'}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
          >
            <option value="opengl">OpenGL — Most Compatible</option>
            <option value="vulkan">Vulkan — Experimental (WineD3D)</option>
            <option value="gdi">GDI — Software/2D Games Only</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            This sets how WineD3D translates DirectDraw/D3D calls. OpenGL is recommended for most games.
            For DX9-11 games with DXVK enabled, this setting is bypassed.
          </p>
        </div>

        <div className="col-span-2">
          <DxvkVersionSelector
            enabled={formData.settings?.wine?.useDxvk || false}
            versionId={formData.settings?.wine?.dxvkVersion}
            onEnabledChange={(enabled) => {
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
            }}
            onVersionChange={(versionId) => {
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
            }}
            showVkd3d={true}
            vkd3dEnabled={formData.settings?.wine?.useVkd3dProton || false}
            vkd3dVersionId={formData.settings?.wine?.vkd3dVersion}
            onVkd3dEnabledChange={(enabled) => {
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
            }}
            onVkd3dVersionChange={(versionId) => {
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
            }}
          />
        </div>

        <div className="col-span-2">
          {(() => {
            const wineVersion = formData.settings?.wine?.version || '';
            const isProton = /^ge-|proton|umu/i.test(wineVersion);
            return (
              <>
                <label className={`flex items-center space-x-2 ${isProton ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={formData.settings?.launch?.fullscreen || false}
                    disabled={isProton}
                    onChange={(e) => {
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
                    }}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <span className="text-sm font-medium text-muted">
                    Wine virtual desktop
                  </span>
                </label>
                {isProton ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 ml-6">
                    ⚠️ Not compatible with GE-Proton — use Gamescope for fullscreen instead
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1 ml-6">
                    Creates a desktop window containing the game. Note: Old games run at their native resolution
                    inside this window. For true fullscreen with upscaling, use <strong>Gamescope</strong> below.
                  </p>
                )}
              </>
            );
          })()}
        </div>

        {formData.settings?.launch?.fullscreen && (
          <div>
            <label htmlFor="settings.launch.resolution" className="block text-sm font-medium text-muted mb-2">
              Resolution
            </label>
            <select
              id="settings.launch.resolution"
              name="settings.launch.resolution"
              value={formData.settings?.launch?.resolution || '1920x1080'}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
            >
              <option value="1920x1080">1920x1080 (Full HD)</option>
              <option value="2560x1440">2560x1440 (QHD)</option>
              <option value="3840x2160">3840x2160 (4K)</option>
              <option value="1600x900">1600x900</option>
              <option value="1440x900">1440x900</option>
              <option value="1366x768">1366x768</option>
              <option value="1280x1024">1280x1024</option>
              <option value="1280x720">1280x720 (HD)</option>
              <option value="1024x768">1024x768</option>
              <option value="800x600">800x600</option>
            </select>
          </div>
        )}

        {formData.settings?.launch?.fullscreen && (
          <div className="col-span-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.settings?.launch?.useXrandr || false}
                onChange={(e) => {
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
                }}
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-muted">
                Set display resolution before launch (xrandr)
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-6">
              Automatically changes your display resolution to match the game. Useful for older games that do not handle resolution scaling well.
            </p>
          </div>
        )}

        {formData.settings?.launch?.fullscreen && formData.settings?.launch?.useXrandr && (
          <div>
            <label htmlFor="settings.launch.xrandrMode" className="block text-sm font-medium text-muted mb-2">
              xrandr Resolution
            </label>
            <input
              type="text"
              id="settings.launch.xrandrMode"
              name="settings.launch.xrandrMode"
              value={formData.settings?.launch?.xrandrMode || formData.settings?.launch?.resolution || '1920x1080'}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
              placeholder="e.g., 1920x1080"
            />
            <p className="text-xs text-gray-500 mt-1">
              Display resolution to set via xrandr (defaults to game resolution above)
            </p>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
