/**
 * Wine Version Management Service
 * 
 * Manages Wine versions (System, Wine Staging, GE-Proton) stored in
 * /data/storage/wine-versions/ with metadata tracked in index.json.
 * 
 * GE-Proton versions use UMU Launcher for execution (required per upstream docs).
 */

import fs from 'fs-extra';
import path from 'path';
import { createWriteStream } from 'fs';
import { createHash } from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Wine version types (defined locally to avoid circular dependency during build)
type WineVersionType = 'system' | 'wine-staging' | 'ge-proton';

interface InstalledWineVersion {
  id: string;
  type: WineVersionType;
  version: string;
  displayName: string;
  path: string;
  installedAt: string;
  usesUmu: boolean;
  releaseNotes?: string;
}

interface AvailableWineVersion {
  type: WineVersionType;
  version: string;
  displayName: string;
  downloadUrl: string;
  size?: number;
  releaseDate: string;
  checksumUrl?: string;
  releaseNotes?: string;
}

interface WineVersionIndex {
  schemaVersion: string;
  installedVersions: InstalledWineVersion[];
  defaultVersionId: string;
  availableCache: {
    geProton: AvailableWineVersion[];
    wineStaging: AvailableWineVersion[];
    lastRefreshed: string;
  };
}

// Storage paths
export const DILLINGER_CORE_PATH = process.env.DILLINGER_CORE_PATH || '/data';
export const WINE_VERSIONS_DIR = path.join(DILLINGER_CORE_PATH, 'storage', 'wine-versions');
export const WINE_VERSIONS_INDEX = path.join(WINE_VERSIONS_DIR, 'index.json');

// Cache duration: 1 hour
const CACHE_DURATION_MS = 60 * 60 * 1000;

// GitHub API endpoints
const GE_PROTON_RELEASES_URL = 'https://api.github.com/repos/GloriousEggroll/proton-ge-custom/releases';

// System Wine version (always available, built into container)
const SYSTEM_WINE_VERSION: InstalledWineVersion = {
  id: 'system',
  type: 'system',
  version: 'built-in',
  displayName: 'System Wine (built-in)',
  path: '/usr/bin',
  installedAt: new Date().toISOString(),
  usesUmu: false,
  releaseNotes: 'Wine version bundled with the Wine runner container. Always available.',
};

/**
 * Default index structure
 */
function createDefaultIndex(): WineVersionIndex {
  return {
    schemaVersion: '1.0',
    installedVersions: [SYSTEM_WINE_VERSION],
    defaultVersionId: 'system',
    availableCache: {
      geProton: [],
      wineStaging: [],
      lastRefreshed: '',
    },
  };
}

export class WineVersionsService {
  private static instance: WineVersionsService;

  private constructor() {}

  static getInstance(): WineVersionsService {
    if (!WineVersionsService.instance) {
      WineVersionsService.instance = new WineVersionsService();
    }
    return WineVersionsService.instance;
  }

  /**
   * Initialize the wine-versions directory and index
   */
  async initialize(): Promise<void> {
    await fs.ensureDir(WINE_VERSIONS_DIR);
    
    if (!await fs.pathExists(WINE_VERSIONS_INDEX)) {
      await this.saveIndex(createDefaultIndex());
    }
  }

  /**
   * Load the Wine versions index
   */
  async loadIndex(): Promise<WineVersionIndex> {
    await this.initialize();
    
    try {
      const data = await fs.readJson(WINE_VERSIONS_INDEX);
      
      // Ensure system Wine is always present
      const hasSystem = data.installedVersions?.some((v: InstalledWineVersion) => v.id === 'system');
      if (!hasSystem) {
        data.installedVersions = [SYSTEM_WINE_VERSION, ...(data.installedVersions || [])];
      }
      
      return data as WineVersionIndex;
    } catch {
      return createDefaultIndex();
    }
  }

  /**
   * Save the Wine versions index
   */
  async saveIndex(index: WineVersionIndex): Promise<void> {
    await fs.ensureDir(WINE_VERSIONS_DIR);
    await fs.writeJson(WINE_VERSIONS_INDEX, index, { spaces: 2 });
  }

  /**
   * Get all installed versions
   */
  async getInstalledVersions(): Promise<InstalledWineVersion[]> {
    const index = await this.loadIndex();
    return index.installedVersions;
  }

  /**
   * Get installed version by ID
   */
  async getInstalledVersion(id: string): Promise<InstalledWineVersion | undefined> {
    const versions = await this.getInstalledVersions();
    return versions.find(v => v.id === id);
  }

  /**
   * Get the default Wine version
   */
  async getDefaultVersion(): Promise<InstalledWineVersion | undefined> {
    const index = await this.loadIndex();
    return index.installedVersions.find(v => v.id === index.defaultVersionId);
  }

  /**
   * Set the default Wine version
   */
  async setDefaultVersion(versionId: string): Promise<void> {
    const index = await this.loadIndex();
    
    const version = index.installedVersions.find(v => v.id === versionId);
    if (!version) {
      throw new Error(`Version not found: ${versionId}`);
    }
    
    index.defaultVersionId = versionId;
    await this.saveIndex(index);
  }

