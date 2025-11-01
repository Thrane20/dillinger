// Scrapers API routes

import { Router } from 'express';
import fs from 'fs-extra';
import path from 'path';
import type {
  SearchGamesRequest,
  SearchGamesResponse,
  GetGameDetailRequest,
  GetGameDetailResponse,
  SaveGameMetadataRequest,
  SaveGameMetadataResponse,
  SavedGameMetadata,
  GameImage,
  ScraperType,
  Game,
} from '@dillinger/shared';
import { generateSlug, generateUniqueSlug } from '@dillinger/shared';
import { getScraperManager } from '../services/scrapers/index.js';
import { JSONStorageService } from '../services/storage.js';

const router = Router();
const scraperManager = getScraperManager();
const storage = JSONStorageService.getInstance();

const DILLINGER_ROOT = process.env.DILLINGER_ROOT || path.join(process.cwd(), 'data');
const METADATA_PATH = path.join(DILLINGER_ROOT, 'storage', 'metadata');

/**
 * POST /api/scrapers/search
 * Search for games using a specific scraper
 */
router.post('/search', async (req, res) => {
  try {
    const { query, scraperType, limit = 10 } = req.body as SearchGamesRequest;

    if (!query || !scraperType) {
      res.status(400).json({
        error: 'Missing required fields: query, scraperType',
      });
      return;
    }

    const results = await scraperManager.search(scraperType, query, limit);

    const response: SearchGamesResponse = {
      results,
      total: results.length,
    };

    res.json(response);
  } catch (error) {
    console.error('Failed to search games:', error);
    res.status(500).json({
      error: 'Failed to search games',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/scrapers/game/:scraperType/:scraperId
 * Get detailed game information
 */
router.get('/game/:scraperType/:scraperId', async (req, res) => {
  try {
    const { scraperType, scraperId } = req.params;

    if (!scraperType || !scraperId) {
      res.status(400).json({
        error: 'Missing required parameters: scraperType, scraperId',
      });
      return;
    }

    const game = await scraperManager.getGameDetail(scraperType as ScraperType, scraperId);

    const response: GetGameDetailResponse = {
      game,
    };

    res.json(response);
  } catch (error) {
    console.error('Failed to get game detail:', error);
    res.status(500).json({
      error: 'Failed to get game detail',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/scrapers/save
 * Save game metadata and optionally download images
 * Also creates a Game entry in the main library
 */
router.post('/save', async (req, res) => {
  try {
    const { scraperId, scraperType, downloadImages = true } = req.body as SaveGameMetadataRequest;

    if (!scraperId || !scraperType) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: scraperId, scraperType',
      });
      return;
    }

    // Get game details
    const gameData = await scraperManager.getGameDetail(scraperType, scraperId);

    // Generate slug from title
    const baseSlug = generateSlug(gameData.title);
    
    // Get existing slugs to ensure uniqueness
    await fs.ensureDir(METADATA_PATH);
    const existingDirs = await fs.readdir(METADATA_PATH);
    const existingSlugs = existingDirs.filter(async (dir) => {
      const metadataPath = path.join(METADATA_PATH, dir, 'metadata.json');
      return await fs.pathExists(metadataPath);
    });

    const slug = generateUniqueSlug(baseSlug, existingSlugs);

    // Use slug as the game ID (not a UUID) for consistency
    const gamePath = path.join(METADATA_PATH, slug);
    const imagesPath = path.join(gamePath, 'images');

    await fs.ensureDir(imagesPath);

    const localImages: SavedGameMetadata['localImages'] = {
      screenshots: [],
      artworks: [],
    };

    // Download images if requested
    if (downloadImages) {
      // Download cover
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

      // Download screenshots
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

      // Download artworks
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
    
    // Auto-select first available image for both primary and backdrop
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
      filePath: '', // Empty until user configures launch
      platformId: '', // Empty until user configures platform
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

    // Add game to library using slug as filename
    await storage.writeEntity<Game>('games', slug, game);

    const response: SaveGameMetadataResponse = {
      success: true,
      gameId: slug,
      message: 'Game metadata saved successfully and added to library',
    };

    res.json(response);
  } catch (error) {
    console.error('Failed to save game metadata:', error);
    res.status(500).json({
      success: false,
      gameId: '',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/scrapers/saved
 * Get all saved game metadata
 */
router.get('/saved', async (req, res) => {
  try {
    await fs.ensureDir(METADATA_PATH);
    const gameDirs = await fs.readdir(METADATA_PATH);

    const savedGames: SavedGameMetadata[] = [];

    for (const dir of gameDirs) {
      const metadataPath = path.join(METADATA_PATH, dir, 'metadata.json');
      if (await fs.pathExists(metadataPath)) {
        const metadata = await fs.readJSON(metadataPath);
        savedGames.push(metadata);
      }
    }

    res.json(savedGames);
  } catch (error) {
    console.error('Failed to get saved games:', error);
    res.status(500).json({
      error: 'Failed to get saved games',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/scrapers/saved/:gameId
 * Get specific saved game metadata (by ID or slug)
 */
router.get('/saved/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    
    // First try as slug (directory name)
    let metadataPath = path.join(METADATA_PATH, gameId, 'metadata.json');
    
    // If not found, search by ID in all directories
    if (!(await fs.pathExists(metadataPath))) {
      const gameDirs = await fs.readdir(METADATA_PATH);
      for (const dir of gameDirs) {
        const dirMetadataPath = path.join(METADATA_PATH, dir, 'metadata.json');
        if (await fs.pathExists(dirMetadataPath)) {
          const metadata = await fs.readJSON(dirMetadataPath);
          if (metadata.id === gameId) {
            metadataPath = dirMetadataPath;
            break;
          }
        }
      }
    }

    if (!(await fs.pathExists(metadataPath))) {
      res.status(404).json({
        error: 'Game not found',
      });
      return;
    }

    const metadata = await fs.readJSON(metadataPath);
    res.json(metadata);
  } catch (error) {
    console.error('Failed to get saved game:', error);
    res.status(500).json({
      error: 'Failed to get saved game',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
