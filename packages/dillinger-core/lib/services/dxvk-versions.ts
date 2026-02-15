/**
 * DXVK Version Management Service
 * 
 * Manages DXVK versions (and DXVK-NVAPI, VKD3D-Proton) stored in
 * /data/storage/dxvk-versions/ with metadata tracked in index.json.
 * 
 * DXVK translates Direct3D 9/10/11 to Vulkan for better performance.
 * Unlike winetricks which installs to each prefix, we download once
 * and install to prefixes on demand.
 * 
 * Sources:
 * - DXVK: https://github.com/doitsujin/dxvk
 * - DXVK-GPLAsync: https://gitlab.com/Ph42oN/dxvk-gplasync (alternative with async shader compilation)
 */

import fs from 'fs-extra';
import path from 'path';
import { createWriteStream } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// DXVK types
export type DxvkType = 'dxvk' | 'dxvk-gplasync' | 'vkd3d-proton';

export interface InstalledDxvkVersion {
  id: string;
  type: DxvkType;
  version: string;
  displayName: string;
  path: string; // Path to extracted DXVK files
  installedAt: string;
  releaseNotes?: string;
  /** Supported architectures (x32, x64) */
  architectures: ('x32' | 'x64')[];
}

export interface AvailableDxvkVersion {
  type: DxvkType;
  version: string;
  displayName: string;
  downloadUrl: string;
  size?: number;
  releaseDate: string;
  releaseNotes?: string;
}

export interface DxvkVersionIndex {
  schemaVersion: string;
  installedVersions: InstalledDxvkVersion[];
  defaultVersionId: string | null; // null means use winetricks default
  availableCache: {
    dxvk: AvailableDxvkVersion[];
    dxvkGplAsync: AvailableDxvkVersion[];
    vkd3dProton: AvailableDxvkVersion[];
    lastRefreshed: string;
  };
}

// Storage paths
export const DILLINGER_CORE_PATH = process.env.DILLINGER_CORE_PATH || '/data';
export const DXVK_VERSIONS_DIR = path.join(DILLINGER_CORE_PATH, 'storage', 'dxvk-versions');
export const DXVK_VERSIONS_INDEX = path.join(DXVK_VERSIONS_DIR, 'index.json');

// Bundled paths (pre-installed in runner containers)
export const BUNDLED_DXVK_PATH = '/opt/dxvk';
export const BUNDLED_VKD3D_PATH = '/opt/vkd3d-proton';

// Cache duration: 1 hour
const CACHE_DURATION_MS = 60 * 60 * 1000;

// GitHub API endpoints
const DXVK_RELEASES_URL = 'https://api.github.com/repos/doitsujin/dxvk/releases';
const VKD3D_PROTON_RELEASES_URL = 'https://api.github.com/repos/HansKristian-Work/vkd3d-proton/releases';
// Note: DXVK-GPLAsync is on GitLab, would need different API handling

/**
 * Check if bundled DXVK is available and return version info
 */
async function getBundledDxvkVersion(): Promise<InstalledDxvkVersion | null> {
  try {
    const versionFile = path.join(BUNDLED_DXVK_PATH, 'version');
    if (await fs.pathExists(versionFile)) {
      const version = (await fs.readFile(versionFile, 'utf-8')).trim();
      // Check for x32/x64 directories
      const architectures: ('x32' | 'x64')[] = [];
      if (await fs.pathExists(path.join(BUNDLED_DXVK_PATH, 'x32'))) architectures.push('x32');
      if (await fs.pathExists(path.join(BUNDLED_DXVK_PATH, 'x64'))) architectures.push('x64');
      
      return {
        id: 'bundled-dxvk',
        type: 'dxvk',
        version,
        displayName: `DXVK ${version} (bundled)`,
        path: BUNDLED_DXVK_PATH,
        installedAt: new Date().toISOString(),
        releaseNotes: 'Pre-installed DXVK bundled with the Wine runner container.',
        architectures,
      };
    }
  } catch {
    // Bundled DXVK not available
  }
  return null;
}

/**
 * Check if bundled VKD3D-Proton is available and return version info
 */
async function getBundledVkd3dVersion(): Promise<InstalledDxvkVersion | null> {
  try {
    const versionFile = path.join(BUNDLED_VKD3D_PATH, 'version');
    if (await fs.pathExists(versionFile)) {
      const version = (await fs.readFile(versionFile, 'utf-8')).trim();
      // Check for x86/x64 directories (VKD3D uses different naming)
      const architectures: ('x32' | 'x64')[] = [];
      if (await fs.pathExists(path.join(BUNDLED_VKD3D_PATH, 'x86'))) architectures.push('x32');
      if (await fs.pathExists(path.join(BUNDLED_VKD3D_PATH, 'x64'))) architectures.push('x64');
      
      return {
        id: 'bundled-vkd3d-proton',
        type: 'vkd3d-proton',
        version,
        displayName: `VKD3D-Proton ${version} (bundled)`,
        path: BUNDLED_VKD3D_PATH,
        installedAt: new Date().toISOString(),
        releaseNotes: 'Pre-installed VKD3D-Proton bundled with the Wine runner container. Enables DirectX 12 games.',
        architectures,
      };
    }
  } catch {
    // Bundled VKD3D-Proton not available
  }
  return null;
}