  /**
   * Check if cache needs refresh (older than 1 hour)
   */
  async isCacheStale(): Promise<boolean> {
    const index = await this.loadIndex();
    
    if (!index.availableCache.lastRefreshed) {
      return true;
    }
    
    const lastRefreshed = new Date(index.availableCache.lastRefreshed).getTime();
    return Date.now() - lastRefreshed > CACHE_DURATION_MS;
  }

  /**
   * Fetch available GE-Proton versions from GitHub
   */
  async fetchGEProtonVersions(): Promise<AvailableWineVersion[]> {
    try {
      const response = await fetch(`${GE_PROTON_RELEASES_URL}?per_page=15`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Dillinger-Game-Launcher',
        },
      });

      if (!response.ok) {
        console.error(`GitHub API error: ${response.status}`);
        return [];
      }

      const releases = await response.json() as Array<{
        tag_name: string;
        name: string;
        published_at: string;
        body: string;
        assets: Array<{
          name: string;
          browser_download_url: string;
          size: number;
        }>;
      }>;

      const versions: AvailableWineVersion[] = [];
      
      for (const release of releases) {
        if (release.tag_name.includes('LoL')) continue; // Skip League of Legends builds
        
        // Find the tar.gz asset
        const tarball = release.assets.find(a => a.name.endsWith('.tar.gz'));
        if (!tarball) continue;
        
        const checksum = release.assets.find(a => a.name.endsWith('.sha512sum'));
        
        // Extract version from tag (e.g., "GE-Proton10-27" -> "10-27")
        const version = release.tag_name.replace('GE-Proton', '');

        versions.push({
          type: 'ge-proton',
          version,
          displayName: `GE-Proton ${version}`,
          downloadUrl: tarball.browser_download_url,
          size: tarball.size,
          releaseDate: release.published_at || new Date().toISOString(),
          checksumUrl: checksum?.browser_download_url,
          releaseNotes: release.body?.slice(0, 500) || '',
        });
      }
      
