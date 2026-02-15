'use client';

import LogPanel from './LogPanel';
import DownloadMonitor from './DownloadMonitor';

export default function RightSidebar() {
  return (
    <div className="h-full flex flex-col card border-2 border-secondary/30 shadow-lg bg-surface/75 backdrop-blur-sm">
      <div className="card-body flex flex-col h-full overflow-hidden">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
            <div className="w-8 h-8 rounded-lg bg-secondary/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-text">Info Panel</h2>
          </div>
          
          <div className="space-y-4 flex-1 overflow-y-auto">
            {/* Download Monitor - Show above logs when there are active downloads */}
            <DownloadMonitor />

            {/* Container Logs - Permanent at top */}
            <div className="p-4 rounded-lg bg-surface/50 border border-border">
              <LogPanel />
            </div>

            <div className="p-4 rounded-lg bg-surface/50 border border-border">
              <h3 className="text-sm font-semibold text-text mb-2">Game Info</h3>
              <p className="text-xs text-muted italic">This space for rent</p>
            </div>
            
            <div className="p-4 rounded-lg bg-surface/50 border border-border">
              <h3 className="text-sm font-semibold text-text mb-2">Scraping Tools</h3>
              <p className="text-xs text-muted italic">This space for rent</p>
            </div>
            
            <div className="p-4 rounded-lg bg-surface/50 border border-border">
              <h3 className="text-sm font-semibold text-text mb-2">Settings</h3>
              <p className="text-xs text-muted italic">This space for rent</p>
            </div>

          </div>
        </div>
      </div>
  );
}