/**
 * Default index structure
 */
function createDefaultIndex(): DxvkVersionIndex {
  return {
    schemaVersion: '1.0',
    installedVersions: [],
    defaultVersionId: null, // Use winetricks by default
    availableCache: {
      dxvk: [],
      dxvkGplAsync: [],
      vkd3dProton: [],
      lastRefreshed: '',
    },
  };
}

export class DxvkVersionsService {
  private static instance: DxvkVersionsService;

  private constructor() {}

  static getInstance(): DxvkVersionsService {
    if (!DxvkVersionsService.instance) {
      DxvkVersionsService.instance = new DxvkVersionsService();
    }
    return DxvkVersionsService.instance;
  }

  /**
   * Initialize the dxvk-versions directory and index
   */
  async initialize(): Promise<void> {
    await fs.ensureDir(DXVK_VERSIONS_DIR);
    
    if (!await fs.pathExists(DXVK_VERSIONS_INDEX)) {
      await this.saveIndex(createDefaultIndex());
    }
  }

  /**
   * Load the DXVK versions index
   */
  async loadIndex(): Promise<DxvkVersionIndex> {
    await this.initialize();
    try {
      const content = await fs.readFile(DXVK_VERSIONS_INDEX, 'utf-8');
      return JSON.parse(content);
    } catch {
      return createDefaultIndex();
    }
  }

  /**
   * Save the DXVK versions index
   */
  async saveIndex(index: DxvkVersionIndex): Promise<void> {
    await fs.writeFile(DXVK_VERSIONS_INDEX, JSON.stringify(index, null, 2));
  }

  /**
   * Get all installed DXVK versions, including bundled versions from runner containers
   */
  async getInstalledVersions(): Promise<InstalledDxvkVersion[]> {
    const index = await this.loadIndex();
    const versions = [...index.installedVersions];
    
    // Check for bundled versions (pre-installed in runner containers)
    const bundledDxvk = await getBundledDxvkVersion();
    if (bundledDxvk && !versions.some(v => v.id === 'bundled-dxvk')) {
      versions.unshift(bundledDxvk); // Add at beginning for visibility
    }
    
    const bundledVkd3d = await getBundledVkd3dVersion();
    if (bundledVkd3d && !versions.some(v => v.id === 'bundled-vkd3d-proton')) {
      versions.push(bundledVkd3d);
    }
    
    return versions;
  }

  /**
   * Get the default DXVK version ID (null = winetricks)
   */
  async getDefaultVersionId(): Promise<string | null> {
    const index = await this.loadIndex();
    return index.defaultVersionId;
  }

  /**
   * Set the default DXVK version
   */
  async setDefaultVersion(versionId: string | null): Promise<void> {
    const index = await this.loadIndex();
    
    // Validate version exists if not null (allow bundled or installed versions)
    if (versionId !== null && versionId !== 'winetricks') {
      const installedExists = index.installedVersions.some(v => v.id === versionId);
      const isBundled = versionId === 'bundled-dxvk' || versionId === 'bundled-vkd3d-proton';
      
      if (!installedExists && !isBundled) {
        throw new Error(`DXVK version ${versionId} is not installed`);
      }
      
      // Verify bundled version actually exists
      if (versionId === 'bundled-dxvk') {
        const bundled = await getBundledDxvkVersion();
        if (!bundled) {
          throw new Error('Bundled DXVK is not available in this environment');
        }
      } else if (versionId === 'bundled-vkd3d-proton') {
        const bundled = await getBundledVkd3dVersion();
        if (!bundled) {
          throw new Error('Bundled VKD3D-Proton is not available in this environment');
        }
      }
    }
    
    index.defaultVersionId = versionId;
    await this.saveIndex(index);
  }

  /**
   * Fetch available DXVK versions from GitHub
   */
  async refreshAvailableVersions(): Promise<{
    dxvk: AvailableDxvkVersion[];
    vkd3dProton: AvailableDxvkVersion[];
  }> {
    const index = await this.loadIndex();
    
    // Check cache validity
    const lastRefreshed = index.availableCache.lastRefreshed 
      ? new Date(index.availableCache.lastRefreshed).getTime() 
      : 0;
    const now = Date.now();
    
    if (now - lastRefreshed < CACHE_DURATION_MS && 
        index.availableCache.dxvk.length > 0) {
      return {
        dxvk: index.availableCache.dxvk,
        vkd3dProton: index.availableCache.vkd3dProton,
      };
    }

    // Fetch DXVK releases from GitHub
    const dxvkVersions = await this.fetchDxvkReleases();
    const vkd3dVersions = await this.fetchVkd3dProtonReleases();

    // Update cache
    index.availableCache.dxvk = dxvkVersions;
    index.availableCache.vkd3dProton = vkd3dVersions;
    index.availableCache.lastRefreshed = new Date().toISOString();
    await this.saveIndex(index);

    return { dxvk: dxvkVersions, vkd3dProton: vkd3dVersions };
  }

