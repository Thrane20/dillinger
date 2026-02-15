import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs-extra';
import * as path from 'path';

const DILLINGER_CORE_PATH = process.env.DILLINGER_CORE_PATH || '/data';
const METADATA_PATH = path.join(DILLINGER_CORE_PATH, 'storage', 'metadata');

// GET /api/scrapers/saved/[gameId] - Get specific saved game metadata
export async function GET(
  __request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    
    // First try as slug (directory name)
    let metadataPath = path.join(METADATA_PATH, gameId, 'metadata.json');
    
    // If not found, search by ID in all directories
    if (!(await fs.pathExists(metadataPath))) {
      const gameDirs = await fs.readdir(METADATA_PATH);
      for (const dir of gameDirs) {
        const dirMetadataPath = path.join(METADATA_PATH, dir, 'metadata.json');
        if (await fs.pathExists(dirMetadataPath)) {
          const metadata = await fs.readJSON(dirMetadataPath);
          if (metadata.id === gameId) {
            metadataPath = dirMetadataPath;
            break;
          }
        }
      }
    }

    if (!(await fs.pathExists(metadataPath))) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    const metadata = await fs.readJSON(metadataPath);
    return NextResponse.json(metadata);
  } catch (error) {
    console.error('Failed to get saved game:', error);
    return NextResponse.json(
      { error: 'Failed to get saved game', message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error' },
      { status: 500 }
    );
  }
}
