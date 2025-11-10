#!/usr/bin/env tsx

/**
 * Initialize data directory structure for Dillinger Game Library Manager
 * 
 * This script creates the required directory structure and initial files
 * for the JSON-based storage system.
 */

import fs from 'fs-extra';
import path from 'path';
import { JSONStorageService } from '../services/storage.js';
import type { Platform } from '@dillinger/shared';
import { generateUUID, createTimestamp } from '@dillinger/shared';

// Use the same logic as storage service - points to dillinger_root volume
const DATA_PATH = process.env.DILLINGER_ROOT || '/data';

async function initializeDataDirectories() {
  console.log('🗂️  Initializing Dillinger data directories...');
  console.log(`📁 Data path: ${DATA_PATH}`);

  try {
    // Create main data directory
    await fs.ensureDir(DATA_PATH);
    console.log('✅ Created main data directory');

    // Initialize storage service to create subdirectories
    const storage = JSONStorageService.getInstance();
    await storage.ensureDirectories();
    console.log('✅ Created entity subdirectories');

    // Create additional directories for game files and assets
    const additionalDirs = [
      'assets/covers',
      'assets/screenshots', 
      'assets/videos',
      'cache/metadata',
      'cache/thumbnails',
      'logs',
      'backups',
      'tmp'
    ];

    for (const dir of additionalDirs) {
      await fs.ensureDir(path.join(DATA_PATH, dir));
    }
    console.log('✅ Created additional directories');

    // Create initial configuration files
    await createInitialConfig();
    console.log('✅ Created initial configuration');

    // Create default platforms
    await createDefaultPlatforms(storage);
    console.log('✅ Created default platforms');

    // Create README file
    await createReadmeFile();
    console.log('✅ Created README file');

    console.log('');
    console.log('🎉 Data directory initialization complete!');
    console.log('');
    console.log('Directory structure:');
    await listDirectoryStructure(DATA_PATH);

  } catch (error) {
    console.error('❌ Failed to initialize data directories:', error);
    process.exit(1);
  }
}

async function createInitialConfig() {
  const configPath = path.join(DATA_PATH, 'config.json');
  
  const config = {
    version: '1.0.0',
    initialized: createTimestamp(),
    settings: {
      autoScrapeMetadata: true,
      defaultMetadataSource: 'igdb',
      maxCacheAge: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
      thumbnailSize: { width: 300, height: 400 },
      screenshotSize: { width: 1920, height: 1080 },
      backupRetention: 7, // days
      logLevel: 'info'
    },
    paths: {
      data: DATA_PATH,
      assets: path.join(DATA_PATH, 'assets'),
      cache: path.join(DATA_PATH, 'cache'),
      logs: path.join(DATA_PATH, 'logs'),
      backups: path.join(DATA_PATH, 'backups'),
      tmp: path.join(DATA_PATH, 'tmp')
    }
  };

  await fs.writeJson(configPath, config, { spaces: 2 });
}