  /**
   * Fetch DXVK releases from GitHub
   */
  private async fetchDxvkReleases(): Promise<AvailableDxvkVersion[]> {
    try {
      const response = await fetch(DXVK_RELEASES_URL, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Dillinger-Game-Library',
        },
      });

      if (!response.ok) {
        console.error(`Failed to fetch DXVK releases: ${response.status}`);
        return [];
      }

      const releases = await response.json() as any[];
      const versions: AvailableDxvkVersion[] = [];

      for (const release of releases.slice(0, 20)) { // Last 20 releases
        // Find the tarball asset
        const tarball = release.assets?.find((a: any) => 
          a.name.endsWith('.tar.gz') && !a.name.includes('native')
        );

        if (tarball) {
          versions.push({
            type: 'dxvk',
            version: release.tag_name.replace(/^v/, ''),
            displayName: `DXVK ${release.tag_name}`,
            downloadUrl: tarball.browser_download_url,
            size: tarball.size,
            releaseDate: release.published_at,
            releaseNotes: release.body?.substring(0, 500),
          });
        }
      }

      return versions;
    } catch (error) {
      console.error('Error fetching DXVK releases:', error);
      return [];
    }
  }

  /**
   * Fetch VKD3D-Proton releases from GitHub (for DX12 support)
   */
  private async fetchVkd3dProtonReleases(): Promise<AvailableDxvkVersion[]> {
    try {
      const response = await fetch(VKD3D_PROTON_RELEASES_URL, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Dillinger-Game-Library',
        },
      });

      if (!response.ok) {
        console.error(`Failed to fetch VKD3D-Proton releases: ${response.status}`);
        return [];
      }

      const releases = await response.json() as any[];
      const versions: AvailableDxvkVersion[] = [];

      for (const release of releases.slice(0, 10)) { // Last 10 releases
        const tarball = release.assets?.find((a: any) => 
          a.name.endsWith('.tar.zst') || a.name.endsWith('.tar.gz')
        );

        if (tarball) {
          versions.push({
            type: 'vkd3d-proton',
            version: release.tag_name.replace(/^v/, ''),
            displayName: `VKD3D-Proton ${release.tag_name}`,
            downloadUrl: tarball.browser_download_url,
            size: tarball.size,
            releaseDate: release.published_at,
            releaseNotes: release.body?.substring(0, 500),
          });
        }
      }

      return versions;
    } catch (error) {
      console.error('Error fetching VKD3D-Proton releases:', error);
      return [];
    }
  }

  /**
   * Download and install a DXVK version
   */
  async installVersion(
    version: AvailableDxvkVersion,
    progressCallback?: (progress: { stage: string; percent?: number }) => void
  ): Promise<InstalledDxvkVersion> {
    const versionId = `${version.type}-${version.version}`;
    const versionDir = path.join(DXVK_VERSIONS_DIR, versionId);
    
    // Check if already installed
    const index = await this.loadIndex();
    const existing = index.installedVersions.find(v => v.id === versionId);
    if (existing) {
      return existing;
    }

    progressCallback?.({ stage: 'Downloading', percent: 0 });
    
    // Create version directory
    await fs.ensureDir(versionDir);
    
    // Download the tarball
    const tarballPath = path.join(versionDir, 'download.tar.gz');
    await this.downloadFile(version.downloadUrl, tarballPath, (percent) => {
      progressCallback?.({ stage: 'Downloading', percent });
    });

    progressCallback?.({ stage: 'Extracting', percent: 0 });

    // Extract the tarball
    const extractCmd = version.downloadUrl.endsWith('.tar.zst')
      ? `tar --zstd -xf "${tarballPath}" -C "${versionDir}" --strip-components=1`
      : `tar -xzf "${tarballPath}" -C "${versionDir}" --strip-components=1`;
    
    await execAsync(extractCmd);
    
    // Clean up tarball
    await fs.remove(tarballPath);

    progressCallback?.({ stage: 'Finalizing', percent: 100 });

    // Detect available architectures
    const architectures: ('x32' | 'x64')[] = [];
    if (await fs.pathExists(path.join(versionDir, 'x32'))) {
      architectures.push('x32');
    }
    if (await fs.pathExists(path.join(versionDir, 'x64'))) {
      architectures.push('x64');
    }

    // Create installed version record
    const installed: InstalledDxvkVersion = {
      id: versionId,
      type: version.type,
      version: version.version,
      displayName: version.displayName,
      path: versionDir,
      installedAt: new Date().toISOString(),
      releaseNotes: version.releaseNotes,
      architectures,
    };

    // Update index
    index.installedVersions.push(installed);
    await this.saveIndex(index);

    return installed;
  }

  /**
   * Download a file with progress tracking
   */
  private async downloadFile(
    url: string,
    destPath: string,
    progressCallback?: (percent: number) => void
  ): Promise<void> {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Dillinger-Game-Library' },
    });

    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status}`);
    }

    const totalSize = parseInt(response.headers.get('content-length') || '0', 10);
    let downloadedSize = 0;

    const fileStream = createWriteStream(destPath);
    const reader = response.body?.getReader();
    
    if (!reader) {
      throw new Error('Failed to get response reader');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      fileStream.write(value);
      downloadedSize += value.length;
      
      if (totalSize > 0 && progressCallback) {
        progressCallback(Math.round((downloadedSize / totalSize) * 100));
      }
    }

    fileStream.close();
  }

  /**
   * Remove an installed DXVK version
   */
  async removeVersion(versionId: string): Promise<void> {
    const index = await this.loadIndex();
    const version = index.installedVersions.find(v => v.id === versionId);
    
    if (!version) {
      throw new Error(`DXVK version ${versionId} is not installed`);
    }

    // Remove version directory
    await fs.remove(version.path);

    // Update index
    index.installedVersions = index.installedVersions.filter(v => v.id !== versionId);
    
    // Reset default if this was the default
    if (index.defaultVersionId === versionId) {
      index.defaultVersionId = null;
    }
    
    await this.saveIndex(index);
  }

  /**
   * Get a specific installed version (including bundled versions)
   */
  async getVersion(versionId: string): Promise<InstalledDxvkVersion | null> {
    // Check for bundled versions first
    if (versionId === 'bundled-dxvk') {
      return getBundledDxvkVersion();
    }
    if (versionId === 'bundled-vkd3d-proton') {
      return getBundledVkd3dVersion();
    }
    
    // Check installed versions from index
    const index = await this.loadIndex();
    return index.installedVersions.find(v => v.id === versionId) || null;
  }

  /**
   * Install DXVK into a Wine prefix
   * This copies the DLL files and sets up the necessary overrides
   */
  async installToPrefix(
    versionId: string,
    prefixPath: string,
    arch: 'win32' | 'win64' = 'win64'
  ): Promise<void> {
    const version = await this.getVersion(versionId);
    if (!version) {
      throw new Error(`DXVK version ${versionId} is not installed`);
    }

    const system32 = path.join(prefixPath, 'drive_c', 'windows', 'system32');
    const syswow64 = path.join(prefixPath, 'drive_c', 'windows', 'syswow64');

    // Determine the correct directory names (DXVK uses x32/x64, VKD3D-Proton uses x86/x64)
    const dir64 = await fs.pathExists(path.join(version.path, 'x64')) ? 'x64' : null;
    const dir32 = await fs.pathExists(path.join(version.path, 'x32')) 
      ? 'x32' 
      : await fs.pathExists(path.join(version.path, 'x86')) 
        ? 'x86' 
        : null;

    // For 64-bit prefix: system32 = 64-bit DLLs, syswow64 = 32-bit DLLs
    // For 32-bit prefix: system32 = 32-bit DLLs only
    
    if (arch === 'win64' && dir64 && version.architectures.includes('x64')) {
      // Install 64-bit DLLs to system32
      await this.copyDxvkDlls(path.join(version.path, dir64), system32);
    }
    
    if (dir32 && version.architectures.includes('x32')) {
      const destDir = arch === 'win64' ? syswow64 : system32;
      await this.copyDxvkDlls(path.join(version.path, dir32), destDir);
    }
  }

  /**
   * Copy DXVK DLLs to a Windows system directory
   */
  private async copyDxvkDlls(srcDir: string, destDir: string): Promise<void> {
    await fs.ensureDir(destDir);
    
    const dllFiles = await fs.readdir(srcDir);
    for (const file of dllFiles) {
      if (file.endsWith('.dll')) {
        const srcPath = path.join(srcDir, file);
        const destPath = path.join(destDir, file);
        
        // Backup original if exists and not already a DXVK DLL
        const backupPath = `${destPath}.orig`;
        if (await fs.pathExists(destPath) && !await fs.pathExists(backupPath)) {
          await fs.move(destPath, backupPath);
        }
        
        await fs.copy(srcPath, destPath, { overwrite: true });
      }
    }
  }
}

// Export singleton instance
export const dxvkVersionsService = DxvkVersionsService.getInstance();
