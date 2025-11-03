// Settings storage service for application configuration

import fs from 'fs-extra';
import path from 'path';
import type { ScraperSettings } from '@dillinger/shared';

// Use the same DILLINGER_ROOT logic as storage service
// This MUST point to the dillinger_root Docker volume mount point
const DILLINGER_ROOT = process.env.DILLINGER_ROOT || '/data';
const SETTINGS_PATH = path.join(DILLINGER_ROOT, 'storage', 'settings.json');

export interface AppSettings {
  scrapers?: ScraperSettings;
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

  async getAllSettings(): Promise<AppSettings> {
    return { ...this.settings };
  }
}
