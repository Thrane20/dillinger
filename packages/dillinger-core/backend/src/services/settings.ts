// Settings storage service for application configuration

import fs from 'fs-extra';
import path from 'path';
import type { ScraperSettings } from '@dillinger/shared';

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

export interface GOGSettings {
  accessCode?: string; // GOG access code for authentication
}

export interface DownloadSettings {
  maxConcurrent?: number; // Maximum number of concurrent download worker threads (default: 2)
}

export interface AppSettings {
  scrapers?: ScraperSettings;
  audio?: AudioSettings;
  docker?: DockerSettings;
  gog?: GOGSettings;
  downloads?: DownloadSettings;
  // Future settings can be added here:
  // streaming?: StreamingSettings;
  // library?: LibrarySettings;
}

export class SettingsService {
  private static instance: SettingsService;
  private settings: AppSettings = {};

  private constructor() {}

  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  async initialize(): Promise<void> {
    await fs.ensureDir(path.dirname(SETTINGS_PATH));
    
    if (await fs.pathExists(SETTINGS_PATH)) {
      const data = await fs.readJSON(SETTINGS_PATH);
      this.settings = data;
    } else {
      await this.save();
    }
  }

  private async save(): Promise<void> {
    await fs.writeJSON(SETTINGS_PATH, this.settings, { spaces: 2 });
  }

  async getScraperSettings(): Promise<ScraperSettings> {
    return this.settings.scrapers || {};
  }

  async updateScraperSettings(settings: Partial<ScraperSettings>): Promise<void> {
    this.settings.scrapers = {
      ...this.settings.scrapers,
      ...settings,
    };
    await this.save();
  }

  async getAudioSettings(): Promise<AudioSettings> {
    return this.settings.audio || {};
  }

  async updateAudioSettings(settings: Partial<AudioSettings>): Promise<void> {
    this.settings.audio = {
      ...this.settings.audio,
      ...settings,
    };
    await this.save();
  }

  async getDockerSettings(): Promise<DockerSettings> {
    return this.settings.docker || { autoRemoveContainers: false };
  }

  async updateDockerSettings(settings: Partial<DockerSettings>): Promise<void> {
    this.settings.docker = {
      ...this.settings.docker,
      ...settings,
    };
    await this.save();
  }

  async getGOGSettings(): Promise<GOGSettings> {
    return this.settings.gog || {};
  }

  async updateGOGSettings(settings: Partial<GOGSettings>): Promise<void> {
    this.settings.gog = {
      ...this.settings.gog,
      ...settings,
    };
    await this.save();
  }

  async getDownloadSettings(): Promise<DownloadSettings> {
    return this.settings.downloads || { maxConcurrent: 2 };
  }

  async updateDownloadSettings(settings: Partial<DownloadSettings>): Promise<void> {
    this.settings.downloads = {
      ...this.settings.downloads,
      ...settings,
    };
    await this.save();
  }

  async getAllSettings(): Promise<AppSettings> {
    return { ...this.settings };
  }
}
