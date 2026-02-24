import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import type { GamePlatformConfig } from '@dillinger/shared';
import { getPlatformName } from './game-form-utils';

interface BasicInformationSectionProps {
  formData: {
    title: string;
    slug?: string;
    platformId: string;
    platforms: GamePlatformConfig[];
  };
  handleChange: (e: ChangeEvent<HTMLInputElement>) => void;
  switchPlatform: (platformId: string) => void;
  handleRemovePlatform: (platformId: string) => void;
  showAddPlatform: boolean;
  setShowAddPlatform: Dispatch<SetStateAction<boolean>>;
  handleAddPlatform: (platformId: string) => void;
  sectionRef: (el: HTMLDivElement | null) => void;
}

export default function BasicInformationSection({
  formData,
  handleChange,
  switchPlatform,
  handleRemovePlatform,
  showAddPlatform,
  setShowAddPlatform,
  handleAddPlatform,
  sectionRef,
}: BasicInformationSectionProps) {
  return (
    <div
      id="basic"
      ref={sectionRef}
      className="space-y-4 mb-6"
    >
      <h3 className="text-lg font-semibold text-text border-b pb-2">Basic Information</h3>

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-muted mb-2">
          Title *
        </label>
        <input
          type="text"
          id="title"
          name="title"
          required
          value={formData.title}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
          placeholder="Enter game title"
        />
      </div>

      <div>
        <label htmlFor="slug" className="block text-sm font-medium text-muted mb-2">
          Slug <span className="text-xs text-gray-500">(URL-friendly identifier, auto-generated if empty)</span>
        </label>
        <input
          type="text"
          id="slug"
          name="slug"
          value={formData.slug}
          onChange={handleChange}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
          placeholder="e.g., my-game-title"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-muted mb-2">
          Platforms
        </label>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {formData.platforms.map((platform) => (
              <div key={platform.platformId} className="relative group">
                <button
                  type="button"
                  onClick={() => switchPlatform(platform.platformId)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    formData.platformId === platform.platformId
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {getPlatformName(platform.platformId)}
                </button>
                {formData.platforms.length > 1 && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleRemovePlatform(platform.platformId);
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    title="Remove platform"
                  >
                    <TrashIcon className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAddPlatform(!showAddPlatform)}
                className="px-3 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-500 hover:text-blue-600 hover:border-blue-500 transition-colors flex items-center gap-1"
              >
                <PlusIcon className="w-4 h-4" />
                Add Platform
              </button>

              {showAddPlatform && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-20 max-h-60 overflow-y-auto">
                  <div className="p-2 space-y-1">
                    <button
                      type="button"
                      onClick={() => handleAddPlatform('linux-native')}
                      className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Native (Linux)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddPlatform('windows-wine')}
                      className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Wine (Windows)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddPlatform('mame')}
                      className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Arcade (MAME)
                    </button>
                    <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                    <p className="px-3 py-1 text-xs font-semibold text-gray-500">Nintendo</p>
                    <button
                      type="button"
                      onClick={() => handleAddPlatform('nes')}
                      className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Nintendo (NES)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddPlatform('snes')}
                      className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Super Nintendo (SNES)
                    </button>
                    <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                    <p className="px-3 py-1 text-xs font-semibold text-gray-500">Sony</p>
                    <button
                      type="button"
                      onClick={() => handleAddPlatform('psx')}
                      className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      PlayStation 1
                    </button>
                    <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                    <p className="px-3 py-1 text-xs font-semibold text-gray-500">Commodore</p>
                    {['c64', 'c128', 'vic20', 'plus4', 'pet'].map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleAddPlatform(id)}
                        className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        {getPlatformName(id)}
                      </button>
                    ))}
                    <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                    <p className="px-3 py-1 text-xs font-semibold text-gray-500">Amiga</p>
                    {['amiga', 'amiga500', 'amiga500plus', 'amiga600', 'amiga1200', 'amiga3000', 'amiga4000', 'cd32'].map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => handleAddPlatform(id)}
                        className="w-full text-left px-3 py-2 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        {getPlatformName(id)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {formData.platforms.length === 0 && (
            <p className="text-sm text-red-500">
              Please add at least one platform configuration.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
