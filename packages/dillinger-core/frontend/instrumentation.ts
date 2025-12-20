/**
 * Next.js Instrumentation
 * This file is executed once when the server starts.
 * Used to initialize singletons and restore state from disk.
 */

export async function register() {
  // Only run on the server (not edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Initializing server-side services...');
    
    // Initialize DownloadManager to restore download state
    const { DownloadManager } = await import('./lib/services/download-manager');
    const downloadManager = await DownloadManager.getInitializedInstance();
    
    // Log status
    const status = downloadManager.getAllDownloads();
    const pausedCount = status.filter(d => d.status === 'paused').length;
    const downloadingCount = status.filter(d => d.status === 'downloading').length;
    
    if (pausedCount > 0 || downloadingCount > 0) {
      console.log(`[Instrumentation] Download state restored: ${pausedCount} paused, ${downloadingCount} downloading`);
    }
    
    console.log('[Instrumentation] Server-side services initialized');
  }
}
