import type { GameFormData } from './game-form-types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeSimilarGame = (value: unknown, scraperType: string) => {
  if (typeof value === 'string') {
    return {
      title: value,
      slug: value.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      scraperId: undefined,
      scraperType,
    };
  }

  if (isRecord(value)) {
    const titleValue = value.title;
    const slugValue = value.slug;
    const scraperIdValue = value.scraperId;

    return {
      title: typeof titleValue === 'string' ? titleValue : String(titleValue ?? ''),
      slug: typeof slugValue === 'string' ? slugValue : undefined,
      scraperId: scraperIdValue,
      scraperType,
    };
  }

  return {
    title: String(value ?? ''),
    slug: undefined,
    scraperId: undefined,
    scraperType,
  };
};

export const mergeRefreshedScraperData = (
  prev: GameFormData,
  latestData: unknown,
  scraperType: string,
): GameFormData => {
  const similarGames = isRecord(latestData) && Array.isArray(latestData.similarGames)
    ? latestData.similarGames.map((entry) => normalizeSimilarGame(entry, scraperType))
    : undefined;

  return {
    ...prev,
    metadata: {
      description: prev.metadata.description,
      genre: prev.metadata.genre,
      developer: prev.metadata.developer,
      publisher: prev.metadata.publisher,
      releaseDate: prev.metadata.releaseDate,
      rating: prev.metadata.rating,
      igdbId: prev.metadata.igdbId,
      primaryImage: prev.metadata.primaryImage,
      backdropImage: prev.metadata.backdropImage,
    },
    _originalGame: {
      ...prev._originalGame,
      metadata: {
        ...prev._originalGame?.metadata,
        similarGames,
      },
    },
  };
};

export const fetchLatestScraperData = async (scraperType: string, scraperId: string) => {
  const response = await fetch(`/api/scrapers/game/${scraperType}/${scraperId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch latest scraper data');
  }

  const result: unknown = await response.json();
  if (!isRecord(result) || !('game' in result)) {
    throw new Error('Scraper response missing game payload');
  }

  return result.game;
};

export const launchGameLocally = async (gameId: string) => {
  const response = await fetch(`/api/launch/${gameId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mode: 'local' }),
  });

  const result: unknown = await response.json();
  const errorMessage = isRecord(result) && typeof result.error === 'string'
    ? result.error
    : null;

  if (!response.ok || errorMessage) {
    throw new Error(errorMessage || 'Launch failed');
  }
};
