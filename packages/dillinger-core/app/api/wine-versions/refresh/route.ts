/**
 * Wine Versions Refresh API
 * 
 * POST /api/wine-versions/refresh - Force refresh available versions cache
 */

import { NextResponse } from 'next/server';
import { wineVersionsService } from '@/lib/services/wine-versions';

/**
 * POST /api/wine-versions/refresh
 * Force refresh the available versions cache from upstream APIs
 */
export async function POST() {
  try {
    const index = await wineVersionsService.refreshAvailableVersions(true);
    
    return NextResponse.json({
      success: true,
      lastRefreshed: index.availableCache.lastRefreshed,
      geProtonCount: index.availableCache.geProton.length,
      wineStagingCount: index.availableCache.wineStaging.length,
    });
  } catch (error) {
    console.error('Error refreshing wine versions:', error);
    return NextResponse.json(
      { error: 'Failed to refresh wine versions' },
      { status: 500 }
    );
  }
}
