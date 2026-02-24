import type { RetroarchMameSettings } from '@dillinger/shared';
import type { GameFormData } from './game-form-types';

export const buildSaveDownloadUrl = (gameId: string, filename: string, type: 'sram' | 'state') =>
  `/api/games/${gameId}/saves/${encodeURIComponent(filename)}?type=${type}`;

export const updateMameOverridesState = (
  prev: GameFormData,
  updates: Partial<RetroarchMameSettings>,
  normalizeMameSettings: (settings: RetroarchMameSettings) => RetroarchMameSettings,
): GameFormData => {
  const existing = prev.settings?.emulator?.settings?.mame || {};
  const merged = normalizeMameSettings({ ...existing, ...updates });
  const emulatorSettings = { ...(prev.settings?.emulator?.settings || {}) };

  if (Object.keys(merged).length === 0) {
    delete emulatorSettings.mame;
  } else {
    emulatorSettings.mame = merged;
  }

  return {
    ...prev,
    settings: {
      ...prev.settings,
      emulator: {
        ...prev.settings?.emulator,
        settings: emulatorSettings,
      },
    },
  };
};

export const selectImageState = (
  prev: GameFormData,
  imageUrl: string,
  selector: 'primary' | 'backdrop' | null,
): GameFormData => ({
  ...prev,
  metadata: {
    ...prev.metadata,
    ...(selector === 'primary' ? { primaryImage: imageUrl } : { backdropImage: imageUrl }),
  },
});

export const applyDllQuickAddState = (
  prev: GameFormData,
  dllName: string,
  mode: string,
): GameFormData => {
  const nextPair = `${dllName}=${mode}`;
  const current = prev.settings?.wine?.dllOverrides?.trim() || '';

  if (!current) {
    return {
      ...prev,
      settings: {
        ...prev.settings,
        wine: {
          ...prev.settings?.wine,
          dllOverrides: nextPair,
        },
      },
    };
  }

  const parts = current.split(';').map((part) => part.trim()).filter(Boolean);
  const filtered = parts.filter((part) => !part.toLowerCase().startsWith(`${dllName.toLowerCase()}=`));
  filtered.push(nextPair);

  return {
    ...prev,
    settings: {
      ...prev.settings,
      wine: {
        ...prev.settings?.wine,
        dllOverrides: filtered.join(';'),
      },
    },
  };
};
