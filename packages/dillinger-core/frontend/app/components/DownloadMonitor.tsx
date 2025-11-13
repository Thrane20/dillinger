'use client';

import { useState, useEffect } from 'react';
import type { DownloadProgressBody } from '@dillinger/shared';

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
  error?: string;
}

export default function DownloadMonitor() {
  const [downloads, setDownloads] = useState<Map<string, Download>>(new Map());
  const [downloadSpeeds, setDownloadSpeeds] = useState<Record<string, number>>({});
  const [prevProgress, setPrevProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    // WebSockets cannot be proxied by Next.js, connect directly to backend
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const backendHost = process.env.NEXT_PUBLIC_BACKEND_URL || 'localhost:3001';
    const wsUrl = `${protocol}//${backendHost}/ws/logs`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[DownloadMonitor] WebSocket connected to', wsUrl);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'download-progress') {
          const body: DownloadProgressBody = message.body;
          
          setDownloads((prev) => {
            const newMap = new Map(prev);
            
            // If download is completed or failed, remove it immediately
            if (body.status === 'completed' || body.status === 'failed') {
              newMap.delete(body.gameId);
              return newMap;
            }
            
            // Add or update the download (only if downloading/queued)
            newMap.set(body.gameId, {
              gameId: body.gameId,
              gogId: body.gogId,
              title: body.title,
              status: body.status,
              totalFiles: body.totalFiles,
              completedFiles: body.completedFiles,
              currentFile: body.currentFile,
              currentFileProgress: body.currentFileProgress,
              totalProgress: body.totalProgress,
              error: body.error,
            });
            
            return newMap;
          });

          // Calculate download speed
          const currentProgress = body.totalProgress;
          const prevValue = prevProgress[body.gameId] || 0;
          const progressDiff = currentProgress - prevValue;
          
          if (progressDiff > 0) {
            setDownloadSpeeds((prev) => ({
              ...prev,
              [body.gameId]: progressDiff * 0.5, // Arbitrary multiplier for display
            }));
            setPrevProgress((prev) => ({ ...prev, [body.gameId]: currentProgress }));
          }
        }
      } catch (error) {
        console.error('[DownloadMonitor] Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[DownloadMonitor] WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('[DownloadMonitor] WebSocket disconnected');
    };

    return () => {
      ws.close();
    };
  }, [prevProgress]);

  const activeDownloads = Array.from(downloads.values()).filter(
    (d) => d.status === 'downloading' || d.status === 'queued'
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

  return (
    <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
      <h3 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
        <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
        </svg>
        Downloads {activeDownloads.length > 0 ? `(${activeDownloads.length} active)` : '(idle)'}
      </h3>
      
      {activeDownloads.length === 0 ? (
        // Idle state with sparkline
        <div className="space-y-2">
          <div className="text-xs text-muted">No active downloads</div>
          {/* Idle sparkline */}
          <div className="flex gap-0.5 h-4">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm bg-gray-200 dark:bg-gray-700 transition-all"
                style={{
                  height: `${20 + Math.random() * 30}%`,
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
              </span>
              {downloadSpeeds[download.gameId] > 0 && (
                <span className="ml-2 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  {downloadSpeeds[download.gameId].toFixed(1)} MB/s
                </span>
              )}
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
