'use client';

import { useEffect, useState } from 'react';

interface HealthStatus {
  status: string;
  timestamp: string;
  version: string;
  storage: string;
  dataPath: string;
  uptime?: number;
  counts?: {
    games: number;
    platforms: number;
    sessions: number;
    collections: number;
  };
  environment?: {
    display: {
      x11: string | null;
      wayland: string | null;
      xauthority: string | null;
      x11SocketMounted: boolean;
      available: boolean;
    };
    docker: {
      socketMounted: boolean;
      socketPath: string;
    };
    gpu: {
      available: boolean;
      devices: string[];
    };
    audio: {
      pulseServer: string | null;
      pulseSocketMounted: boolean;
      soundDeviceMounted: boolean;
      available: boolean;
    };
    input: {
      devicesMounted: boolean;
    };
  };
}

export default function SystemInfo() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkHealth() {
      try {
        const response = await fetch('/api/health');
        if (response.ok) {
          const data = await response.json();
          setHealthStatus(data);
        }
      } finally {
        setLoading(false);
      }
    }

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="p-4 rounded-lg bg-surface/50 border border-border">
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!healthStatus) {
    return null;
  }

  return (
    <div className="p-4 rounded-lg bg-accent/10 border border-accent/30">
      <h3 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
        <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        System Information
      </h3>
      <dl className="space-y-3">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Version</dt>
          <dd className="mt-0.5 text-xs font-medium text-text">{healthStatus.version}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Storage</dt>
          <dd className="mt-0.5 text-xs font-medium text-text">{healthStatus.storage}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Data Path</dt>
          <dd className="mt-0.5 text-xs font-medium text-text font-mono break-all">{healthStatus.dataPath}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Uptime</dt>
          <dd className="mt-0.5 text-xs font-medium text-text">
            {healthStatus.uptime ? `${Math.floor(healthStatus.uptime / 60)} minutes` : 'Unknown'}
          </dd>
        </div>
        {healthStatus.counts && (
          <div className="pt-2 border-t border-border">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Library Stats</dt>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-surface/30 rounded px-2 py-1">
                <div className="text-xs text-muted">Games</div>
                <div className="text-sm font-bold text-text">{healthStatus.counts.games}</div>
              </div>
              <div className="bg-surface/30 rounded px-2 py-1">
                <div className="text-xs text-muted">Platforms</div>
                <div className="text-sm font-bold text-text">{healthStatus.counts.platforms}</div>
              </div>
              <div className="bg-surface/30 rounded px-2 py-1">
                <div className="text-xs text-muted">Sessions</div>
                <div className="text-sm font-bold text-text">{healthStatus.counts.sessions}</div>
              </div>
              <div className="bg-surface/30 rounded px-2 py-1">
                <div className="text-xs text-muted">Collections</div>
                <div className="text-sm font-bold text-text">{healthStatus.counts.collections}</div>
              </div>
            </div>
          </div>
        )}
      </dl>
    </div>
  );
}
