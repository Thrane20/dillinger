'use client';

import SystemInfo from './SystemInfo';

export default function LeftSidebar() {
  return (
    <div className="h-full flex flex-col card border-2 border-primary/30 shadow-lg bg-surface/75 backdrop-blur-sm">
      <div className="card-body flex flex-col h-full overflow-hidden">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
        </div>

        <div className="space-y-3 flex-1 overflow-y-auto">
          <SystemInfo />

          {/* Filters Section */}
          <div className="pt-2">
            <div className="p-4 rounded-lg bg-surface/50 border border-border">
              <h3 className="text-sm font-semibold text-text mb-2">Filters</h3>
              <p className="text-xs text-muted italic">This space for rent</p>
            </div>
          </div>

          {/* Collections Section */}
          <div className="p-4 rounded-lg bg-surface/50 border border-border">
            <h3 className="text-sm font-semibold text-text mb-2">Collections</h3>
            <p className="text-xs text-muted italic">This space for rent</p>
          </div>
        </div>
      </div>
    </div>
  );
}
