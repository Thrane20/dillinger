'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface Download {
  gameId: string;
  gogId: string;
  title: string;
  status: string;
  totalFiles: number;
  completedFiles: number;
  currentFile: string;
  currentFileProgress: number;
  totalProgress: number;
  totalSize?: number; // Total size in bytes if available
  error?: string;
}

export default function DownloadMonitor() {
  const [downloads, setDownloads] = useState<Map<string, Download>>(new Map());
  const [downloadSpeeds, setDownloadSpeeds] = useState<Record<string, number>>({});
  const [sparklineHeights, setSparklineHeights] = useState<number[]>([]);
  const prevProgressRef = useRef<Record<string, { progress: number; time: number }>>({});

  // Fetch downloads from API
  const fetchDownloads = useCallback(async () => {
    try {
      const response = await fetch('/api/online-sources/gog/downloads');
      if (!response.ok) return;
      
      const data = await response.json();
      const now = Date.now();
      
      const newSpeeds: Record<string, number> = {};
      
      setDownloads(() => {
        const newMap = new Map<string, Download>();
        
        for (const dl of data.downloads || []) {
          // Calculate total size from files array if available
          const totalSize = dl.files?.reduce((sum: number, f: { size?: number }) => sum + (f.size || 0), 0) || 0;
          
          // Map the API response to our Download interface
          const download: Download = {
            gameId: dl.gameId,
            gogId: dl.gogId,
            title: dl.title,
            status: dl.status,
            totalFiles: dl.progress?.totalFiles || dl.files?.length || 0,
            completedFiles: dl.progress?.completedFiles || 0,
            currentFile: dl.progress?.currentFile || '',
            currentFileProgress: dl.progress?.currentFileProgress || 0,
            totalProgress: dl.progress?.totalProgress || 0,
            totalSize,
            error: dl.progress?.error,
          };
          
          // Calculate download speed based on progress difference
          const prev = prevProgressRef.current[dl.gameId];
          const currentProgress = download.totalProgress;
          
          if (prev && totalSize > 0) {
            const progressDiff = currentProgress - prev.progress;
            const timeDiff = (now - prev.time) / 1000; // seconds
            
            if (progressDiff > 0 && timeDiff > 0) {
              // Calculate bytes downloaded based on progress percentage
              const bytesDownloaded = (progressDiff / 100) * totalSize;
              const speedMBps = (bytesDownloaded / 1024 / 1024) / timeDiff;
              newSpeeds[dl.gameId] = speedMBps;
            } else if (download.status === 'paused' || progressDiff === 0) {
              // Show 0 speed when paused or no progress
              newSpeeds[dl.gameId] = 0;
            }
          } else {
            // No previous data or no size info - show 0
            newSpeeds[dl.gameId] = 0;
          }
          
          // Update previous progress tracking
          prevProgressRef.current[dl.gameId] = { progress: currentProgress, time: now };
          newMap.set(dl.gameId, download);
        }
        
        return newMap;
      });
      
      // Update speeds after processing
      setDownloadSpeeds(newSpeeds);
    } catch (error) {
      console.error('[DownloadMonitor] Error fetching downloads:', error);
    }
  }, []);

  // Initialize sparkline heights only on client
  useEffect(() => {
    setSparklineHeights(Array.from({ length: 20 }, () => 20 + Math.random() * 30));
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchDownloads();
    
    // Poll every 2 seconds
    const interval = setInterval(fetchDownloads, 2000);
    
    return () => {
      clearInterval(interval);
    };
  }, [fetchDownloads]);

  const activeDownloads = Array.from(downloads.values()).filter(
    (d) => d.status === 'downloading' || d.status === 'queued' || d.status === 'paused'
  );

  const handleCancelDownload = async (gameId: string) => {
    try {
      const response = await fetch(`/api/games/${gameId}/download`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        console.log('[DownloadMonitor] Download cancelled for', gameId);
        // Remove from local state immediately
        setDownloads((prev) => {
          const newMap = new Map(prev);
          newMap.delete(gameId);
          return newMap;
        });
      } else {
        console.error('[DownloadMonitor] Failed to cancel download');
      }
    } catch (error) {
      console.error('[DownloadMonitor] Error cancelling download:', error);
    }
  };

  const handleCancelAllDownloads = async () => {
    const downloadList = Array.from(activeDownloads);
    console.log('[DownloadMonitor] Cancelling all downloads:', downloadList.length);
    
    for (const download of downloadList) {
      await handleCancelDownload(download.gameId);
    }
  };

  return (
    <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
          Downloads {activeDownloads.length > 0 ? `(${activeDownloads.length} active)` : '(idle)'}
        </h3>
        {activeDownloads.length > 0 && (
          <button
            onClick={handleCancelAllDownloads}
            className="text-xs px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
            title="Cancel all downloads"
          >
            Cancel All
          </button>
        )}
      </div>
      
      {activeDownloads.length === 0 ? (
        // Idle state with sparkline
        <div className="space-y-2">
          <div className="text-xs text-muted">No active downloads</div>
          {/* Idle sparkline */}
          <div className="flex gap-0.5 h-4">
            {sparklineHeights.map((height, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm bg-gray-200 dark:bg-gray-700 transition-all"
                style={{
                  height: `${height}%`,
                  opacity: 0.3,
                }}
              />
            ))}
          </div>
        </div>
      ) : (
        // Active downloads
        <div className="space-y-3">
          {activeDownloads.map((download) => (
          <div key={download.gameId} className="space-y-2">
            {/* Game Title with Cancel Button */}
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-medium text-text truncate flex-1">{download.title}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-muted">{download.totalProgress}%</span>
                <button
                  onClick={() => handleCancelDownload(download.gameId)}
                  className="text-xs px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                  title="Cancel download"
                >
                  Cancel
                </button>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-blue-600 dark:bg-blue-500 h-full transition-all duration-300"
                style={{ width: `${download.totalProgress}%` }}
              ></div>
            </div>
            
            {/* Download Stats */}
            <div className="flex items-center justify-between text-xs text-muted">
              <span className="truncate flex-1">
                {download.completedFiles}/{download.totalFiles} files
                {download.status === 'paused' && <span className="ml-2 text-yellow-600 dark:text-yellow-400">(Paused)</span>}
              </span>
              <span className="ml-2 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                {(downloadSpeeds[download.gameId] || 0).toFixed(1)} MB/s
              </span>
            </div>
            
            {/* Current File */}
            {download.currentFile && (
              <div className="text-xs text-muted italic truncate">
                {download.currentFile}
              </div>
            )}
            
            {/* Sparkline placeholder (simple progress indicator) */}
            <div className="flex gap-0.5 h-4">
              {Array.from({ length: 20 }).map((_, i) => {
                const threshold = (i / 20) * 100;
                const isActive = download.totalProgress > threshold;
                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-sm transition-all ${
                      isActive 
                        ? 'bg-blue-600 dark:bg-blue-500' 
                        : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                    style={{
                      height: `${20 + Math.random() * 80}%`,
                      opacity: isActive ? 0.8 : 0.3,
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
        </div>
      )}
    </div>
  );
}
