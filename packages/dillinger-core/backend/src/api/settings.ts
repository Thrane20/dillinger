// Settings API routes

import { Router } from 'express';
import type {
  GetScraperSettingsResponse,
  UpdateScraperSettingsRequest,
  UpdateScraperSettingsResponse,
} from '@dillinger/shared';
import { SettingsService } from '../services/settings.js';
import { getScraperManager } from '../services/scrapers/index.js';

const router = Router();
const settingsService = SettingsService.getInstance();
const scraperManager = getScraperManager();

/**
 * GET /api/settings/scrapers
 * Get scraper settings and available scrapers
 */
router.get('/scrapers', async (req, res) => {
  try {
    const settings = await settingsService.getScraperSettings();
    const availableScrapers = scraperManager.getAvailableScrapers();

    // Sanitize settings - don't send full credentials to client
    const sanitizedSettings = {
      igdb: settings.igdb
        ? {
            clientId: settings.igdb.clientId ? '***' : '',
            clientSecret: settings.igdb.clientSecret ? '***' : '',
            configured: !!(settings.igdb.clientId && settings.igdb.clientSecret),
          }
        : { configured: false },
    };

    const response: GetScraperSettingsResponse = {
      settings: sanitizedSettings as any,
      availableScrapers,
    };

    res.json(response);
  } catch (error) {
    console.error('Failed to get scraper settings:', error);
    res.status(500).json({
      error: 'Failed to get scraper settings',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/settings/scrapers
 * Update scraper settings
 */
router.post('/scrapers', async (req, res) => {
  try {
    const { scraperType, credentials } = req.body as UpdateScraperSettingsRequest;

    if (!scraperType || !credentials) {
      res.status(400).json({
        success: false,
        message: 'Missing scraperType or credentials',
      });
      return;
    }

    // Update settings based on scraper type
    const currentSettings = await settingsService.getScraperSettings();

    switch (scraperType) {
      case 'igdb':
        await settingsService.updateScraperSettings({
          ...currentSettings,
          igdb: {
            clientId: credentials.clientId || '',
            clientSecret: credentials.clientSecret || '',
          },
        });
        break;

      case 'steamgriddb':
        await settingsService.updateScraperSettings({
          ...currentSettings,
          steamgriddb: {
            apiKey: credentials.apiKey || '',
          },
        });
        break;

      case 'giantbomb':
        await settingsService.updateScraperSettings({
          ...currentSettings,
          giantbomb: {
            apiKey: credentials.apiKey || '',
          },
        });
        break;

      default:
        res.status(400).json({
          success: false,
          message: `Unknown scraper type: ${scraperType}`,
        });
        return;
    }

    // Reinitialize scraper manager with new settings
    const updatedSettings = await settingsService.getScraperSettings();
    await scraperManager.initialize(updatedSettings);

    const response: UpdateScraperSettingsResponse = {
      success: true,
      message: `${scraperType} settings updated successfully`,
    };

    res.json(response);
  } catch (error) {
    console.error('Failed to update scraper settings:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
