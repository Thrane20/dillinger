// axios is available but currently unused - may be needed for direct downloads
// import axios from 'axios';
import fs from 'fs-extra';
import * as path from 'path';
import { EventEmitter } from 'events';
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { JSONStorageService } from './storage';
import { WebSocketService } from './websocket-service';
import { resolveDefaultPath } from './volume-defaults';
import { SettingsService } from './settings';
import type { VersionedData } from '@dillinger/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DownloadFile {
  url: string;
  filename: string;
  size?: number;
}

export interface DownloadProgress {
  gameId: string;
  gogId: string;
  title: string;
  totalFiles: number;
  completedFiles: number;
  currentFile: string;
  currentFileProgress: number; // 0-100
  totalProgress: number; // 0-100
  status: 'downloading' | 'completed' | 'failed' | 'paused';
  error?: string;
  downloadPath: string;
}

export interface DownloadJob {
  gameId: string;
  gogId: string;
  title: string;
  files: DownloadFile[];
  downloadPath: string;
  status: 'queued' | 'downloading' | 'completed' | 'failed' | 'paused';
  progress: DownloadProgress;
  startedAt?: string;
  completedAt?: string;
}

/**
 * Service to manage background game downloads from GOG
 */
export class DownloadManager extends EventEmitter {
  private static instance: DownloadManager;
  private static initPromise: Promise<void> | null = null;
  private activeDownloads: Map<string, DownloadJob> = new Map();
  private downloadQueue: DownloadJob[] = [];
  private cancelledDownloads: Map<string, DownloadJob> = new Map(); // Track cancelled downloads
  private storage: JSONStorageService;
  private wsService: WebSocketService;
  private maxConcurrentDownloads = 2;
  private activeWorkers: Map<string, Worker> = new Map();
  private initialized = false;

  // Serialize state writes to avoid concurrent fs operations corrupting JSON.
  private saveStateChain: Promise<void> = Promise.resolve();

  // Debounce frequent save triggers (progress events can be very chatty).
  private saveStateDebounceMs = 1000;
  private saveStateTimer: NodeJS.Timeout | null = null;

  // Cache for resolved paths to avoid repeated async lookups
  private resolvedDownloadsPath: string | null = null;

  private getDefaultDownloadsPath(): string {
    // Default downloads cache location
    const dillingerRoot = this.storage.getDillingerRoot();
    return path.join(dillingerRoot, 'storage', 'installer_cache');
  }

  /**
   * Get the downloads cache path, checking volume defaults first
   */
  private async getDownloadsCachePath(): Promise<string> {
    if (this.resolvedDownloadsPath) {
      return this.resolvedDownloadsPath;
    }
    
    const defaultPath = this.getDefaultDownloadsPath();
    this.resolvedDownloadsPath = await resolveDefaultPath('downloads', defaultPath);
    console.log(`[DownloadManager] Using downloads cache path: ${this.resolvedDownloadsPath}`);
    return this.resolvedDownloadsPath;
  }

  private async findGameFileKey(gameId: string): Promise<string | null> {
    const direct = await this.storage.readEntity<any>('games', gameId);
    if (direct) return gameId;

    const all = await this.storage.listEntities<any>('games');
    const found = all.find((g) => g?.id === gameId || g?.slug === gameId);
    return found?.id || null;
  }

