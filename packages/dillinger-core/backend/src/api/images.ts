// Images API routes - serve scraped game images

import { Router } from 'express';
import fs from 'fs-extra';
import path from 'path';

const router = Router();

const DILLINGER_ROOT = process.env.DILLINGER_ROOT || path.join(process.cwd(), 'data');
const METADATA_PATH = path.join(DILLINGER_ROOT, 'storage', 'metadata');

/**
 * GET /api/images/:gameSlug/:filename
 * Serve game images from metadata directory
 */
router.get('/:gameSlug/:filename', async (req, res) => {
  try {
    const { gameSlug, filename } = req.params;

    // Validate inputs to prevent directory traversal
    if (!gameSlug || !filename || gameSlug.includes('..') || filename.includes('..')) {
      res.status(400).json({
        error: 'Invalid game slug or filename',
      });
      return;
    }

    const imagePath = path.join(METADATA_PATH, gameSlug, 'images', filename);

    // Check if file exists
    if (!(await fs.pathExists(imagePath))) {
      res.status(404).json({
        error: 'Image not found',
      });
      return;
    }

    // Determine content type based on extension
    const ext = path.extname(filename).toLowerCase();
    const contentType: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };

    res.setHeader('Content-Type', contentType[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

    // Stream the file
    const fileStream = fs.createReadStream(imagePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Failed to serve image:', error);
    res.status(500).json({
      error: 'Failed to serve image',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
