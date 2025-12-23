import { NextResponse } from 'next/server';
import fs from 'fs-extra';
import path from 'path';

import { JSONStorageService } from '@/lib/services/storage';

export const dynamic = 'force-dynamic';

/**
 * POST /api/settings/maintenance/factory-reset
 * 
 * Deletes all data in the DILLINGER_ROOT directory and resets to initial state.
 * This removes all games, platforms, settings, saves, etc.
 * 
 * WARNING: This is a destructive operation that cannot be undone!
 */
export async function POST() {
  try {
    const storage = JSONStorageService.getInstance();
    const dillingerRoot = storage.getDillingerRoot();

    // Safety check - ensure we're deleting from a valid path
    if (!dillingerRoot || dillingerRoot === '/' || dillingerRoot === '/app') {
      return NextResponse.json(
        { error: 'Invalid DILLINGER_ROOT path - refusing to delete' },
        { status: 400 }
      );
    }

    console.log(`[Factory Reset] Starting factory reset of: ${dillingerRoot}`);

    // Get list of all items in the root directory
    const items = await fs.readdir(dillingerRoot);

    // Delete each item
    for (const item of items) {
      const itemPath = path.join(dillingerRoot, item);
      console.log(`[Factory Reset] Deleting: ${itemPath}`);
      await fs.remove(itemPath);
    }

    console.log(`[Factory Reset] Complete - all data removed from ${dillingerRoot}`);

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
