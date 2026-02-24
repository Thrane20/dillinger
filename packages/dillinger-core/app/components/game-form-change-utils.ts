import type { GameFormData } from './game-form-types';

export const applyInputChange = (
  prev: GameFormData,
  name: string,
  value: string,
): GameFormData => {
  if (name.startsWith('metadata.')) {
    const metadataKey = name.split('.')[1] as keyof GameFormData['metadata'];
    return {
      ...prev,
      metadata: {
        ...prev.metadata,
        [metadataKey]: value,
      },
    };
  }

  if (name.startsWith('settings.launch.')) {
    const launchKey = name.split('.')[2];
    return {
      ...prev,
      settings: {
        ...prev.settings,
        launch: {
          ...prev.settings?.launch,
          [launchKey]: value,
        },
      },
    };
  }

  if (name.startsWith('settings.wine.')) {
    const wineKey = name.split('.')[2];
    return {
      ...prev,
      settings: {
        ...prev.settings,
        wine: {
          ...prev.settings?.wine,
          [wineKey]: value,
        },
      },
    };
  }

  if (name.startsWith('settings.gamescope.')) {
    const gamescopeKey = name.split('.')[2];
    return {
      ...prev,
      settings: {
        ...prev.settings,
        gamescope: {
          ...prev.settings?.gamescope,
          [gamescopeKey]: value,
        },
      },
    };
  }

  return {
    ...prev,
    [name]: value,
  };
};
