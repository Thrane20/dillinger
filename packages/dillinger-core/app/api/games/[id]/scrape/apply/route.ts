import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs-extra';
import * as path from 'path';

import { getScraperManager } from '@/lib/services/scrapers';
import { SettingsService } from '@/lib/services/settings';
import { JSONStorageService } from '@/lib/services/storage';

import type { Game, SaveGameMetadataRequest, SaveGameMetadataResponse, SavedGameMetadata } from '@dillinger/shared';

const scraperManager = getScraperManager();
const settingsService = SettingsService.getInstance();
const storage = JSONStorageService.getInstance();

const DILLINGER_CORE_PATH = process.env.DILLINGER_CORE_PATH || '/data';
const METADATA_PATH = path.join(DILLINGER_CORE_PATH, 'storage', 'metadata');

async function findGameAndFileKey(id: string): Promise<{ game: Game | null; fileKey: string | null }> {
  const directGame = await storage.readEntity<Game>('games', id);
  if (directGame) {
    return { game: directGame, fileKey: id };
  }

  const allGames = await storage.listEntities<Game>('games');
  const foundGame = allGames.find((g) => g.id === id || g.slug === id);

  if (!foundGame) {
    return { game: null, fileKey: null };
  }

  return { game: foundGame, fileKey: foundGame.id };
}

function isSafePathSegment(value: string): boolean {
  if (!value) return false;
  if (value.includes('..')) return false;
  if (value.includes('/') || value.includes('\\')) return false;
  return true;
}

