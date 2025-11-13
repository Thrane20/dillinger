// Settings API routes

import { Router } from 'express';
import type {
  GetScraperSettingsResponse,
  UpdateScraperSettingsRequest,
  UpdateScraperSettingsResponse,
} from '@dillinger/shared';
import { SettingsService } from '../services/settings.js';
import { getScraperManager } from '../services/scrapers/index.js';
import { DockerService } from '../services/docker-service.js';

const router = Router();
const settingsService = SettingsService.getInstance();
const scraperManager = getScraperManager();
const dockerService = DockerService.getInstance();

/**
 * GET /api/settings/scrapers
 * Get scraper settings and available scrapers
 */
router.get('/scrapers', async (req, res) => {
  try {
    const settings = await settingsService.getScraperSettings();
    const availableScrapers = scraperManager.getAvailableScrapers();

    // Sanitize settings - show client ID but mask client secret
    const sanitizedSettings = {
      igdb: settings.igdb
        ? {
            clientId: settings.igdb.clientId || '',
            clientSecret: settings.igdb.clientSecret ? '********' : '',
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

/**
 * GET /api/settings/audio
 * Get audio settings and available sinks
 */
router.get('/audio', async (req, res) => {
  try {
    const settings = await settingsService.getAudioSettings();
    const availableSinks = await dockerService.getAvailableAudioSinks();

    res.json({
      settings,
      availableSinks,
    });
  } catch (error) {
    console.error('Failed to get audio settings:', error);
    res.status(500).json({
      error: 'Failed to get audio settings',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/settings/audio
 * Update audio settings
 */
router.post('/audio', async (req, res) => {
  try {
    const { defaultSink } = req.body;

    if (!defaultSink) {
      res.status(400).json({
        success: false,
        message: 'Missing defaultSink',
      });
      return;
    }

    await settingsService.updateAudioSettings({ defaultSink });

    res.json({
      success: true,
      message: 'Audio settings updated successfully',
    });
  } catch (error) {
    console.error('Failed to update audio settings:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/settings/docker
 * Get Docker settings
 */
router.get('/docker', async (req, res) => {
  try {
    const settings = await settingsService.getDockerSettings();
    res.json({ settings });
  } catch (error) {
    console.error('Failed to get Docker settings:', error);
    res.status(500).json({
      error: 'Failed to get Docker settings',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/settings/docker
 * Update Docker settings
 */
router.post('/docker', async (req, res) => {
  try {
    const { autoRemoveContainers } = req.body;

    await settingsService.updateDockerSettings({ autoRemoveContainers });

    res.json({
      success: true,
      message: 'Docker settings updated successfully',
    });
  } catch (error) {
    console.error('Failed to update Docker settings:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/settings/maintenance/cleanup-containers
 * Clean up stopped game containers
 */
router.post('/maintenance/cleanup-containers', async (req, res) => {
  try {
    const result = await dockerService.cleanupStoppedContainers();
    
    res.json({
      success: true,
      message: `Cleaned up ${result.removed} stopped container(s)`,
      removed: result.removed,
      containers: result.containers,
    });
  } catch (error) {
    console.error('Failed to cleanup containers:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/settings/maintenance/cleanup-volumes
 * Clean up orphaned Docker volumes
 */
router.post('/maintenance/cleanup-volumes', async (req, res) => {
  try {
    const result = await dockerService.cleanupOrphanedVolumes();
    
    res.json({
      success: true,
      message: `Cleaned up ${result.removed} orphaned volume(s)`,
      removed: result.removed,
      volumes: result.volumes,
    });
  } catch (error) {
    console.error('Failed to cleanup volumes:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/settings/gog
 * Get GOG settings
 */
router.get('/gog', async (req, res) => {
  try {
    const settings = await settingsService.getGOGSettings();
    
    res.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error('Failed to get GOG settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get GOG settings',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/settings/gog
 * Update GOG settings
 */
router.put('/gog', async (req, res) => {
  try {
    const { accessCode } = req.body;
    
    await settingsService.updateGOGSettings({ accessCode });
    
    res.json({
      success: true,
      message: 'GOG settings updated successfully',
    });
  } catch (error) {
    console.error('Failed to update GOG settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update GOG settings',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/settings/downloads
 * Get download settings
 */
router.get('/downloads', async (_req, res) => {
  try {
    const settings = await settingsService.getDownloadSettings();
    res.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error('Failed to get download settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get download settings',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PUT /api/settings/downloads
 * Update download settings
 */
router.put('/downloads', async (req, res) => {
  try {
    const { maxConcurrent } = req.body;
    
    if (maxConcurrent !== undefined) {
      // Validate range
      const validated = Math.max(1, Math.min(maxConcurrent, 10));
      await settingsService.updateDownloadSettings({ maxConcurrent: validated });
      
      // Update the download manager
      const { DownloadManager } = await import('../services/download-manager.js');
      DownloadManager.getInstance().setMaxConcurrentDownloads(validated);
    }
    
    res.json({
      success: true,
      message: 'Download settings updated successfully',
    });
  } catch (error) {
    console.error('Failed to update download settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update download settings',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
