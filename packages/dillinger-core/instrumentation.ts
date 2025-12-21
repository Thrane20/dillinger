/**
 * Next.js Instrumentation
 * This file is executed once when the server starts.
 * Used to initialize singletons and restore state from disk.
 */

export async function register() {
  // Only run on the server (not edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[Instrumentation] Initializing server-side services...');

    // If the user hasn't approved first-run scaffolding yet, skip initialization
    // to avoid creating settings/download state before onboarding completes.
    try {
      const { isDillingerRootInitialized } = await import('./lib/services/bootstrap');
      const initialized = await isDillingerRootInitialized();
      if (!initialized) {
        console.log('[Instrumentation] Setup not completed yet; skipping service initialization');
        return;
      }
    } catch {
      // If bootstrap status can't be determined, fall back to previous behavior.
    }
    
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
