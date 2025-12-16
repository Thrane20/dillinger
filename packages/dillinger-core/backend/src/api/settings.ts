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
import { getAvailableJoysticks } from '../utils/hardware.js';

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
 * GET /api/settings/gpu
 * Get GPU settings
 */
router.get('/gpu', async (_req, res) => {
  try {
    const settings = await settingsService.getGpuSettings();
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Failed to get GPU settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get GPU settings',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/settings/gpu
 * Update GPU settings
 */
router.post('/gpu', async (req, res) => {
  try {
    const { vendor } = req.body as { vendor?: string };

    if (vendor !== undefined && vendor !== 'auto' && vendor !== 'amd' && vendor !== 'nvidia') {
      res.status(400).json({
        success: false,
        message: "Invalid vendor (expected 'auto' | 'amd' | 'nvidia')",
      });
      return;
    }

    await settingsService.updateGpuSettings({ vendor: vendor as any });
    res.json({ success: true, message: 'GPU settings updated successfully' });
  } catch (error) {
    console.error('Failed to update GPU settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update GPU settings',
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

/**
 * GET /api/settings/joysticks
 * Get available joysticks and saved configuration
 */
router.get('/joysticks', async (req, res) => {
  try {
    const available = await getAvailableJoysticks();
    const settings = await settingsService.getJoystickSettings();
    
    res.json({
      success: true,
      available,
      settings
    });
  } catch (error) {
    console.error('Failed to get joystick settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get joystick settings',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/settings/joysticks
 * Update joystick configuration for a platform
 */
router.post('/joysticks', async (req, res) => {
  try {
    const { platform, deviceId, deviceName } = req.body;
    
    if (!platform || !deviceId) {
      res.status(400).json({
        success: false,
        message: 'Missing platform or deviceId',
      });
      return;
    }

    await settingsService.updateJoystickSettings({
      [platform]: {
        deviceId,
        deviceName: deviceName || 'Unknown Device'
      }
    });
    
    res.json({
      success: true,
      message: `Joystick settings for ${platform} updated successfully`,
    });
  } catch (error) {
    console.error('Failed to update joystick settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update joystick settings',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/settings/platforms/:platformId/config
 * Get platform master configuration file content
 */
router.get('/platforms/:platformId/config', async (req, res) => {
  try {
    const { platformId } = req.params;
    const fs = await import('fs-extra');
    const path = await import('path');
    const { DILLINGER_ROOT } = await import('../services/settings.js');
    
    // Map platform ID to config file path
    // Currently only supporting 'arcade' -> retroarch.cfg
    let configPath = '';
    if (platformId === 'arcade') {
      configPath = path.join(DILLINGER_ROOT, 'storage', 'platform-configs', 'arcade', 'retroarch.cfg');
    } else {
      res.status(400).json({
        success: false,
        message: `Configuration not supported for platform: ${platformId}`,
      });
      return;
    }
    
    if (!await fs.pathExists(configPath)) {
      res.status(404).json({
        success: false,
        message: 'Configuration file not found',
      });
      return;
    }
    
    // Use default export if available (for ESM/CJS interop)
    const readFile = (fs as any).default?.readFile || fs.readFile;
    const content = await readFile(configPath, 'utf-8');
    
    res.json({
      success: true,
      content,
    });
  } catch (error) {
    console.error('Failed to get platform config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get platform config',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/settings/platforms/:platformId/config
 * Update platform master configuration file content
 */
router.post('/platforms/:platformId/config', async (req, res) => {
  try {
    const { platformId } = req.params;
    const { content } = req.body;
    
    if (!content) {
      res.status(400).json({
        success: false,
        message: 'Missing content',
      });
      return;
    }

    const fs = await import('fs-extra');
    const path = await import('path');
    const { DILLINGER_ROOT } = await import('../services/settings.js');
    
    let configPath = '';
    if (platformId === 'arcade') {
      configPath = path.join(DILLINGER_ROOT, 'storage', 'platform-configs', 'arcade', 'retroarch.cfg');
    } else {
      res.status(400).json({
        success: false,
        message: `Configuration not supported for platform: ${platformId}`,
      });
      return;
    }
    
    // Ensure directory exists
    await fs.ensureDir(path.dirname(configPath));
    
    // Write file
    await fs.writeFile(configPath, content, 'utf-8');
    
    res.json({
      success: true,
      message: 'Configuration saved successfully',
    });
  } catch (error) {
    console.error('Failed to update platform config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update platform config',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/settings/platforms/retroarch/launch-gui
 * Launch RetroArch GUI for configuration
 */
router.post('/platforms/retroarch/launch-gui', async (req, res) => {
  try {
    const { v4: uuidv4 } = await import('uuid');
    
    // Create a dummy game object
    const game: any = {
      id: 'retroarch-gui',
      title: 'RetroArch GUI',
      platformId: 'arcade', // Use arcade to trigger RetroArch logic
      filePath: 'MENU', // Special flag for menu mode
      settings: {
        emulator: {
          core: 'mame' // Default core, can be changed in GUI
        }
      }
    };
    
    // Create a dummy platform object
    // We need to get the container image from the actual arcade platform if possible
    // or fallback to a known default
    const platform: any = {
      id: 'arcade',
      type: 'arcade',
      configuration: {
        containerImage: 'dillinger/runner-retroarch:latest'
      }
    };
    
    const sessionId = uuidv4();
    
    const result = await dockerService.launchGame({
      game,
      platform,
      sessionId,
      mode: 'local'
    });
    
    res.json({
      success: true,
      message: 'RetroArch GUI launched',
      containerId: result.containerId
    });
  } catch (error) {
    console.error('Failed to launch RetroArch GUI:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to launch RetroArch GUI',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
