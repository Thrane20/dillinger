import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import { JSONStorageService } from '../services/storage.js';

const router = Router();
const storage = JSONStorageService.getInstance();

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      const dillingerRoot = storage.getDillingerRoot();
      const { platformId } = req.params;
      
      if (!platformId) {
        cb(new Error('Platform ID is required'), '');
        return;
      }

      // Determine destination based on platform
      let destPath = path.join(dillingerRoot, 'bios');
      
      if (platformId === 'amiga') {
        destPath = path.join(destPath, 'amiga');
      } else {
        // Default to platform-specific subdirectory
        destPath = path.join(destPath, platformId);
      }
      
      await fs.ensureDir(destPath);
      cb(null, destPath);
    },
    filename: (req, file, cb) => {
      // Keep original filename
      cb(null, file.originalname);
    }
  })
});

/**
 * POST /api/platforms/:platformId/bios
 * Upload BIOS files for a specific platform
 */
router.post('/:platformId/bios', upload.array('files'), (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No files uploaded' });
      return;
    }
    
    res.json({
      success: true,
      message: `Uploaded ${files.length} files`,
      files: files.map(f => ({
        filename: f.originalname,
        size: f.size,
        path: f.path
      }))
    });
  } catch (error) {
    console.error('Error uploading BIOS files:', error);
    res.status(500).json({
      error: 'upload_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/platforms/:platformId/bios
 * List uploaded BIOS files for a specific platform
 */
router.get('/:platformId/bios', async (req, res) => {
  try {
    const { platformId } = req.params;
    const dillingerRoot = storage.getDillingerRoot();
    
    let biosPath = path.join(dillingerRoot, 'bios');
    if (platformId === 'amiga') {
      biosPath = path.join(biosPath, 'amiga');
    } else {
      biosPath = path.join(biosPath, platformId);
    }
    
    if (!(await fs.pathExists(biosPath))) {
      res.json({ files: [] });
      return;
    }
    
    const files = await fs.readdir(biosPath);
    const fileDetails = await Promise.all(files.map(async (file) => {
      const filePath = path.join(biosPath, file);
      const stats = await fs.stat(filePath);
      return {
        name: file,
        size: stats.size,
        modified: stats.mtime
      };
    }));
    
    res.json({ files: fileDetails });
  } catch (error) {
    console.error('Error listing BIOS files:', error);
    res.status(500).json({
      error: 'list_failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
