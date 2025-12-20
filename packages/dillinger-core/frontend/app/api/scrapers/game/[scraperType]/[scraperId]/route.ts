import { NextRequest, NextResponse } from 'next/server';
import { getScraperManager } from '@/lib/services/scrapers';
import { SettingsService } from '@/lib/services/settings';
import type { ScraperType, GetGameDetailResponse } from '@dillinger/shared';

const scraperManager = getScraperManager();
const settingsService = SettingsService.getInstance();

// GET /api/scrapers/game/[scraperType]/[scraperId] - Get detailed game information
export async function GET(
  __request: NextRequest,
  { params }: { params: Promise<{ scraperType: string; scraperId: string }> }
) {
  try {
    const { scraperType, scraperId } = await params;

    if (!scraperType || !scraperId) {
      return NextResponse.json(
        { error: 'Missing required parameters: scraperType, scraperId' },
        { status: 400 }
      );
    }

    // Ensure scraper manager is initialized with settings (for authentication)
    const scraperSettings = await settingsService.getScraperSettings();
    await scraperManager.initialize(scraperSettings);

    const game = await scraperManager.getGameDetail(scraperType as ScraperType, scraperId);

    const response: GetGameDetailResponse = {
      game,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to get game detail:', error);
    return NextResponse.json(
      { error: 'Failed to get game detail', message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error' },
      { status: 500 }
    );
  }
}
