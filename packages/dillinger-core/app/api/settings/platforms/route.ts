import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs-extra';
import * as path from 'path';

const DILLINGER_ROOT = process.env.DILLINGER_ROOT || '/data';
const SETTINGS_FILE = path.join(DILLINGER_ROOT, 'storage', 'settings.json');

// Platform settings type definitions
export interface NesSettings {
  core: 'nestopia' | 'fceumm' | 'mesen';
  region: 'auto' | 'ntsc' | 'pal';
}

export interface SnesSettings {
  core: 'snes9x' | 'bsnes' | 'bsnes_hd';
  region: 'auto' | 'ntsc' | 'pal';
  superfxOverclock: boolean;
}

export interface ArcadeSettings {
  videoMode: 'opengl' | 'bgfx' | 'soft';
}

export interface C64Settings {
  trueDriveEmulation: boolean;
  warpMode: boolean;
}

export interface WineSettings {
  architecture: 'win64' | 'win32';
  renderer: 'vulkan' | 'opengl';
}

export interface PsxSettings {
  core: 'beetle_psx_hw';
  region: 'auto' | 'ntsc-u' | 'ntsc-j' | 'pal';
  internalResolution: '1x' | '2x' | '4x' | '8x';
  pgxp: boolean;
  fullscreen: boolean;
}

export interface PlatformSettings {
  nes?: NesSettings;
  snes?: SnesSettings;
  arcade?: ArcadeSettings;
  c64?: C64Settings;
  wine?: WineSettings;
  psx?: PsxSettings;
}

// Required version for full settings object
interface RequiredPlatformSettings {
  nes: NesSettings;
  snes: SnesSettings;
  arcade: ArcadeSettings;
  c64: C64Settings;
  wine: WineSettings;
  psx: PsxSettings;
}

// Default settings
const DEFAULT_SETTINGS: RequiredPlatformSettings = {
  nes: {
    core: 'nestopia',
    region: 'auto',
  },
  snes: {
    core: 'snes9x',
    region: 'auto',
    superfxOverclock: false,
  },
  arcade: {
    videoMode: 'opengl',
  },
  c64: {
    trueDriveEmulation: true,
    warpMode: false,
  },
  wine: {
    architecture: 'win64',
    renderer: 'vulkan',
  },
  psx: {
    core: 'beetle_psx_hw',
    region: 'auto',
    internalResolution: '2x',
    pgxp: true,
    fullscreen: false,
  },
};

async function readSettings(): Promise<Record<string, unknown>> {
  try {
    if (await fs.pathExists(SETTINGS_FILE)) {
      return await fs.readJson(SETTINGS_FILE);
    }
  } catch (error) {
    console.error('Error reading settings file:', error);
  }
  return {};
}

async function writeSettings(settings: Record<string, unknown>): Promise<void> {
  await fs.ensureDir(path.dirname(SETTINGS_FILE));
  await fs.writeJson(SETTINGS_FILE, settings, { spaces: 2 });
}

// GET /api/settings/platforms - Get all platform settings
export async function GET() {
  try {
    const settings = await readSettings();
    const platformSettings = (settings.platforms || {}) as Partial<PlatformSettings>;
    
    // Merge with defaults - ensure all required fields have values
    const mergedSettings: RequiredPlatformSettings = {
      nes: {
        core: platformSettings.nes?.core ?? DEFAULT_SETTINGS.nes.core,
        region: platformSettings.nes?.region ?? DEFAULT_SETTINGS.nes.region,
      },
      snes: {
        core: platformSettings.snes?.core ?? DEFAULT_SETTINGS.snes.core,
        region: platformSettings.snes?.region ?? DEFAULT_SETTINGS.snes.region,
        superfxOverclock: platformSettings.snes?.superfxOverclock ?? DEFAULT_SETTINGS.snes.superfxOverclock,
      },
      arcade: {
        videoMode: platformSettings.arcade?.videoMode ?? DEFAULT_SETTINGS.arcade.videoMode,
      },
      c64: {
        trueDriveEmulation: platformSettings.c64?.trueDriveEmulation ?? DEFAULT_SETTINGS.c64.trueDriveEmulation,
        warpMode: platformSettings.c64?.warpMode ?? DEFAULT_SETTINGS.c64.warpMode,
      },
      wine: {
        architecture: platformSettings.wine?.architecture ?? DEFAULT_SETTINGS.wine.architecture,
        renderer: platformSettings.wine?.renderer ?? DEFAULT_SETTINGS.wine.renderer,
      },
      psx: {
        core: platformSettings.psx?.core ?? DEFAULT_SETTINGS.psx.core,
        region: platformSettings.psx?.region ?? DEFAULT_SETTINGS.psx.region,
        internalResolution: platformSettings.psx?.internalResolution ?? DEFAULT_SETTINGS.psx.internalResolution,
        pgxp: platformSettings.psx?.pgxp ?? DEFAULT_SETTINGS.psx.pgxp,
        fullscreen: platformSettings.psx?.fullscreen ?? DEFAULT_SETTINGS.psx.fullscreen,
      },
    };
    
    return NextResponse.json({
      success: true,
      settings: mergedSettings,
    });
  } catch (error) {
    console.error('Failed to get platform settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get platform settings' },
      { status: 500 }
    );
  }
}

// PUT /api/settings/platforms - Update all platform settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { platformId, settings: newSettings } = body;
    
    if (!platformId || !newSettings) {
      return NextResponse.json(
        { success: false, error: 'Missing platformId or settings' },
        { status: 400 }
      );
    }
    
    // Validate platformId
    const validPlatforms = ['nes', 'snes', 'arcade', 'c64', 'wine', 'psx'];
    if (!validPlatforms.includes(platformId)) {
      return NextResponse.json(
        { success: false, error: `Invalid platform: ${platformId}` },
        { status: 400 }
      );
    }
    
    const allSettings = await readSettings();
    const platformSettings = (allSettings.platforms as PlatformSettings) || {};
    
    // Update the specific platform settings
    platformSettings[platformId as keyof PlatformSettings] = newSettings;
    
    allSettings.platforms = platformSettings;
    await writeSettings(allSettings);
    
    console.log(`[Platform Settings] Saved settings for ${platformId}:`, newSettings);
    
    return NextResponse.json({
      success: true,
      message: `${platformId} settings saved successfully`,
      settings: newSettings,
    });
  } catch (error) {
    console.error('Failed to save platform settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save platform settings' },
      { status: 500 }
    );
  }
}
