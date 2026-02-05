// Settings storage service for application configuration

import fs from 'fs-extra';
import path from 'path';
import type { ScraperSettings, StreamingSettings } from '@dillinger/shared';

// Use the same DILLINGER_ROOT logic as storage service
// This MUST point to the dillinger_root Docker volume mount point
export const DILLINGER_ROOT = process.env.DILLINGER_ROOT || '/data';
const SETTINGS_PATH = path.join(DILLINGER_ROOT, 'storage', 'settings.json');

export interface AudioSettings {
  defaultSink?: string; // PulseAudio sink identifier (e.g., "alsa_output.pci-0000_03_00.1.hdmi-stereo-extra1")
}

export interface DockerSettings {
  autoRemoveContainers?: boolean; // Whether to automatically remove containers after they stop (default: false)
}

export type GpuVendor = 'auto' | 'amd' | 'nvidia';

export interface GpuSettings {
  vendor?: GpuVendor;
}

export interface GOGSettings {
  accessCode?: string; // GOG access code for authentication
}

export interface DownloadSettings {
  maxConcurrent?: number; // Maximum number of concurrent download worker threads (default: 2)
  defaultInstallVolumeId?: string; // ID of the configured volume for game installations
  /** Where to store downloaded installers */
  installerCacheMode?: 'with_game' | 'custom_volume';
  /** Volume ID if installerCacheMode is 'custom_volume' */
  installerCacheVolumeId?: string;
}

export interface JoystickConfig {
  deviceId: string; // e.g., "event11"
  deviceName: string; // e.g., "Logitech Gamepad F310"
}

export interface JoystickSettings {
  [platform: string]: JoystickConfig;
}

export interface AppSettings {
  scrapers?: ScraperSettings;
  audio?: AudioSettings;
  docker?: DockerSettings;
  gpu?: GpuSettings;
  gog?: GOGSettings;
  downloads?: DownloadSettings;
  joysticks?: JoystickSettings;
  streaming?: StreamingSettings;
}

export class SettingsService {
  private static instance: SettingsService;
  private settings: AppSettings = {};
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.initialize();
    await this.initPromise;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    await fs.ensureDir(path.dirname(SETTINGS_PATH));
    
    if (await fs.pathExists(SETTINGS_PATH)) {
      const data = await fs.readJSON(SETTINGS_PATH);
      this.settings = data;
    } else {
      await this.save();
    }
    this.initialized = true;
  }

  private async save(): Promise<void> {
    await fs.writeJSON(SETTINGS_PATH, this.settings, { spaces: 2 });
  }

  async getScraperSettings(): Promise<ScraperSettings> {
    await this.ensureInitialized();
    return this.settings.scrapers || {};
  }

  async updateScraperSettings(settings: Partial<ScraperSettings>): Promise<void> {
    await this.ensureInitialized();
    this.settings.scrapers = {
      ...this.settings.scrapers,
      ...settings,
    };
    await this.save();
  }

  async getAudioSettings(): Promise<AudioSettings> {
    await this.ensureInitialized();
    return this.settings.audio || {};
  }

  async updateAudioSettings(settings: Partial<AudioSettings>): Promise<void> {
    await this.ensureInitialized();
    this.settings.audio = {
      ...this.settings.audio,
      ...settings,
    };
    await this.save();
  }

  async getDockerSettings(): Promise<DockerSettings> {
    await this.ensureInitialized();
    return this.settings.docker || { autoRemoveContainers: false };
  }

  async updateDockerSettings(settings: Partial<DockerSettings>): Promise<void> {
    await this.ensureInitialized();
    this.settings.docker = {
      ...this.settings.docker,
      ...settings,
    };
    await this.save();
  }

  async getGpuSettings(): Promise<GpuSettings> {
    await this.ensureInitialized();
    return this.settings.gpu || { vendor: 'auto' };
  }

  async updateGpuSettings(settings: Partial<GpuSettings>): Promise<void> {
    await this.ensureInitialized();
    this.settings.gpu = {
      ...this.settings.gpu,
      ...settings,
    };
    await this.save();
  }

  async getGOGSettings(): Promise<GOGSettings> {
    await this.ensureInitialized();
    return this.settings.gog || {};
  }

  async updateGOGSettings(settings: Partial<GOGSettings>): Promise<void> {
    await this.ensureInitialized();
    this.settings.gog = {
      ...this.settings.gog,
      ...settings,
    };
    await this.save();
  }

  async getDownloadSettings(): Promise<DownloadSettings> {
    await this.ensureInitialized();
    return this.settings.downloads || { 
      maxConcurrent: 2,
    };
  }

  async updateDownloadSettings(settings: Partial<DownloadSettings>): Promise<void> {
    await this.ensureInitialized();
    this.settings.downloads = {
      ...this.settings.downloads,
      ...settings,
    };
    await this.save();
  }

  async getJoystickSettings(): Promise<JoystickSettings> {
    await this.ensureInitialized();
    return this.settings.joysticks || {};
  }

  async updateJoystickSettings(settings: JoystickSettings): Promise<void> {
    await this.ensureInitialized();
    this.settings.joysticks = {
      ...(this.settings.joysticks || {}),
      ...settings,
    };
    await this.save();
  }

  async getJoystickConfig(platform: string): Promise<JoystickConfig | undefined> {
    await this.ensureInitialized();
    return this.settings.joysticks?.[platform];
  }

  async getAllSettings(): Promise<AppSettings> {
    await this.ensureInitialized();
    return { ...this.settings };
  }

  // ============================================================================
  // Streaming Settings
  // ============================================================================

  async getStreamingSettings(): Promise<StreamingSettings> {
    await this.ensureInitialized();
    // Return stored settings merged with defaults
    const defaults: StreamingSettings = {
      gpuType: 'auto',
      codec: 'h264',
      quality: 'high',
      idleTimeoutMinutes: 15,
      waylandSocketPath: '/run/dillinger/wayland-dillinger',
      defaultProfileId: '1080p60',
      autoStart: true,
      streamingGraphPath: '/data/storage/streaming-graph.json',
    };
    return {
      ...defaults,
      ...this.settings.streaming,
    };
  }

  async updateStreamingSettings(settings: Partial<StreamingSettings>): Promise<void> {
    await this.ensureInitialized();
    this.settings.streaming = {
      ...this.settings.streaming,
      ...settings,
    } as StreamingSettings;
    await this.save();
  }
}
