import axios from 'axios';
import fs from 'fs-extra';
import * as path from 'path';
import { EventEmitter } from 'events';
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { JSONStorageService } from './storage.js';
import { WebSocketService } from './websocket-service.js';

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
  private activeDownloads: Map<string, DownloadJob> = new Map();
  private downloadQueue: DownloadJob[] = [];
  private cancelledDownloads: Map<string, DownloadJob> = new Map(); // Track cancelled downloads
  private storage: JSONStorageService;
  private wsService: WebSocketService;
  private maxConcurrentDownloads = 2;
  private activeWorkers: Map<string, Worker> = new Map();

  private constructor() {
    super();
    this.storage = JSONStorageService.getInstance();
    this.wsService = WebSocketService.getInstance();
    this.loadMaxConcurrentDownloads();
    this.loadDownloadState();
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
  private async saveDownloadState() {
    try {
      const statePath = this.getDownloadStatePath();
      const state = {
        activeDownloads: Array.from(this.activeDownloads.entries()).map(([gameId, job]) => ({
          gameId,
          job: {
            ...job,
            // Don't save the worker reference
            status: this.activeWorkers.has(gameId) ? 'downloading' : job.status,
          },
        })),
        queue: this.downloadQueue.map(job => ({
          ...job,
          status: 'paused', // Mark queued items as paused on restart
        })),
        cancelled: Array.from(this.cancelledDownloads.entries()).map(([gameId, job]) => ({
          gameId,
          job,
        })),
      };
      await fs.writeJson(statePath, state, { spaces: 2 });
    } catch (error) {
      console.error('[DownloadManager] Failed to save download state:', error);
    }
  }

  /**
   * Load download state from disk
   */
  private async loadDownloadState() {
    try {
      const statePath = this.getDownloadStatePath();
      if (await fs.pathExists(statePath)) {
        const state = await fs.readJson(statePath);
        
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
      const settingsService = (await import('./settings.js')).SettingsService.getInstance();
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
    
    const dillingerRoot = this.storage.getDillingerRoot();
    const downloadPath = path.join(dillingerRoot, 'storage', 'installer_cache', gogId);

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
      // Detect if running from src (tsx in dev) or dist (node in production)
      // In dev: __dirname = .../backend/src/services, need ../../dist/workers/download-worker.js
      // In prod: __dirname = .../backend/dist/services, need ../workers/download-worker.js
      const isDevMode = __dirname.includes('/src/');
      const workerPath = isDevMode 
        ? path.resolve(__dirname, '../../dist/workers/download-worker.js')
        : path.join(__dirname, '../workers/download-worker.js');
      
      console.log(`[DownloadManager] Dev mode: ${isDevMode}, Worker path: ${workerPath}`);
      
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
          // Save state periodically (debounce to avoid too many writes)
          this.saveDownloadState();
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

          // Cleanup - remove from all tracking when successfully completed
          this.activeWorkers.delete(job.gameId);
          this.activeDownloads.delete(job.gameId);
          this.cancelledDownloads.delete(job.gameId);
          this.downloadQueue = this.downloadQueue.filter((j) => j.gameId !== job.gameId);
          this.saveDownloadState();
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
          this.saveDownloadState();
          this.processQueue();
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
        this.processQueue();
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
    this.saveDownloadState();
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