  private async setGameDownloadStatus(
    gameId: string,
    update: {
      status: string;
      downloadProgress?: number;
      installerPath?: string;
      downloadCachePath?: string;
      error?: string;
    }
  ): Promise<void> {
    try {
      const fileKey = await this.findGameFileKey(gameId);
      if (!fileKey) return;

      const game = await this.storage.readEntity<any>('games', fileKey);
      if (!game) return;

      const now = new Date().toISOString();

      const nextInstallation = {
        ...(game.installation || {}),
        status: update.status,
        downloadProgress: update.downloadProgress,
        installerPath: update.installerPath ?? (game.installation?.installerPath || undefined),
        downloadCachePath: update.downloadCachePath ?? (game.installation?.downloadCachePath || undefined),
        error: update.error,
        installMethod: game.installation?.installMethod || 'automated',
      };

      const nextPlatforms = Array.isArray(game.platforms)
        ? game.platforms.map((p: any, index: number) => {
            const isTarget =
              (typeof game.defaultPlatformId === 'string' && p?.platformId === game.defaultPlatformId) ||
              (!game.defaultPlatformId && index === 0);

            if (!isTarget) return p;
            return {
              ...p,
              installation: {
                ...(p.installation || {}),
                status: update.status,
                installerPath: update.installerPath ?? (p.installation?.installerPath || undefined),
                downloadCachePath: update.downloadCachePath ?? (p.installation?.downloadCachePath || undefined),
                error: update.error,
                installMethod: p.installation?.installMethod || 'automated',
              },
            };
          })
        : game.platforms;

      const updatedGame = {
        ...game,
        installation: nextInstallation,
        platforms: nextPlatforms,
        updated: now,
      };

      await this.storage.writeEntity('games', fileKey, updatedGame);
    } catch (error) {
      console.error('[DownloadManager] Failed to update game download status:', error);
    }
  }

  private async moveDownloadedFilesToInstallers(job: DownloadJob): Promise<{ installerPath?: string; downloadCachePath?: string }> {
    // Check settings for installer cache mode
    const settingsService = SettingsService.getInstance();
    const downloadSettings = await settingsService.getDownloadSettings();
    const cacheMode = downloadSettings.installerCacheMode || 'with_game'; // Default to storing with game
    
    let destinationDir: string;
    
    if (cacheMode === 'with_game') {
      // Store installers alongside game metadata in dillinger_core/storage/games/{game-id}/installers/
      const dillingerRoot = this.storage.getDillingerRoot();
      destinationDir = path.join(dillingerRoot, 'storage', 'games', job.gameId, 'installers');
    } else if (cacheMode === 'custom_volume' && downloadSettings.installerCacheVolumeId) {
      // Use custom volume - resolve the volume path
      const volumePath = await this.resolveVolumeHostPath(downloadSettings.installerCacheVolumeId);
      if (volumePath) {
        // Prefer a human-friendly slug folder under the custom volume
        const gogSlug = job.gogId.replace(/^\d+-/, '') || job.gogId;
        destinationDir = path.join(volumePath, gogSlug, 'gog');
      } else {
        // Fallback to with_game if volume not found
        console.warn(`[DownloadManager] Custom volume ${downloadSettings.installerCacheVolumeId} not found, falling back to with_game mode`);
        const dillingerRoot = this.storage.getDillingerRoot();
        destinationDir = path.join(dillingerRoot, 'storage', 'games', job.gameId, 'installers');
      }
    } else {
      // Fallback: store with game
      const dillingerRoot = this.storage.getDillingerRoot();
      destinationDir = path.join(dillingerRoot, 'storage', 'games', job.gameId, 'installers');
    }
    
    await fs.ensureDir(destinationDir);

    let primaryInstallerPath: string | undefined;

    for (const file of job.files) {
      const filename = path.basename(file.filename);
      const sourcePath = path.join(job.downloadPath, filename);
      const destinationPath = path.join(destinationDir, filename);

      if (await fs.pathExists(sourcePath)) {
        await fs.move(sourcePath, destinationPath, { overwrite: true });
        if (!primaryInstallerPath) primaryInstallerPath = destinationPath;
      }
    }

    // If the cache directory is now empty, remove it.
    try {
      if (await fs.pathExists(job.downloadPath)) {
        const remaining = await fs.readdir(job.downloadPath);
        if (remaining.length === 0) {
          await fs.remove(job.downloadPath);
        }
      }
    } catch {
      // ignore
    }

    return { 
      installerPath: primaryInstallerPath,
      downloadCachePath: destinationDir,
    };
  }
  
  /**
   * Resolve a volume ID to its host path
   */
  private async resolveVolumeHostPath(volumeId: string): Promise<string | null> {
    try {
      const volumes = await this.storage.readEntity<VersionedData & { data: Array<{ id: string; hostPath: string }> }>('config', 'volumes');
      const volume = volumes?.data?.find(v => v.id === volumeId);
      return volume?.hostPath || null;
    } catch {
      return null;
    }
  }