      return versions;
    } catch (error) {
      console.error('Failed to fetch GE-Proton versions:', error);
      return [];
    }
  }

  /**
   * Fetch available Wine Staging versions
   * Note: Wine Staging doesn't have easy binary downloads for non-distro users,
   * so we'll provide links to the official releases for manual download or 
   * detect what's available in the container.
   */
  async fetchWineStagingVersions(): Promise<AvailableWineVersion[]> {
    // Wine Staging binaries are typically distributed via package managers.
    // For now, we'll list recent known versions that users can install via
    // the Arch repos if they rebuild the container, or we can add download
    // support for pre-built binaries from wine-staging GitHub releases.
    
    try {
      // Check Wine Staging GitHub for releases
      const response = await fetch('https://api.github.com/repos/wine-staging/wine-staging/releases?per_page=10', {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Dillinger-Game-Launcher',
        },
      });

      if (!response.ok) {
        return [];
      }

      const releases = await response.json() as Array<{
        tag_name: string;
        name: string;
        published_at: string;
        body: string;
      }>;

      // Wine Staging releases are source-only on GitHub
      // We'll mark them as "available" for informational purposes
      // but actual installation would require building or package manager
      return releases.map(release => {
        const version = release.tag_name.replace('v', '');
        return {
          type: 'wine-staging' as WineVersionType,
          version,
          displayName: `Wine Staging ${version}`,
          downloadUrl: '', // No direct binary download
          releaseDate: release.published_at,
          releaseNotes: `Wine Staging ${version}. Install via package manager or rebuild container.`,
        };
      });
    } catch (error) {
      console.error('Failed to fetch Wine Staging versions:', error);
      return [];
    }
  }

  /**
   * Refresh available versions from all sources
   */
  async refreshAvailableVersions(force = false): Promise<WineVersionIndex> {
    const index = await this.loadIndex();
    
    if (!force && !await this.isCacheStale()) {
      return index;
    }

    console.log('Refreshing available Wine versions...');

    const [geProton, wineStaging] = await Promise.all([
      this.fetchGEProtonVersions(),
      this.fetchWineStagingVersions(),
    ]);

    index.availableCache = {
      geProton,
      wineStaging,
      lastRefreshed: new Date().toISOString(),
    };

    await this.saveIndex(index);
    return index;
  }

  /**
   * Get all available versions (with cache refresh if needed)
   */
  async getAvailableVersions(): Promise<{
    geProton: AvailableWineVersion[];
    wineStaging: AvailableWineVersion[];
    lastRefreshed: string;
  }> {
    const index = await this.refreshAvailableVersions();
    return index.availableCache;
  }

  /**
   * Download and install a Wine version
   * Returns progress updates via callback
   */
  async installVersion(
    available: AvailableWineVersion,
    onProgress?: (progress: { percent: number; status: string }) => void
  ): Promise<InstalledWineVersion> {
    const versionId = `${available.type}-${available.version}`.toLowerCase().replace(/\s+/g, '-');
    const installDir = path.join(WINE_VERSIONS_DIR, versionId);

    // Check if already installed
    const existing = await this.getInstalledVersion(versionId);
    if (existing) {
      throw new Error(`Version already installed: ${versionId}`);
    }

    if (!available.downloadUrl) {
      throw new Error(`No download URL available for ${available.displayName}`);
    }

    onProgress?.({ percent: 0, status: 'Starting download...' });

    try {
      // Create temp directory for download
      const tempDir = path.join(WINE_VERSIONS_DIR, '.tmp', versionId);
      await fs.ensureDir(tempDir);
      
      const tarballPath = path.join(tempDir, `${versionId}.tar.gz`);

      // Download the tarball
      onProgress?.({ percent: 5, status: 'Downloading...' });
      
      const response = await fetch(available.downloadUrl);
      if (!response.ok || !response.body) {
        throw new Error(`Download failed: ${response.status}`);
      }

      const totalSize = available.size || parseInt(response.headers.get('content-length') || '0');
      let downloadedSize = 0;

      // Create write stream
      const fileStream = createWriteStream(tarballPath);
      const reader = response.body.getReader();

      // Download with progress
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        fileStream.write(Buffer.from(value));
        downloadedSize += value.length;

        if (totalSize > 0) {
          const percent = Math.round((downloadedSize / totalSize) * 70) + 5; // 5-75%
          onProgress?.({ percent, status: `Downloading... ${Math.round(downloadedSize / 1024 / 1024)}MB` });
        }
      }

      fileStream.end();
      await new Promise<void>(resolve => fileStream.on('finish', resolve));

      // Verify checksum if available (GE-Proton)
      if (available.checksumUrl) {
        onProgress?.({ percent: 76, status: 'Verifying checksum...' });
        
        try {
          const checksumResponse = await fetch(available.checksumUrl);
          if (checksumResponse.ok) {
            const checksumText = await checksumResponse.text();
            const expectedHash = checksumText.split(' ')[0].toLowerCase();

            const fileBuffer = await fs.readFile(tarballPath);
            const actualHash = createHash('sha512').update(fileBuffer).digest('hex');

            if (actualHash !== expectedHash) {
              throw new Error('Checksum verification failed');
            }
          }
        } catch (error) {
          console.warn('Checksum verification failed, continuing anyway:', error);
        }
      }

      // Extract the tarball using system tar command
      onProgress?.({ percent: 80, status: 'Extracting...' });
      
      await fs.ensureDir(installDir);
      
      // Use tar command with strip-components to remove top-level directory
      await execAsync(`tar -xzf "${tarballPath}" -C "${installDir}" --strip-components=1`);

      // Cleanup temp files
      onProgress?.({ percent: 95, status: 'Cleaning up...' });
      await fs.remove(tempDir);

      // Create installed version entry
      const installed: InstalledWineVersion = {
        id: versionId,
        type: available.type,
        version: available.version,
        displayName: available.displayName,
        path: installDir,
        installedAt: new Date().toISOString(),
        usesUmu: available.type === 'ge-proton',
        releaseNotes: available.releaseNotes,
      };

      // Update index
      const index = await this.loadIndex();
      index.installedVersions.push(installed);
      await this.saveIndex(index);

      onProgress?.({ percent: 100, status: 'Complete!' });

      return installed;
    } catch (error) {
      // Cleanup on failure
      await fs.remove(installDir).catch(() => {});
      throw error;
    }
  }

  /**
   * Remove an installed Wine version
   */
  async removeVersion(versionId: string): Promise<void> {
    if (versionId === 'system') {
      throw new Error('Cannot remove system Wine version');
    }

    const index = await this.loadIndex();
    
    if (index.defaultVersionId === versionId) {
      throw new Error('Cannot remove the default Wine version. Set a different default first.');
    }

    const version = index.installedVersions.find(v => v.id === versionId);
    if (!version) {
      throw new Error(`Version not found: ${versionId}`);
    }

    // Remove the installation directory
    if (version.path && version.path !== '/usr/bin') {
      await fs.remove(version.path);
    }

    // Update index
    index.installedVersions = index.installedVersions.filter(v => v.id !== versionId);
    await this.saveIndex(index);
  }

  /**
   * Get full status including installed and available versions
   */
  async getStatus(): Promise<{
    installed: InstalledWineVersion[];
    available: {
      geProton: AvailableWineVersion[];
      wineStaging: AvailableWineVersion[];
    };
    defaultId: string;
    lastRefreshed: string;
  }> {
    const index = await this.refreshAvailableVersions();
    
    // Filter out already installed versions from available
    const installedIds = new Set(index.installedVersions.map(v => v.id));
    
    return {
      installed: index.installedVersions,
      available: {
        geProton: index.availableCache.geProton.filter(
          v => !installedIds.has(`ge-proton-${v.version}`.toLowerCase().replace(/\s+/g, '-'))
        ),
        wineStaging: index.availableCache.wineStaging.filter(
          v => !installedIds.has(`wine-staging-${v.version}`.toLowerCase().replace(/\s+/g, '-'))
        ),
      },
      defaultId: index.defaultVersionId,
      lastRefreshed: index.availableCache.lastRefreshed,
    };
  }
}

// Export singleton instance
export const wineVersionsService = WineVersionsService.getInstance();
