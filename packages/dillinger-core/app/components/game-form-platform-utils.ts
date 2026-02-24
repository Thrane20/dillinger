import type { GamePlatformConfig } from '@dillinger/shared';
import type { GameFormData } from './game-form-types';

const createDefaultSettings = () => ({
  wine: { arch: 'win64' as const, debug: {} },
  launch: { command: '', arguments: [] as string[], environment: {}, workingDirectory: '' },
}) satisfies NonNullable<GameFormData['settings']>;

const saveCurrentPlatformState = (prev: GameFormData): GamePlatformConfig[] => {
  const updatedPlatforms = [...prev.platforms];
  const currentPlatformIndex = updatedPlatforms.findIndex((platform) => platform.platformId === prev.platformId);

  if (currentPlatformIndex >= 0) {
    updatedPlatforms[currentPlatformIndex] = {
      ...updatedPlatforms[currentPlatformIndex],
      settings: prev.settings,
      filePath: prev.filePath,
    };
  } else if (prev.platformId) {
    updatedPlatforms.push({
      platformId: prev.platformId,
      settings: prev.settings,
      filePath: prev.filePath,
    });
  }

  return updatedPlatforms;
};

export const switchPlatformState = (prev: GameFormData, newPlatformId: string): GameFormData => {
  const updatedPlatforms = saveCurrentPlatformState(prev);
  const newPlatformConfig = updatedPlatforms.find((platform) => platform.platformId === newPlatformId);

  return {
    ...prev,
    platforms: updatedPlatforms,
    platformId: newPlatformId,
    settings: newPlatformConfig?.settings || createDefaultSettings(),
    filePath: newPlatformConfig?.filePath || '',
  };
};

export const addPlatformState = (prev: GameFormData, platformId: string): GameFormData => {
  const updatedPlatforms = saveCurrentPlatformState(prev);

  const newPlatform: GamePlatformConfig = {
    platformId,
    settings: createDefaultSettings(),
    filePath: '',
  };

  updatedPlatforms.push(newPlatform);

  return {
    ...prev,
    platforms: updatedPlatforms,
    platformId,
    settings: newPlatform.settings,
    filePath: newPlatform.filePath || '',
  };
};

export const removePlatformState = (prev: GameFormData, platformId: string): GameFormData => {
  const updatedPlatforms = prev.platforms.filter((platform) => platform.platformId !== platformId);

  let newPlatformId = prev.platformId;
  let newSettings = prev.settings;
  let newFilePath = prev.filePath;

  if (prev.platformId === platformId) {
    if (updatedPlatforms.length > 0) {
      newPlatformId = updatedPlatforms[0].platformId;
      newSettings = updatedPlatforms[0].settings;
      newFilePath = updatedPlatforms[0].filePath;
    } else {
      newPlatformId = '';
      newSettings = createDefaultSettings();
      newFilePath = '';
    }
  }

  return {
    ...prev,
    platforms: updatedPlatforms,
    platformId: newPlatformId,
    settings: newSettings,
    filePath: newFilePath,
  };
};
