import { NextResponse } from 'next/server';
import fs from 'fs-extra';
import path from 'path';

import { JSONStorageService } from '@/lib/services/storage';

export const dynamic = 'force-dynamic';

/**
 * POST /api/settings/maintenance/factory-reset
 * 
 * Deletes all data in the DILLINGER_CORE_PATH directory and resets to initial state.
 * This removes all games, platforms, settings, saves, etc.
 * 
 * WARNING: This is a destructive operation that cannot be undone!
 */
export async function POST() {
  try {
    const storage = JSONStorageService.getInstance();
    const dillingerCorePath = storage.getDillingerCorePath();

    // Safety check - ensure we're deleting from a valid path
    if (!dillingerCorePath || dillingerCorePath === '/' || dillingerCorePath === '/app') {
      return NextResponse.json(
        { error: 'Invalid DILLINGER_CORE_PATH path - refusing to delete' },
        { status: 400 }
      );
    }

    console.log(`[Factory Reset] Starting factory reset of: ${dillingerCorePath}`);

    // Get list of all items in the root directory
    const items = await fs.readdir(dillingerCorePath);

    // Delete each item
    for (const item of items) {
      const itemPath = path.join(dillingerCorePath, item);
      console.log(`[Factory Reset] Deleting: ${itemPath}`);
      await fs.remove(itemPath);
    }

    console.log(`[Factory Reset] Complete - all data removed from ${dillingerCorePath}`);

    return NextResponse.json({
      ok: true,
      message: 'Factory reset complete. All data has been deleted.',
      deletedItems: items.length,
    });
  } catch (error) {
    console.error('[Factory Reset] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to perform factory reset',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
