import express, { Request, Response, Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { JSONStorageService } from '../services/storage.js';
import { DockerService } from '../services/docker-service.js';

const execAsync = promisify(exec);
const router: Router = express.Router();
const storage = JSONStorageService.getInstance();
const dockerService = DockerService.getInstance();

// Add logging middleware for all routes
router.use((req: Request, res: Response, next) => {
  console.log(`[Volumes API] ${req.method} ${req.path}`);
  next();
});

interface Volume {
  id: string;
  name: string;
  dockerVolumeName: string;
  hostPath: string;
  createdAt: string;
  type: 'docker' | 'bind';
  status: 'active' | 'error';
  lastVerified?: string;
}

/**
 * GET /api/volumes
 * Get all configured volumes
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const volumes = await storage.listEntities<Volume>('volumes');
    res.json({
      success: true,
      data: volumes,
    });
  } catch (error) {
    console.error('Error listing volumes:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list volumes',
    });
  }
});

/**
 * POST /api/volumes
 * Create a new volume (Docker volume or bind mount)
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, hostPath, type = 'bind' } = req.body;

    if (!name || !hostPath) {
      res.status(400).json({
        success: false,
        error: 'Name and hostPath are required',
      });
      return;
    }

    // Sanitize volume name for Docker
    const dockerVolumeName = `dillinger_${name.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;

    let status: 'active' | 'error' = 'active';
    let errorMessage: string | null = null;

    // Create Docker volume with bind mount driver
    if (type === 'docker') {
      try {
        // Create Docker volume with local driver and bind mount option
        const createCmd = `docker volume create --driver local --opt type=none --opt device="${hostPath}" --opt o=bind "${dockerVolumeName}"`;
        await execAsync(createCmd);
      } catch (error) {
        console.error('Error creating Docker volume:', error);
        status = 'error';
        errorMessage = error instanceof Error ? error.message : 'Failed to create Docker volume';
      }
    }

    // Save volume configuration
    const volume: Volume = {
      id: `vol_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      dockerVolumeName,
      hostPath,
      createdAt: new Date().toISOString(),
      type,
      status,
    };

    await storage.writeEntity('volumes', volume.id, volume);

    if (status === 'error') {
      res.status(500).json({
        success: false,
        error: errorMessage || 'Failed to create volume',
        data: volume,
      });
      return;
    }

    res.status(201).json({
      success: true,
      data: volume,
    });
  } catch (error) {
    console.error('Error creating volume:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create volume',
    });
  }
});

/**
 * GET /api/volumes/docker/list
 * List all Docker volumes with their mount points
 */
router.get('/docker/list', async (req: Request, res: Response): Promise<void> => {
  try {
    // Get all Docker volumes with detailed info
    const { stdout } = await execAsync('docker volume ls --format "{{json .}}"');
    const volumeLines = stdout.trim().split('\n').filter(Boolean);
    
    const volumeDetails = await Promise.all(
      volumeLines.map(async (line) => {
        try {
          const volumeInfo = JSON.parse(line);
          const volumeName = volumeInfo.Name;
          
          // Get detailed inspect info for mount point
          const { stdout: inspectOutput } = await execAsync(`docker volume inspect "${volumeName}"`);
          const inspectData = JSON.parse(inspectOutput);
          
          if (inspectData && inspectData[0]) {
            const mountpoint = inspectData[0].Mountpoint;
            const options = inspectData[0].Options || {};
            
            // If it has a device option, that's the host path (bind mount)
            const hostPath = options.device || mountpoint;
            
            return {
              name: volumeName,
              mountpoint: hostPath,
              driver: inspectData[0].Driver,
              createdAt: inspectData[0].CreatedAt,
            };
          }
          
          return {
            name: volumeName,
            mountpoint: null,
            driver: volumeInfo.Driver,
          };
        } catch (err) {
          console.error(`Failed to inspect volume ${line}:`, err);
          return null;
        }
      })
    );

    const volumes = volumeDetails.filter(Boolean);

    res.json({
      success: true,
      data: volumes,
    });
  } catch (error) {
    console.error('Error listing Docker volumes:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list Docker volumes',
    });
  }
});

/**
 * GET /api/volumes/session-volumes
 * List all session save volumes (dillinger_saves_*)
 */
router.get('/session-volumes', async (req: Request, res: Response): Promise<void> => {
  console.log('📊 Listing session volumes...');
  try {
    const volumes = await dockerService.listSessionVolumes();
    console.log(`  Found ${volumes.length} session volumes (${volumes.filter(v => v.inUse).length} active, ${volumes.filter(v => !v.inUse).length} inactive)`);
    
    res.json({
      success: true,
      data: {
        volumes,
        total: volumes.length,
        active: volumes.filter(v => v.inUse).length,
        inactive: volumes.filter(v => !v.inUse).length,
      },
    });
  } catch (error) {
    console.error('❌ Error listing session volumes:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list session volumes',
    });
  }
});

