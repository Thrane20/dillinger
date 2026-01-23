import { NextResponse } from 'next/server';
import { JSONStorageService } from '@/lib/services/storage';
import type { Game } from '@dillinger/shared';

// Disable caching for this dynamic route
export const dynamic = 'force-dynamic';

/**
 * GET /api/online-sources/gog/installed
 * Get a map of GOG game IDs that are already in the library
 * Returns { installedGogIds: { [gogId: string]: { gameId, status, installedAt } } }
 */
export async function GET() {
  try {
    const storage = JSONStorageService.getInstance();
    const allGames = await storage.listEntities<Game>('games');
    
    // Build a map of GOG IDs to installation info
    const installedGogIds: Record<string, {
      gameId: string;
      status: string;
      installedAt?: string;
      platformId?: string;
    }> = {};
    
    for (const game of allGames) {
      // Check if this is a GOG game by looking at tags or ID pattern
      const isGogGame = game.tags?.includes('gog') || game.id.startsWith('gog-');
      
      if (!isGogGame) continue;
      
      // Extract GOG ID from the game ID
      // Format: gog-{slug}-{gogId} (e.g., "gog-spelunky-1207659257")
      const gogIdMatch = game.id.match(/(\d{10,})$/);
      if (!gogIdMatch) continue;
      
      const gogId = gogIdMatch[1];
      
      // Get installation status from platforms or deprecated installation field
      let status = 'not_installed';
      let installedAt: string | undefined;
      let platformId: string | undefined;
      
      // Check platforms array first
      if (game.platforms && game.platforms.length > 0) {
        for (const platform of game.platforms) {
          if (platform.installation?.status === 'installed') {
            status = 'installed';
            installedAt = platform.installation.installedAt;
            platformId = platform.platformId;
            break;
          } else if (platform.installation?.status === 'installing') {
            status = 'installing';
            platformId = platform.platformId;
          } else if (platform.installation?.status && status === 'not_installed') {
            status = platform.installation.status;
            platformId = platform.platformId;
          }
        }
      }
      
      // Fall back to deprecated installation field
      if (status === 'not_installed' && game.installation?.status) {
        status = game.installation.status;
        installedAt = game.installation.installedAt;
      }
      
      installedGogIds[gogId] = {
        gameId: game.id,
        status,
        installedAt,
        platformId,
      };
    }
    
    return NextResponse.json({
      installedGogIds,
      total: Object.keys(installedGogIds).length,
    });
    
  } catch (error) {
    console.error('Failed to get installed GOG games:', error);
    return NextResponse.json(
      { error: 'Failed to get installed GOG games', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
