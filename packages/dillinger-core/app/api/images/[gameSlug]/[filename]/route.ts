import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs-extra';
import * as path from 'path';

const DILLINGER_ROOT = process.env.DILLINGER_ROOT || '/data';
const METADATA_PATH = path.join(DILLINGER_ROOT, 'storage', 'metadata');

// GET /api/images/[gameSlug]/[filename] - Serve game images from metadata directory
export async function GET(
  __request: NextRequest,
  { params }: { params: Promise<{ gameSlug: string; filename: string }> }
) {
  try {
    const { gameSlug, filename } = await params;

    // Validate inputs to prevent directory traversal
    if (!gameSlug || !filename || gameSlug.includes('..') || filename.includes('..')) {
      return NextResponse.json(
        { error: 'Invalid game slug or filename' },
        { status: 400 }
      );
    }

    const imagePath = path.join(METADATA_PATH, gameSlug, 'images', filename);

    // Check if file exists
    if (!(await fs.pathExists(imagePath))) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }

    // Determine content type based on extension
    const ext = path.extname(filename).toLowerCase();
    const contentTypeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };

    const contentType = contentTypeMap[ext] || 'application/octet-stream';
    const fileBuffer = await fs.readFile(imagePath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error) {
    console.error('Failed to serve image:', error);
    return NextResponse.json(
      { error: 'Failed to serve image', message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error' },
      { status: 500 }
    );
  }
}