  private resolveWorkerPath(): string {
    const candidates = [
      path.join(__dirname, '../workers/download-worker.js'),
      path.resolve(process.cwd(), 'packages/dillinger-core/lib/workers/download-worker.js'),
      path.resolve(process.cwd(), 'lib/workers/download-worker.js'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    throw new Error(
      `Download worker not found. Tried: ${candidates.join(' | ')}`
    );
  }

  private constructor() {
    super();
    this.storage = JSONStorageService.getInstance();
    this.wsService = WebSocketService.getInstance();
  }
  
  /**
   * Initialize the download manager (load state from disk)
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.loadMaxConcurrentDownloads();
    await this.loadDownloadState();
    this.initialized = true;
  }
  
  /**
   * Ensure the manager is initialized before operations
   */
  async ensureInitialized(): Promise<void> {
    if (!DownloadManager.initPromise) {
      DownloadManager.initPromise = this.initialize();
    }
    await DownloadManager.initPromise;
  }

  /**
   * Get the path to the download state file
   */
  private getDownloadStatePath(): string {
    const dillingerRoot = this.storage.getDillingerRoot();
    return path.join(dillingerRoot, 'storage', 'download-state.json');
  }

  /**
   * Save download state to disk
   */
  private buildDownloadState(): any {
    return {
      activeDownloads: Array.from(this.activeDownloads.entries()).map(([gameId, job]) => ({
        gameId,
        job: {
          ...job,
          // Don't save the worker reference
          status: this.activeWorkers.has(gameId) ? 'downloading' : job.status,
        },
      })),
      queue: this.downloadQueue.map((job) => ({
        ...job,
        status: 'paused',
      })),
      cancelled: Array.from(this.cancelledDownloads.entries()).map(([gameId, job]) => ({
        gameId,
        job,
      })),
    };
  }

  private queueDownloadStateSave(state: any): void {
    const statePath = this.getDownloadStatePath();

    this.saveStateChain = this.saveStateChain
      .then(async () => {
        try {
          await fs.ensureDir(path.dirname(statePath));
          const tmpPath = `${statePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
          await fs.writeFile(tmpPath, JSON.stringify(state, null, 2), 'utf8');
          await fs.rename(tmpPath, statePath);
        } catch (error) {
          console.error('[DownloadManager] Failed to save download state:', error);
        }
      })
      .catch((error) => {
        console.error('[DownloadManager] saveStateChain failure:', error);
      });
  }

  /**
   * Debounced save (use for frequent progress updates).
   */
  private saveDownloadStateDebounced(): void {
    if (this.saveStateTimer) return;
    this.saveStateTimer = setTimeout(() => {
      this.saveStateTimer = null;
      // Snapshot state at flush time so we persist the newest view.
      this.queueDownloadStateSave(this.buildDownloadState());
    }, this.saveStateDebounceMs);
  }

  /**
   * Immediate save (use for lifecycle events like completed/failed/cancel).
   */
  private saveDownloadStateNow(): void {
    if (this.saveStateTimer) {
      clearTimeout(this.saveStateTimer);
      this.saveStateTimer = null;
    }
    this.queueDownloadStateSave(this.buildDownloadState());
  }

  /**
   * Load download state from disk
   */
  private async loadDownloadState() {
    try {
      const statePath = this.getDownloadStatePath();
      if (await fs.pathExists(statePath)) {
        let state: any;
        try {
          state = await fs.readJson(statePath);
        } catch (parseError) {
          const stamp = new Date().toISOString().replace(/[:.]/g, '-');
          const backupPath = `${statePath}.corrupt-${stamp}.json`;
          try {
            await fs.move(statePath, backupPath, { overwrite: true });
            console.error(`[DownloadManager] Corrupt download-state.json detected; moved to ${backupPath}`);
          } catch (moveError) {
            console.error('[DownloadManager] Failed to move corrupt download-state.json aside:', moveError);
          }
          return;
        }
        
        // Restore active downloads as paused (since workers are gone)
        if (state.activeDownloads) {
          for (const { gameId, job } of state.activeDownloads) {
            this.activeDownloads.set(gameId, {
              ...job,
              status: 'paused',
            });
          }
        }
        
        // Restore queue
        if (state.queue) {
          this.downloadQueue = state.queue.map((job: DownloadJob) => ({
            ...job,
            status: 'paused',
          }));
        }
        
        // Restore cancelled downloads
        if (state.cancelled) {
          for (const { gameId, job } of state.cancelled) {
            this.cancelledDownloads.set(gameId, job);
          }
        }
        
        console.log(`[DownloadManager] Restored ${this.activeDownloads.size} paused downloads from previous session`);
      }
    } catch (error) {
      console.error('[DownloadManager] Failed to load download state:', error);
    }
  }

  /**
   * Load max concurrent downloads from settings
   */
  private async loadMaxConcurrentDownloads() {
    try {
      const settingsService = (await import('./settings')).SettingsService.getInstance();
      const settings = await settingsService.getDownloadSettings();
      if (settings.maxConcurrent) {
        this.maxConcurrentDownloads = settings.maxConcurrent;
        console.log(`[DownloadManager] Max concurrent downloads set to ${this.maxConcurrentDownloads}`);
      }
    } catch (error) {
      console.error('[DownloadManager] Failed to load max concurrent downloads:', error);
    }
  }

  /**
   * Update max concurrent downloads
   */
  setMaxConcurrentDownloads(max: number) {
    this.maxConcurrentDownloads = Math.max(1, Math.min(max, 10)); // Limit between 1-10
    console.log(`[DownloadManager] Max concurrent downloads updated to ${this.maxConcurrentDownloads}`);
  }

  static getInstance(): DownloadManager {
    if (!DownloadManager.instance) {
      DownloadManager.instance = new DownloadManager();
    }
    return DownloadManager.instance;
  }
  
  /**
   * Get an initialized instance (awaits state loading)
   */
  static async getInitializedInstance(): Promise<DownloadManager> {
    const instance = DownloadManager.getInstance();
    await instance.ensureInitialized();
    return instance;
  }

  /**
   * Start a new download job
   */
  async startDownload(
    gameId: string,
    gogId: string,
    title: string,
    files: DownloadFile[]
  ): Promise<void> {
    // Clear any cancelled state for this game when starting fresh
    this.cancelledDownloads.delete(gameId);
    
    // Use the configured downloads volume path, or fall back to default cache
    const downloadsCachePath = await this.getDownloadsCachePath();
    const downloadPath = path.join(downloadsCachePath, gogId);

    // Ensure download directory exists
    await fs.ensureDir(downloadPath);

    const job: DownloadJob = {
      gameId,
      gogId,
      title,
      files,
      downloadPath,
      status: 'queued',
      progress: {
        gameId,
        gogId,
        title,
        totalFiles: files.length,
        completedFiles: 0,
        currentFile: '',
        currentFileProgress: 0,
        totalProgress: 0,
        status: 'downloading',
        downloadPath,
      },
    };

    this.downloadQueue.push(job);
    this.activeDownloads.set(gameId, job);

    // Persist initial download state into the library JSON
    await this.setGameDownloadStatus(gameId, {
      status: 'downloading',
      downloadProgress: 0,
      error: undefined,
    });

    console.log(`[DownloadManager] Queued download for ${title} (${files.length} files)`);

    // Start processing queue
    this.processQueue();
  }

  /**
   * Get download progress for a game
   */
  getProgress(gameId: string): DownloadProgress | null {
    const job = this.activeDownloads.get(gameId);
    return job ? job.progress : null;
  }

  /**
   * Get all active downloads
   */
  getAllDownloads(): DownloadJob[] {
    return Array.from(this.activeDownloads.values());
  }

  /**
   * Process the download queue
   */
  private async processQueue(): Promise<void> {
    const activeCount = Array.from(this.activeDownloads.values()).filter(
      (j) => j.status === 'downloading'
    ).length;

    if (activeCount >= this.maxConcurrentDownloads) {
      return; // Already at max concurrent downloads
    }

    // Find next queued job
    const nextJob = this.downloadQueue.find((j) => j.status === 'queued');
    if (!nextJob) {
      return; // No queued jobs
    }

    // Start downloading
    await this.downloadJob(nextJob);
  }

  /**
   * Download all files for a job using a worker thread
   */
  private async downloadJob(job: DownloadJob): Promise<void> {
    job.status = 'downloading';
    job.startedAt = new Date().toISOString();

    console.log(`[DownloadManager] Starting download for ${job.title} in worker thread`);

    try {
      const workerPath = this.resolveWorkerPath();
      console.log(`[DownloadManager] Worker path: ${workerPath}`);
      
      const worker = new Worker(workerPath, {
        workerData: {
          files: job.files,
          downloadPath: job.downloadPath,
          gameId: job.gameId,
          gogId: job.gogId,
          title: job.title,
        },
      });

      this.activeWorkers.set(job.gameId, worker);

      // Listen to worker messages
      worker.on('message', (message: any) => {
        if (message.type === 'progress') {
          // Update job progress
          job.progress = {
            ...job.progress,
            ...message.data,
          };
          this.emit('download:progress', job.progress);
          this.wsService.broadcast({
            type: 'download-progress',
            body: message.data,
          });
          // Progress events are very frequent; debounce persistence.
          this.saveDownloadStateDebounced();
        } else if (message.type === 'completed') {
          // Download completed
          job.status = 'completed';
          job.completedAt = new Date().toISOString();
          job.progress.status = 'completed';
          job.progress.totalProgress = 100;

          console.log(`[DownloadManager] Download completed for ${job.title}`);
          this.emit('download:completed', job.progress);
          this.wsService.broadcast({
            type: 'download-progress',
            body: message.data,
          });

          // Move installers into the installers volume and update game state
          this.moveDownloadedFilesToInstallers(job)
            .then(({ installerPath, downloadCachePath }) =>
              this.setGameDownloadStatus(job.gameId, {
                status: 'ready_to_install',
                downloadProgress: 100,
                installerPath,
                downloadCachePath,
                error: undefined,
              })
            )
            .catch((err) => {
              console.error('[DownloadManager] Failed to move installers:', err);
              // Still mark as ready-to-install so UI reflects completion, but include error.
              this.setGameDownloadStatus(job.gameId, {
                status: 'ready_to_install',
                downloadProgress: 100,
                error: err instanceof Error ? err.message : String(err),
              });
            });

          // Cleanup - remove from all tracking when successfully completed
          this.activeWorkers.delete(job.gameId);
          this.activeDownloads.delete(job.gameId);
          this.cancelledDownloads.delete(job.gameId);
          this.downloadQueue = this.downloadQueue.filter((j) => j.gameId !== job.gameId);
          this.saveDownloadStateNow();
          this.processQueue();
        } else if (message.type === 'failed') {
          // Download failed
          job.status = 'failed';
          job.progress.status = 'failed';
          job.progress.error = message.data.error;

          console.error(`[DownloadManager] Download failed for ${job.title}:`, message.data.error);
          this.emit('download:failed', job.progress);
          this.wsService.broadcast({
            type: 'download-progress',
            body: {
              ...job.progress,
              status: 'failed',
              error: message.data.error,
            },
          });

          // Cleanup
          this.activeWorkers.delete(job.gameId);
          this.downloadQueue = this.downloadQueue.filter((j) => j.gameId !== job.gameId);
          this.saveDownloadStateNow();
          this.processQueue();

          // Persist a resumable state in the library JSON
          this.setGameDownloadStatus(job.gameId, {
            status: 'download_cancelled',
            downloadProgress: job.progress.totalProgress || 0,
            error: message.data?.error,
          });
        }
      });

      worker.on('error', (error) => {
        console.error(`[DownloadManager] Worker error for ${job.title}:`, error);
        job.status = 'failed';
        job.progress.status = 'failed';
        job.progress.error = error.message;
        
        // Broadcast error state
        this.emit('download:failed', job.progress);
        this.wsService.broadcast({
          type: 'download-progress',
          body: {
            ...job.progress,
            status: 'failed',
            error: error.message,
          },
        });
        
        // Cleanup
        this.activeWorkers.delete(job.gameId);
        this.downloadQueue = this.downloadQueue.filter((j) => j.gameId !== job.gameId);
        this.saveDownloadStateNow();
        this.processQueue();

        // Persist a resumable state in the library JSON
        this.setGameDownloadStatus(job.gameId, {
          status: 'download_cancelled',
          downloadProgress: job.progress.totalProgress || 0,
          error: error.message,
        });
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          console.error(`[DownloadManager] Worker stopped with exit code ${code}`);
        }
        this.activeWorkers.delete(job.gameId);
      });
    } catch (error) {
      console.error(`[DownloadManager] Failed to start worker for ${job.title}:`, error);
      job.status = 'failed';
      job.progress.status = 'failed';
      job.progress.error = error instanceof Error ? error.message : 'Unknown error';
      this.emit('download:failed', job.progress);

      // Cleanup and process next
      this.activeWorkers.delete(job.gameId);
      this.downloadQueue = this.downloadQueue.filter((j) => j.gameId !== job.gameId);
      this.processQueue();
    }
  }

  /**
   * Get download status for a specific game
   */
  getDownloadStatus(gameId: string): DownloadProgress | null {
    // Check cancelled downloads first (highest priority)
    const cancelledJob = this.cancelledDownloads.get(gameId);
    if (cancelledJob) {
      return {
        ...cancelledJob.progress,
        status: 'failed', // Frontend will convert this to download_cancelled
        error: 'Download cancelled by user',
      };
    }
    
    const download = this.activeDownloads.get(gameId);
    if (download) {
      return download.progress;
    }
    
    // Check if it's in the queue
    const queuedJob = this.downloadQueue.find(j => j.gameId === gameId);
    if (queuedJob) {
      return queuedJob.progress;
    }
    
    return null;
  }

  /**
   * Cancel a download
   */
  async cancelDownload(gameId: string): Promise<void> {
    const worker = this.activeWorkers.get(gameId);
    const job = this.downloadQueue.find((j) => j.gameId === gameId);
    
    if (worker && job) {
      // Store the job in cancelled downloads before removing
      job.status = 'failed';
      job.progress.status = 'failed';
      job.progress.error = 'Download cancelled by user';
      this.cancelledDownloads.set(gameId, job);
      
      await worker.terminate();
      this.activeWorkers.delete(gameId);
      console.log(`[DownloadManager] Terminated worker for game ${gameId}`);
      
      // Broadcast cancellation to clients
      this.wsService.broadcast({
        type: 'download-progress',
        body: {
          gameId: job.gameId,
          gogId: job.gogId,
          title: job.title,
          status: 'failed',
          totalFiles: job.progress.totalFiles,
          completedFiles: job.progress.completedFiles,
          currentFile: job.progress.currentFile,
          currentFileProgress: job.progress.currentFileProgress,
          totalProgress: job.progress.totalProgress,
          error: 'Download cancelled by user',
        },
      });
    }
    
    this.downloadQueue = this.downloadQueue.filter((j) => j.gameId !== gameId);
    this.activeDownloads.delete(gameId);
    this.saveDownloadStateNow();

    await this.setGameDownloadStatus(gameId, {
      status: 'download_cancelled',
      downloadProgress: job?.progress?.totalProgress || 0,
      error: 'Download cancelled by user',
    });
  }

  /**
   * Clean up completed downloads older than specified days
   */
  async cleanupOldDownloads(daysOld: number = 30): Promise<void> {
    const now = Date.now();
    const threshold = daysOld * 24 * 60 * 60 * 1000;

    for (const [gameId, job] of this.activeDownloads.entries()) {
      if (job.status === 'completed' && job.completedAt) {
        const completedAt = new Date(job.completedAt).getTime();
        if (now - completedAt > threshold) {
          this.activeDownloads.delete(gameId);
        }
      }
    }
  }
}