async function createDefaultPlatforms(storage: JSONStorageService) {
  const defaultPlatforms: Omit<Platform, 'id' | 'created' | 'updated'>[] = [
    {
      name: 'Linux Native',
      type: 'native',
      description: 'Native Linux games and applications',
      configuration: {
        containerImage: 'dillinger/linux-native:latest',
        supportedExtensions: ['', '.sh', '.run', '.AppImage'],
        requiredFiles: [],
        defaultSettings: {
          environment: {
            'DISPLAY': ':0',
            'XDG_RUNTIME_DIR': '/tmp/runtime-dillinger'
          }
        }
      },
      validation: {
        fileValidation: ['', '.sh', '.run', '.AppImage'],
        pathValidation: '^/.*',
        requiresBios: false
      },
      displayStreaming: {
        method: 'games-on-whales',
        configuration: {
          resolution: '1920x1080',
          framerate: 60,
          codec: 'h264'
        }
      },
      isActive: true
    },
    {
      name: 'Windows (Wine)',
      type: 'wine',
      description: 'Windows games running through Wine/Proton',
      configuration: {
        containerImage: 'dillinger/wine:latest',
        supportedExtensions: ['.exe', '.msi', '.bat'],
        requiredFiles: [],
        defaultSettings: {
          wine: {
            version: '8.0',
            defaultDlls: {
              'msvcr120': 'native',
              'msvcp120': 'native',
              'd3d11': 'native'
            }
          },
          environment: {
            'WINEPREFIX': '/tmp/wine-prefix',
            'WINEDEBUG': '-all'
          }
        }
      },
      validation: {
        fileValidation: ['.exe', '.msi', '.bat'],
        pathValidation: '^/.*\\.(exe|msi|bat)$',
        requiresBios: false
      },
      displayStreaming: {
        method: 'games-on-whales',
        configuration: {
          resolution: '1920x1080',
          framerate: 60,
          codec: 'h264'
        }
      },
      isActive: true
    },
    {
      name: 'RetroArch (Multi-Emulator)',
      type: 'emulator',
      description: 'Retro games through RetroArch emulation',
      configuration: {
        containerImage: 'dillinger/retroarch:latest',
        supportedExtensions: ['.iso', '.bin', '.cue', '.rom', '.smc', '.sfc', '.gb', '.gbc', '.gba', '.nes', '.smd', '.md'],
        requiredFiles: [],
        defaultSettings: {
          emulator: {
            core: 'auto-detect',
            biosFiles: ['bios.bin', 'scph1001.bin']
          },
          environment: {
            'RETROARCH_CONFIG': '/config/retroarch.cfg'
          }
        }
      },
      validation: {
        fileValidation: ['.iso', '.bin', '.cue', '.rom', '.smc', '.sfc', '.gb', '.gbc', '.gba', '.nes', '.smd', '.md'],
        pathValidation: '^/.*\\.(iso|bin|cue|rom|smc|sfc|gb|gbc|gba|nes|smd|md)$',
        requiresBios: true,
        biosPath: '/bios'
      },
      displayStreaming: {
        method: 'games-on-whales',
        configuration: {
          resolution: '1920x1080',
          framerate: 60,
          codec: 'h264',
          scanlines: false,
          smoothing: true
        }
      },
      isActive: false // Disabled by default until BIOS files are provided
    },
    {
      name: 'Commodore 64',
      type: 'emulator',
      description: 'Commodore 64 games through VICE emulator',
      configuration: {
        containerImage: 'dillinger/runner-vice:latest',
        supportedExtensions: ['.d64', '.d81', '.t64', '.prg', '.crt', '.tap', '.g64', '.zip'],
        requiredFiles: [],
        defaultSettings: {
          emulator: {
            core: 'vice',
          }
        }
      },
      validation: {
        fileValidation: ['.d64', '.d81', '.t64', '.prg', '.crt', '.tap', '.g64', '.zip'],
        pathValidation: '^/.*\\.(d64|d81|t64|prg|crt|tap|g64|zip)$',
        requiresBios: false
      },
      displayStreaming: {
        method: 'games-on-whales',
        configuration: {
          resolution: '1920x1080',
          framerate: 60,
          codec: 'h264'
        }
      },
      isActive: true
    },
    {
      name: 'Commodore 128',
      type: 'emulator',
      description: 'Commodore 128 games through VICE emulator',
      configuration: {
        containerImage: 'dillinger/runner-vice:latest',
        supportedExtensions: ['.d64', '.d81', '.t64', '.prg', '.crt', '.tap', '.g64', '.zip'],
        requiredFiles: [],
        defaultSettings: {
          emulator: {
            core: 'vice',
          }
        }
      },
      validation: {
        fileValidation: ['.d64', '.d81', '.t64', '.prg', '.crt', '.tap', '.g64', '.zip'],
        pathValidation: '^/.*\\.(d64|d81|t64|prg|crt|tap|g64|zip)$',
        requiresBios: false
      },
      displayStreaming: {
        method: 'games-on-whales',
        configuration: {
          resolution: '1920x1080',
          framerate: 60,
          codec: 'h264'
        }
      },
      isActive: true
    },
    {
      name: 'VIC-20',
      type: 'emulator',
      description: 'VIC-20 games through VICE emulator',
      configuration: {
        containerImage: 'dillinger/runner-vice:latest',
        supportedExtensions: ['.d64', '.t64', '.prg', '.crt', '.tap', '.zip'],
        requiredFiles: [],
        defaultSettings: {
          emulator: {
            core: 'vice',
          }
        }
      },
      validation: {
        fileValidation: ['.d64', '.t64', '.prg', '.crt', '.tap', '.zip'],
        pathValidation: '^/.*\\.(d64|t64|prg|crt|tap|zip)$',
        requiresBios: false
      },
      displayStreaming: {
        method: 'games-on-whales',
        configuration: {
          resolution: '1920x1080',
          framerate: 60,
          codec: 'h264'
        }
      },
      isActive: true
    },
    {
      name: 'Commodore Plus/4',
      type: 'emulator',
      description: 'Commodore Plus/4 games through VICE emulator',
      configuration: {
        containerImage: 'dillinger/runner-vice:latest',
        supportedExtensions: ['.d64', '.t64', '.prg', '.crt', '.tap', '.zip'],
        requiredFiles: [],
        defaultSettings: {
          emulator: {
            core: 'vice',
          }
        }
      },
      validation: {
        fileValidation: ['.d64', '.t64', '.prg', '.crt', '.tap', '.zip'],
        pathValidation: '^/.*\\.(d64|t64|prg|crt|tap|zip)$',
        requiresBios: false
      },
      displayStreaming: {
        method: 'games-on-whales',
        configuration: {
          resolution: '1920x1080',
          framerate: 60,
          codec: 'h264'
        }
      },
      isActive: true
    },
    {
      name: 'Commodore PET',
      type: 'emulator',
      description: 'Commodore PET games through VICE emulator',
      configuration: {
        containerImage: 'dillinger/runner-vice:latest',
        supportedExtensions: ['.d64', '.t64', '.prg', '.tap', '.zip'],
        requiredFiles: [],
        defaultSettings: {
          emulator: {
            core: 'vice',
          }
        }
      },
      validation: {
        fileValidation: ['.d64', '.t64', '.prg', '.tap', '.zip'],
        pathValidation: '^/.*\\.(d64|t64|prg|tap|zip)$',
        requiresBios: false
      },
      displayStreaming: {
        method: 'games-on-whales',
        configuration: {
          resolution: '1920x1080',
          framerate: 60,
          codec: 'h264'
        }
      },
      isActive: true
    }
  ];

  for (const platformData of defaultPlatforms) {
    const platform: Platform = {
      ...platformData,
      id: generateUUID(),
      created: createTimestamp(),
      updated: createTimestamp()
    };

    await storage.writeEntity('platforms', platform.id, platform);
    console.log(`  📦 Created platform: ${platform.name}`);
  }
}

