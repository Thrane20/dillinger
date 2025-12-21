import { NextRequest, NextResponse } from 'next/server';
import { getScraperManager } from '@/lib/services/scrapers';
import { SettingsService } from '@/lib/services/settings';
import type {
  SearchGamesRequest,
  SearchGamesResponse,
} from '@dillinger/shared';

const scraperManager = getScraperManager();
const settingsService = SettingsService.getInstance();

// POST /api/scrapers/search - Search for games using a specific scraper
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, scraperType, limit = 10 } = body as SearchGamesRequest;

    if (!query || !scraperType) {
      return NextResponse.json(
        { error: 'Missing required fields: query, scraperType' },
        { status: 400 }
      );
    }

    // Ensure scraper manager is initialized with settings (for authentication)
    const scraperSettings = await settingsService.getScraperSettings();
    await scraperManager.initialize(scraperSettings);

    const results = await scraperManager.search(scraperType, query, limit);

    const response: SearchGamesResponse = {
      results,
      total: results.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to search games:', error);
    return NextResponse.json(
      { error: 'Failed to search games', message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error' },
      { status: 500 }
    );
  }
}