// POST /api/games/[id]/scrape/apply - Apply scraper metadata to an existing game
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { success: false, gameId: '', message: 'Game ID is required' } satisfies SaveGameMetadataResponse,
        { status: 400 }
      );
    }

    if (!isSafePathSegment(id)) {
      return NextResponse.json(
        { success: false, gameId: id, message: 'Invalid game id' } satisfies SaveGameMetadataResponse,
        { status: 400 }
      );
    }

    const body = (await request.json()) as SaveGameMetadataRequest;
    const { scraperId, scraperType, downloadImages = true } = body;

    if (!scraperId || !scraperType) {
      return NextResponse.json(
        { success: false, gameId: id, message: 'Missing required fields: scraperId, scraperType' } satisfies SaveGameMetadataResponse,
        { status: 400 }
      );
    }

    const { game: existingGame, fileKey } = await findGameAndFileKey(id);
    if (!existingGame || !fileKey) {
      return NextResponse.json(
        { success: false, gameId: id, message: 'Game not found' } satisfies SaveGameMetadataResponse,
        { status: 404 }
      );
    }

    const scraperSettings = await settingsService.getScraperSettings();
    await scraperManager.initialize(scraperSettings);

    const gameData = await scraperManager.getGameDetail(scraperType, scraperId);

    const gamePath = path.join(METADATA_PATH, id);
    const imagesPath = path.join(gamePath, 'images');

    await fs.ensureDir(imagesPath);

    const localImages: SavedGameMetadata['localImages'] = {
      screenshots: [],
      artworks: [],
    };

    if (downloadImages) {
      if (gameData.cover?.url) {
        try {
          const coverBuffer = await scraperManager.downloadImage(scraperType, gameData.cover.url);
          const coverExt = path.extname(new URL(gameData.cover.url).pathname) || '.jpg';
          const coverFilename = `cover${coverExt}`;
          await fs.writeFile(path.join(imagesPath, coverFilename), coverBuffer);
          localImages.cover = coverFilename;
          gameData.cover.localPath = coverFilename;
        } catch (err) {
          console.error('Failed to download cover:', err);
        }
      }

      if (gameData.screenshots) {
        for (let i = 0; i < gameData.screenshots.length; i++) {
          const screenshot = gameData.screenshots[i];
          if (!screenshot) continue;
          try {
            const buffer = await scraperManager.downloadImage(scraperType, screenshot.url);
            const ext = path.extname(new URL(screenshot.url).pathname) || '.jpg';
            const filename = `screenshot_${i}${ext}`;
            await fs.writeFile(path.join(imagesPath, filename), buffer);
            localImages.screenshots.push(filename);
            screenshot.localPath = filename;
          } catch (err) {
            console.error(`Failed to download screenshot ${i}:`, err);
          }
        }
      }

      if (gameData.artworks) {
        for (let i = 0; i < gameData.artworks.length; i++) {
          const artwork = gameData.artworks[i];
          if (!artwork) continue;
          try {
            const buffer = await scraperManager.downloadImage(scraperType, artwork.url);
            const ext = path.extname(new URL(artwork.url).pathname) || '.jpg';
            const filename = `artwork_${i}${ext}`;
            await fs.writeFile(path.join(imagesPath, filename), buffer);
            localImages.artworks.push(filename);
            artwork.localPath = filename;
          } catch (err) {
            console.error(`Failed to download artwork ${i}:`, err);
          }
        }
      }
    }

    const nowIso = new Date().toISOString();
    let savedAt = nowIso;

    const metadataJsonPath = path.join(gamePath, 'metadata.json');
    if (await fs.pathExists(metadataJsonPath)) {
      try {
        const existing = (await fs.readJSON(metadataJsonPath)) as Partial<SavedGameMetadata>;
        if (typeof existing.savedAt === 'string' && existing.savedAt) {
          savedAt = existing.savedAt;
        }
      } catch {
        // ignore read errors; we'll rewrite
      }
    }

    const savedMetadata: SavedGameMetadata = {
      id,
      slug: id,
      scraperData: gameData,
      localImages,
      savedAt,
      lastUpdated: nowIso,
    };

    await fs.writeJSON(metadataJsonPath, savedMetadata, { spaces: 2 });

    let primaryImage = '';
    let backdropImage = '';

    if (localImages.cover) {
      primaryImage = `/api/images/${id}/${localImages.cover}`;
      backdropImage = `/api/images/${id}/${localImages.cover}`;
    } else if (localImages.screenshots.length > 0) {
      primaryImage = `/api/images/${id}/${localImages.screenshots[0]}`;
      backdropImage = `/api/images/${id}/${localImages.screenshots[0]}`;
    } else if (localImages.artworks.length > 0) {
      primaryImage = `/api/images/${id}/${localImages.artworks[0]}`;
      backdropImage = `/api/images/${id}/${localImages.artworks[0]}`;
    }

    const updatedGame: Game = {
      ...existingGame,
      metadata: {
        ...existingGame.metadata,
        igdbId: scraperType === 'igdb' ? Number.parseInt(gameData.scraperId, 10) : existingGame.metadata?.igdbId,
        description: gameData.summary ?? existingGame.metadata?.description,
        genre: gameData.genres ?? existingGame.metadata?.genre,
        developer: gameData.developers?.[0] ?? existingGame.metadata?.developer,
        publisher: gameData.publishers?.[0] ?? existingGame.metadata?.publisher,
        releaseDate: gameData.releaseDate ?? existingGame.metadata?.releaseDate,
        rating: gameData.rating ? Math.round(gameData.rating / 10) : existingGame.metadata?.rating,
        coverArt: localImages.cover
          ? path.join(METADATA_PATH, id, 'images', localImages.cover)
          : existingGame.metadata?.coverArt,
        screenshots: localImages.screenshots.length
          ? localImages.screenshots.map((s) => path.join(METADATA_PATH, id, 'images', s))
          : existingGame.metadata?.screenshots,
        primaryImage: primaryImage || existingGame.metadata?.primaryImage,
        backdropImage: backdropImage || existingGame.metadata?.backdropImage,
      },
      updated: nowIso,
    };

    await storage.writeEntity<Game>('games', fileKey, updatedGame);

    return NextResponse.json({
      success: true,
      gameId: id,
      message: 'Metadata applied to game successfully',
    } satisfies SaveGameMetadataResponse);
  } catch (error) {
    console.error('Failed to apply scraper metadata to game:', error);
    return NextResponse.json(
      {
        success: false,
        gameId: '',
        message: error instanceof Error ? error.message : 'Unknown error',
      } satisfies SaveGameMetadataResponse,
      { status: 500 }
    );
  }
}
