import type { GameFormData } from './game-form-types';

const splitCsv = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

export const buildGameSubmitPayload = (formData: GameFormData) => {
  const tags = splitCsv(formData.tags);
  const genre = formData.metadata.genre ? splitCsv(formData.metadata.genre) : [];
  const preservedMetadata = formData._originalGame?.metadata || {};

  const platforms = [...formData.platforms];
  const currentPlatformIndex = platforms.findIndex((platform) => platform.platformId === formData.platformId);

  if (currentPlatformIndex >= 0) {
    platforms[currentPlatformIndex] = {
      ...platforms[currentPlatformIndex],
      settings: formData.settings,
      filePath: formData.filePath,
    };
  } else if (formData.platformId) {
    platforms.push({
      platformId: formData.platformId,
      settings: formData.settings,
      filePath: formData.filePath,
    });
  }

  return {
    title: formData.title,
    platforms,
    defaultPlatformId: formData.platformId,
    tags,
    collectionIds: formData._originalGame?.collectionIds || [],
    metadata: {
      description: formData.metadata.description,
      genre,
      developer: formData.metadata.developer,
      publisher: formData.metadata.publisher,
      releaseDate: formData.metadata.releaseDate,
      rating: formData.metadata.rating,
      igdbId: formData.metadata.igdbId,
      primaryImage: formData.metadata.primaryImage,
      backdropImage: formData.metadata.backdropImage,
      similarGames: preservedMetadata.similarGames,
      coverArt: preservedMetadata.coverArt,
      screenshots: preservedMetadata.screenshots,
      playTime: preservedMetadata.playTime,
      lastPlayed: preservedMetadata.lastPlayed,
    },
    settings: formData.settings,
    fileInfo: formData._originalGame?.fileInfo,
    created: formData._originalGame?.created,
  };
};

export const submitGamePayload = async (
  mode: 'add' | 'edit',
  gameId: string | undefined,
  payload: ReturnType<typeof buildGameSubmitPayload>,
) => {
  const url = mode === 'edit' ? `/api/games/${gameId}` : '/api/games';
  const method = mode === 'edit' ? 'PUT' : 'POST';

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result: unknown = await response.json();
  const resultRecord = typeof result === 'object' && result !== null ? result as Record<string, unknown> : {};

  if (!response.ok || resultRecord.success !== true) {
    const error = typeof resultRecord.error === 'string' ? resultRecord.error : `Failed to ${mode} game`;
    throw new Error(error);
  }

  const data = typeof resultRecord.data === 'object' && resultRecord.data !== null
    ? resultRecord.data as Record<string, unknown>
    : {};

  return {
    savedGameId: typeof data.id === 'string' ? data.id : undefined,
  };
};