/**
 * DELETE /api/volumes/cleanup-sessions
 * Clean up all inactive session volumes
 */
router.delete('/cleanup-sessions', async (req: Request, res: Response): Promise<void> => {
  console.log('🧹 Starting session volume cleanup...');
  try {
    const result = await dockerService.cleanupInactiveSessionVolumes();
    console.log(`✅ Cleanup complete: ${result.cleaned} cleaned, ${result.failed} failed`);
    
    res.json({
      success: true,
      data: result,
      message: `Cleaned up ${result.cleaned} inactive session volumes${result.failed > 0 ? `, ${result.failed} failed` : ''}`,
    });
  } catch (error) {
    console.error('❌ Error cleaning up session volumes:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cleanup session volumes',
    });
  }
});

/**
 * GET /api/volumes/:id
 * Get a specific volume by ID
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Volume ID is required',
      });
      return;
    }
    
    const volume = await storage.readEntity<Volume>('volumes', id);

    if (!volume) {
      res.status(404).json({
        success: false,
        error: 'Volume not found',
      });
      return;
    }

    res.json({
      success: true,
      data: volume,
    });
  } catch (error) {
    console.error('Error reading volume:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to read volume',
    });
  }
});

/**
 * DELETE /api/volumes/:id
 * Delete a volume
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Volume ID is required',
      });
      return;
    }
    
    const volume = await storage.readEntity<Volume>('volumes', id);

    if (!volume) {
      res.status(404).json({
        success: false,
        error: 'Volume not found',
      });
      return;
    }

    // Remove Docker volume if it exists
    if (volume.type === 'docker') {
      try {
        await execAsync(`docker volume rm "${volume.dockerVolumeName}"`);
      } catch (error) {
        console.warn('Failed to remove Docker volume:', error);
        // Continue with deletion even if Docker removal fails
      }
    }

    await storage.deleteEntity('volumes', id);

    res.json({
      success: true,
      message: 'Volume deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting volume:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete volume',
    });
  }
});

/**
 * GET /api/volumes/docker/list
 * List all Docker volumes with their mount points
 */
router.get('/docker/list', async (req: Request, res: Response): Promise<void> => {
  try {
    // Get all Docker volumes with detailed info
    const { stdout } = await execAsync('docker volume ls --format "{{json .}}"');
    const volumeLines = stdout.trim().split('\n').filter(Boolean);
    
    const volumeDetails = await Promise.all(
      volumeLines.map(async (line) => {
        try {
          const volumeInfo = JSON.parse(line);
          const volumeName = volumeInfo.Name;
          
          // Get detailed inspect info for mount point
          const { stdout: inspectOutput } = await execAsync(`docker volume inspect "${volumeName}"`);
          const inspectData = JSON.parse(inspectOutput);
          
          if (inspectData && inspectData[0]) {
            const mountpoint = inspectData[0].Mountpoint;
            const options = inspectData[0].Options || {};
            
            // If it has a device option, that's the host path (bind mount)
            const hostPath = options.device || mountpoint;
            
            return {
              name: volumeName,
              mountpoint: hostPath,
              driver: inspectData[0].Driver,
              createdAt: inspectData[0].CreatedAt,
            };
          }
          
          return {
            name: volumeName,
            mountpoint: null,
            driver: volumeInfo.Driver,
          };
        } catch (err) {
          console.error(`Failed to inspect volume ${line}:`, err);
          return null;
        }
      })
    );

    const volumes = volumeDetails.filter(Boolean);

    res.json({
      success: true,
      data: volumes,
    });
  } catch (error) {
    console.error('Error listing Docker volumes:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list Docker volumes',
    });
  }
});

/**
 * POST /api/volumes/:id/verify
 * Verify volume status and accessibility
 */
router.post('/:id/verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Volume ID is required',
      });
      return;
    }
    
    const volume = await storage.readEntity<Volume>('volumes', id);

    if (!volume) {
      res.status(404).json({
        success: false,
        error: 'Volume not found',
      });
      return;
    }

    let isAccessible = false;
    let errorMessage: string | null = null;

    if (volume.type === 'docker') {
      try {
        await execAsync(`docker volume inspect "${volume.dockerVolumeName}"`);
        isAccessible = true;
      } catch (error) {
        errorMessage = 'Docker volume not found';
      }
    } else {
      // For bind mounts, check if path exists via filesystem API
      // This would be implemented with fs.access
      isAccessible = true; // Placeholder
    }

    const updatedVolume: Volume = {
      ...volume,
      lastVerified: new Date().toISOString(),
    };

    // Update storage with new status
    await storage.writeEntity('volumes', id, updatedVolume);
    
    res.json({
      success: true,
      data: {
        isAccessible,
        errorMessage,
        volume: updatedVolume,
      },
    });
  } catch (error) {
    console.error('Error verifying volume:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to verify volume',
    });
  }
});

export default router;
