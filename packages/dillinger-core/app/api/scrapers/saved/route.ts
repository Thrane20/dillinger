import { NextResponse } from 'next/server';
import * as fs from 'fs-extra';
import * as path from 'path';
import type { SavedGameMetadata } from '@dillinger/shared';

const DILLINGER_CORE_PATH = process.env.DILLINGER_CORE_PATH || '/data';
const METADATA_PATH = path.join(DILLINGER_CORE_PATH, 'storage', 'metadata');

// GET /api/scrapers/saved - Get all saved game metadata
export async function GET() {
  try {
    await fs.ensureDir(METADATA_PATH);
    const gameDirs = await fs.readdir(METADATA_PATH);

    const savedGames: SavedGameMetadata[] = [];

    for (const dir of gameDirs) {
      const metadataPath = path.join(METADATA_PATH, dir, 'metadata.json');
      if (await fs.pathExists(metadataPath)) {
        const metadata = await fs.readJSON(metadataPath);
        savedGames.push(metadata);
      }
    }

    return NextResponse.json(savedGames);
  } catch (error) {
    console.error('Failed to get saved games:', error);
    return NextResponse.json(
      { error: 'Failed to get saved games', message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error' },
      { status: 500 }
    );
  }
}
