import { NextRequest, NextResponse } from 'next/server';
import { SettingsService } from '@/lib/services/settings';
import { getScraperManager } from '@/lib/services/scrapers';
import type {
  GetScraperSettingsResponse,
  UpdateScraperSettingsRequest,
  UpdateScraperSettingsResponse,
} from '@dillinger/shared';

const settingsService = SettingsService.getInstance();
const scraperManager = getScraperManager();

// GET /api/settings/scrapers - Get scraper settings and available scrapers
export async function GET() {
  try {
    const settings = await settingsService.getScraperSettings();
    
    // Get base scraper info
    const baseScrapers = scraperManager.getAvailableScrapers();
    
    // Compute "enabled" based on whether credentials are configured
    // (not whether the scraper has authenticated, which requires runtime state)
    const availableScrapers = baseScrapers.map(scraper => {
      let enabled = false;
      if (scraper.type === 'igdb') {
        enabled = !!(settings.igdb?.clientId && settings.igdb?.clientSecret);
      } else if (scraper.type === 'steamgriddb') {
        enabled = !!(settings.steamgriddb?.apiKey);
      } else if (scraper.type === 'giantbomb') {
        enabled = !!(settings.giantbomb?.apiKey);
      }
      return { ...scraper, enabled };
    });

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

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to get scraper settings:', error);
    return NextResponse.json(
      { error: 'Failed to get scraper settings', message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/settings/scrapers - Update scraper settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scraperType, credentials } = body as UpdateScraperSettingsRequest;

    if (!scraperType || !credentials) {
      return NextResponse.json(
        { success: false, message: 'Missing scraperType or credentials' },
        { status: 400 }
      );
    }

    const currentSettings = await settingsService.getScraperSettings();

    // Don't overwrite secrets with masked values - preserve existing if masked
    const MASKED_VALUE = '********';
    
    switch (scraperType) {
      case 'igdb':
        await settingsService.updateScraperSettings({
          ...currentSettings,
          igdb: {
            clientId: credentials.clientId || '',
            // Preserve existing secret if the masked value is sent
            clientSecret: credentials.clientSecret === MASKED_VALUE 
              ? (currentSettings.igdb?.clientSecret || '')
              : (credentials.clientSecret || ''),
          },
        });
        break;

      case 'steamgriddb':
        await settingsService.updateScraperSettings({
          ...currentSettings,
          steamgriddb: {
            // Preserve existing key if the masked value is sent
            apiKey: credentials.apiKey === MASKED_VALUE 
              ? (currentSettings.steamgriddb?.apiKey || '')
              : (credentials.apiKey || ''),
          },
        });
        break;

      case 'giantbomb':
        await settingsService.updateScraperSettings({
          ...currentSettings,
          giantbomb: {
            // Preserve existing key if the masked value is sent
            apiKey: credentials.apiKey === MASKED_VALUE 
              ? (currentSettings.giantbomb?.apiKey || '')
              : (credentials.apiKey || ''),
          },
        });
        break;

      default:
        return NextResponse.json(
          { success: false, message: `Unknown scraper type: ${scraperType}` },
          { status: 400 }
        );
    }

    const updatedSettings = await settingsService.getScraperSettings();
    await scraperManager.initialize(updatedSettings);

    const response: UpdateScraperSettingsResponse = {
      success: true,
      message: `${scraperType} settings updated successfully`,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to update scraper settings:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error' },
      { status: 500 }
    );
  }
}