async function createReadmeFile() {
  const readmePath = path.join(DATA_PATH, 'README.md');
  
  const readme = `# Dillinger Game Library Data

This directory contains the JSON-based storage for your Dillinger Game Library Manager.

## Directory Structure

- \`games/\` - Individual game JSON files and game index
- \`platforms/\` - Platform configuration files and platform index  
- \`sessions/\` - Game session data and session index
- \`collections/\` - Game collection definitions and collection index
- \`metadata/\` - Cached metadata from external sources
- \`assets/\` - Game artwork, screenshots, and other media assets
- \`cache/\` - Temporary cached data and thumbnails
- \`logs/\` - Application logs
- \`backups/\` - Automated backups of critical data
- \`tmp/\` - Temporary files

## Storage Format

All entities are stored as individual JSON files with UUID filenames:
- Games: \`games/{uuid}.json\`
- Platforms: \`platforms/{uuid}.json\`
- Sessions: \`sessions/{uuid}.json\`
- Collections: \`collections/{uuid}.json\`

Index files (\`index.json\`) in each directory provide optimized lookup tables for performance.

## Backup and Maintenance

- Automated backups are created daily and stored in \`backups/\`
- Cache files can be safely deleted and will be regenerated
- Index files are automatically rebuilt when entities are modified
- Log files are rotated automatically to prevent disk space issues

## Configuration

See \`config.json\` for system-wide settings and paths.

## Security

- This directory should have restricted access (readable only by the Dillinger user)
- Game files referenced by the library are not stored here (only metadata)
- Backup files may contain sensitive information and should be secured

---

Generated by Dillinger Game Library Manager
Initialized: ${createTimestamp()}
`;

  await fs.writeFile(readmePath, readme);
}

async function listDirectoryStructure(dirPath: string, prefix: string = '', maxDepth: number = 3, currentDepth: number = 0) {
  if (currentDepth >= maxDepth) return;
  
  try {
    const items = await fs.readdir(dirPath);
    const sorted = items.sort();
    
    for (let i = 0; i < sorted.length; i++) {
      const item = sorted[i];
      if (!item) continue;
      const itemPath = path.join(dirPath, item);
      const isLast = i === sorted.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      
      try {
        const stats = await fs.stat(itemPath);
        if (stats.isDirectory()) {
          console.log(`${prefix}${connector}${item}/`);
          const nextPrefix = prefix + (isLast ? '    ' : '│   ');
          await listDirectoryStructure(itemPath, nextPrefix, maxDepth, currentDepth + 1);
        } else {
          console.log(`${prefix}${connector}${item}`);
        }
      } catch (error) {
        console.log(`${prefix}${connector}${item} (inaccessible)`);
      }
    }
  } catch (error) {
    console.log(`${prefix}(error reading directory)`);
  }
}

// Run the initialization if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDataDirectories().catch((error) => {
    console.error('Initialization failed:', error);
    process.exit(1);
  });
}

export { initializeDataDirectories };