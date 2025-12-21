import { NextRequest, NextResponse } from 'next/server';
import { getScraperManager } from '@/lib/services/scrapers';
import { SettingsService } from '@/lib/services/settings';
import type { ScraperType } from '@dillinger/shared';

const scraperManager = getScraperManager();
const settingsService = SettingsService.getInstance();

// POST /api/scrapers/search-batch - Search for multiple games by title array
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { titles, scraperType, limit = 5 } = body as { titles: string[]; scraperType: ScraperType; limit?: number };

    if (!titles || !Array.isArray(titles) || titles.length === 0 || !scraperType) {
      return NextResponse.json(
        { error: 'Missing required fields: titles (array), scraperType' },
        { status: 400 }
      );
    }

    // Ensure scraper manager is initialized with settings (for authentication)
    const scraperSettings = await settingsService.getScraperSettings();
    await scraperManager.initialize(scraperSettings);

    const allResults = [];
    for (const title of titles) {
      try {
        const results = await scraperManager.search(scraperType, title, limit);
        allResults.push(...results);
      } catch (err) {
        console.error(`Failed to search for "${title}":`, err);
      }
    }

    return NextResponse.json({
      results: allResults,
      total: allResults.length,
    });
  } catch (error) {
    console.error('Failed to batch search games:', error);
    return NextResponse.json(
      { error: 'Failed to batch search games', message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error' },
      { status: 500 }
    );
  }
}
