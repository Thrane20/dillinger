import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs-extra';
import * as path from 'path';
import { getScraperManager } from '@/lib/services/scrapers';
import { JSONStorageService } from '@/lib/services/storage';
import { generateSlug, generateUniqueSlug } from '@dillinger/shared';
import type {
  SaveGameMetadataRequest,
  SaveGameMetadataResponse,
  SavedGameMetadata,
  Game,
} from '@dillinger/shared';

const scraperManager = getScraperManager();
const storage = JSONStorageService.getInstance();

const DILLINGER_ROOT = process.env.DILLINGER_ROOT || '/data';
const METADATA_PATH = path.join(DILLINGER_ROOT, 'storage', 'metadata');

// POST /api/scrapers/save - Save game metadata and optionally download images
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scraperId, scraperType, downloadImages = true } = body as SaveGameMetadataRequest;

    if (!scraperId || !scraperType) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: scraperId, scraperType' },
        { status: 400 }
      );
    }

    // Get game details
    const gameData = await scraperManager.getGameDetail(scraperType, scraperId);

    // Generate slug from title
    const baseSlug = generateSlug(gameData.title);
    
    await fs.ensureDir(METADATA_PATH);
    const existingDirs = await fs.readdir(METADATA_PATH);
    const existingSlugs = existingDirs.filter(async (dir) => {
      const metadataPath = path.join(METADATA_PATH, dir, 'metadata.json');
      return await fs.pathExists(metadataPath);
    });

    const slug = generateUniqueSlug(baseSlug, existingSlugs);

    const gamePath = path.join(METADATA_PATH, slug);
    const imagesPath = path.join(gamePath, 'images');

    await fs.ensureDir(imagesPath);

    const localImages: SavedGameMetadata['localImages'] = {
      screenshots: [],
      artworks: [],
    };

    // Download images if requested
    if (downloadImages) {
      if (gameData.cover?.url) {
        try {
          const coverBuffer = await scraperManager.downloadImage(scraperType, gameData.cover.url);
          const coverExt = path.extname(new URL(gameData.cover.url).pathname) || '.jpg';
          const coverFilename = `cover${coverExt}`;
          const coverPath = path.join(imagesPath, coverFilename);
          await fs.writeFile(coverPath, coverBuffer);
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
            const filepath = path.join(imagesPath, filename);
            await fs.writeFile(filepath, buffer);
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
            const filepath = path.join(imagesPath, filename);
            await fs.writeFile(filepath, buffer);
            localImages.artworks.push(filename);
            artwork.localPath = filename;
          } catch (err) {
            console.error(`Failed to download artwork ${i}:`, err);
          }
        }
      }
    }

    // Save metadata
    const savedMetadata: SavedGameMetadata = {
      id: slug,
      slug,
      scraperData: gameData,
      localImages,
      savedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    };

    const metadataPath = path.join(gamePath, 'metadata.json');
    await fs.writeJSON(metadataPath, savedMetadata, { spaces: 2 });

    // Create Game entry for main library
    const now = new Date().toISOString();
    
    let primaryImage = '';
    let backdropImage = '';
    
    if (localImages.cover) {
      primaryImage = `/api/images/${slug}/${localImages.cover}`;
      backdropImage = `/api/images/${slug}/${localImages.cover}`;
    } else if (localImages.screenshots.length > 0) {
      primaryImage = `/api/images/${slug}/${localImages.screenshots[0]}`;
      backdropImage = `/api/images/${slug}/${localImages.screenshots[0]}`;
    } else if (localImages.artworks.length > 0) {
      primaryImage = `/api/images/${slug}/${localImages.artworks[0]}`;
      backdropImage = `/api/images/${slug}/${localImages.artworks[0]}`;
    }
    
    const game: Game = {
      id: slug,
      title: gameData.title,
      slug: gameData.slug || slug,
      filePath: '',
      platformId: '',
      platforms: [],
      collectionIds: [],
      tags: gameData.genres || [],
      metadata: {
        igdbId: scraperType === 'igdb' ? parseInt(gameData.scraperId) : undefined,
        description: gameData.summary,
        genre: gameData.genres,
        developer: gameData.developers?.[0],
        publisher: gameData.publishers?.[0],
        releaseDate: gameData.releaseDate,
        rating: gameData.rating ? Math.round(gameData.rating / 10) : undefined,
        coverArt: localImages.cover ? path.join(METADATA_PATH, slug, 'images', localImages.cover) : undefined,
        screenshots: localImages.screenshots.map((s) => path.join(METADATA_PATH, slug, 'images', s)),
        primaryImage,
        backdropImage,
      },
      fileInfo: {
        size: 0,
        lastModified: now,
      },
      created: now,
      updated: now,
    };

    await storage.writeEntity<Game>('games', slug, game);

    const response: SaveGameMetadataResponse = {
      success: true,
      gameId: slug,
      message: 'Game metadata saved successfully and added to library',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to save game metadata:', error);
    return NextResponse.json(
      { success: false, gameId: '', message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error' },
      { status: 500 }
    );
  }
}
