// Sway profile management service for streaming configurations

import fs from 'fs-extra';
import path from 'path';
import type { SwayProfile } from '@dillinger/shared';
import { DEFAULT_SWAY_PROFILES } from '@dillinger/shared';

// Use the same DILLINGER_ROOT logic as storage service
export const DILLINGER_ROOT = process.env.DILLINGER_ROOT || '/data';
const SWAY_CONFIGS_PATH = path.join(DILLINGER_ROOT, 'storage', 'sway-configs.json');
const SWAY_CONFIG_FILES_PATH = path.join(DILLINGER_ROOT, 'sway-configs');

export class SwayConfigService {
  private static instance: SwayConfigService;
  private profiles: SwayProfile[] = [];
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): SwayConfigService {
    if (!SwayConfigService.instance) {
      SwayConfigService.instance = new SwayConfigService();
    }
    return SwayConfigService.instance;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.initialize();
    await this.initPromise;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Ensure directories exist
    await fs.ensureDir(path.dirname(SWAY_CONFIGS_PATH));
    await fs.ensureDir(SWAY_CONFIG_FILES_PATH);

    // Load existing profiles or seed defaults
    if (await fs.pathExists(SWAY_CONFIGS_PATH)) {
      const data = await fs.readJSON(SWAY_CONFIGS_PATH);
      this.profiles = data.profiles || [];
    } else {
      // Seed with default profiles
      this.profiles = DEFAULT_SWAY_PROFILES.map(p => ({
        ...p,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      }));
      await this.save();
    }

    // Generate config files for all profiles
    await this.regenerateAllConfigFiles();

    this.initialized = true;
  }

  private async save(): Promise<void> {
    await fs.writeJSON(SWAY_CONFIGS_PATH, { profiles: this.profiles }, { spaces: 2 });
  }

  /**
   * Generate the Sway config file content for a profile
   */
  private generateSwayConfig(profile: SwayProfile): string {
    const config = `# Dillinger Streaming - Sway Configuration
# Profile: ${profile.name}
# Generated: ${new Date().toISOString()}

# Headless output configuration
output HEADLESS-1 {
    resolution ${profile.width}x${profile.height}@${profile.refreshRate}Hz
    position 0 0
    bg #000000 solid_color
}

# Basic settings for streaming
default_border none
default_floating_border none
titlebar_border_thickness 0
titlebar_padding 0

# Disable gaps (maximize screen usage)
gaps inner 0
gaps outer 0

# Auto-focus new windows
focus_on_window_activation focus

# Fullscreen any new window by default
for_window [class=".*"] fullscreen enable
for_window [app_id=".*"] fullscreen enable

# Float windows by default (simple layout)
for_window [class=".*"] floating enable
for_window [app_id=".*"] floating enable

# Keyboard bindings (for debugging)
bindsym Mod4+Return exec foot
bindsym Mod4+Shift+q kill
bindsym Mod4+Shift+e exec swaynag -t warning -m 'Exit sway?' -B 'Yes' 'swaymsg exit'
bindsym Mod4+f fullscreen toggle

${profile.customConfig ? `# Custom configuration\n${profile.customConfig}` : ''}

# Include any additional user configuration
include ${SWAY_CONFIG_FILES_PATH}/include.d/*.conf
`;
    return config;
  }

  /**
   * Write the config file for a profile
   */
  private async writeConfigFile(profile: SwayProfile): Promise<void> {
    const configPath = path.join(SWAY_CONFIG_FILES_PATH, `${profile.id}.conf`);
    const content = this.generateSwayConfig(profile);
    await fs.writeFile(configPath, content, 'utf-8');
  }

  /**
   * Regenerate all config files
   */
  private async regenerateAllConfigFiles(): Promise<void> {
    // Ensure include.d directory exists
    await fs.ensureDir(path.join(SWAY_CONFIG_FILES_PATH, 'include.d'));
    
    for (const profile of this.profiles) {
      await this.writeConfigFile(profile);
    }
  }

  /**
   * Get all profiles
   */
  async getAllProfiles(): Promise<SwayProfile[]> {
    await this.ensureInitialized();
    return [...this.profiles];
  }

  /**
   * Get a profile by ID
   */
  async getProfile(id: string): Promise<SwayProfile | null> {
    await this.ensureInitialized();
    return this.profiles.find(p => p.id === id) || null;
  }

  /**
   * Create a new profile
   */
  async createProfile(profile: Omit<SwayProfile, 'created' | 'updated'>): Promise<SwayProfile> {
    await this.ensureInitialized();

    // Check for duplicate ID
    if (this.profiles.some(p => p.id === profile.id)) {
      throw new Error(`Profile with ID "${profile.id}" already exists`);
    }

    const newProfile: SwayProfile = {
      ...profile,
      isDefault: false, // User-created profiles are never default
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };

    this.profiles.push(newProfile);
    await this.save();
    await this.writeConfigFile(newProfile);

    return newProfile;
  }

  /**
   * Update an existing profile
   */
  async updateProfile(id: string, updates: Partial<Omit<SwayProfile, 'id' | 'created' | 'isDefault'>>): Promise<SwayProfile> {
    await this.ensureInitialized();

    const index = this.profiles.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error(`Profile "${id}" not found`);
    }

    const updated: SwayProfile = {
      ...this.profiles[index],
      ...updates,
      id, // Preserve ID
      isDefault: this.profiles[index].isDefault, // Preserve isDefault
      created: this.profiles[index].created, // Preserve created
      updated: new Date().toISOString(),
    };

    this.profiles[index] = updated;
    await this.save();
    await this.writeConfigFile(updated);

    return updated;
  }

  /**
   * Delete a profile
   */
  async deleteProfile(id: string): Promise<void> {
    await this.ensureInitialized();

    const profile = this.profiles.find(p => p.id === id);
    if (!profile) {
      throw new Error(`Profile "${id}" not found`);
    }

    if (profile.isDefault) {
      throw new Error('Cannot delete default system profiles');
    }

    this.profiles = this.profiles.filter(p => p.id !== id);
    await this.save();

    // Remove config file
    const configPath = path.join(SWAY_CONFIG_FILES_PATH, `${id}.conf`);
    await fs.remove(configPath).catch(() => {}); // Ignore if file doesn't exist
  }

  /**
   * Clone an existing profile
   */
  async cloneProfile(sourceId: string, newId: string, newName: string): Promise<SwayProfile> {
    await this.ensureInitialized();

    const source = this.profiles.find(p => p.id === sourceId);
    if (!source) {
      throw new Error(`Source profile "${sourceId}" not found`);
    }

    if (this.profiles.some(p => p.id === newId)) {
      throw new Error(`Profile with ID "${newId}" already exists`);
    }

    const cloned: SwayProfile = {
      ...source,
      id: newId,
      name: newName,
      isDefault: false,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };

    this.profiles.push(cloned);
    await this.save();
    await this.writeConfigFile(cloned);

    return cloned;
  }

  /**
   * Get the config file path for a profile
   */
  getConfigFilePath(profileId: string): string {
    return path.join(SWAY_CONFIG_FILES_PATH, `${profileId}.conf`);
  }

  /**
   * Check if a profile's config file exists
   */
  async configFileExists(profileId: string): Promise<boolean> {
    const configPath = this.getConfigFilePath(profileId);
    return fs.pathExists(configPath);
  }
}
