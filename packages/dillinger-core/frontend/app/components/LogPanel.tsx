'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface LogPanelProps {
  className?: string;
}

type TabType = 'containers' | 'core';

interface ActiveContainerLog {
  containerId: string;
  type: string;
  gameName: string;
  logs: string;
}

export default function LogPanel({ className = '' }: LogPanelProps) {
  const [containerLogs, setContainerLogs] = useState<string>('');
  const [coreLogs, setCoreLogs] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabType>('containers');
  const [isConnected, setIsConnected] = useState(false);
  const [containerCount, setContainerCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const appendCoreLog = useCallback((entry: string) => {
    setCoreLogs((prev) => (prev ? `${prev}\n${entry}` : entry));
  }, []);

  const fetchContainerLogs = useCallback(async () => {
    try {
      const response = await fetch('/api/games/active-containers/logs?tail=200');
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch container logs');
      }

      const containers: ActiveContainerLog[] = data.containers || [];
      setContainerCount(data.count ?? containers.length ?? 0);

      if (containers.length === 0) {
        setContainerLogs('');
        return;
      }

      const formatted = containers
        .map((container) => {
          const header = `\n${'='.repeat(80)}\n[${(container.type || 'container').toUpperCase()}] ${container.gameName || 'Unknown Game'}\nContainer: ${(container.containerId || '').substring(0, 12)}\n${'='.repeat(80)}\n`;
          return `${header}${container.logs || ''}`;
        })
        .join('\n');

      setContainerLogs(formatted.trimStart());
      setError(null);
    } catch (err) {
      console.error('Failed to fetch container logs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch container logs');
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const connect = () => {
      if (!isMounted) {
        return;
      }

      const source = new EventSource('/api/logs/core/stream');
      eventSourceRef.current = source;

      source.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      source.onmessage = (event) => {
        if (!event.data) {
          return;
        }

        try {
          const payload = JSON.parse(event.data);

          if (payload.type === 'connected') {
            appendCoreLog('[connected] Log stream established');
            return;
          }

          if (payload.type === 'log' || payload.type === 'info') {
            const timestamp = payload.timestamp || new Date().toISOString();
            const level = (payload.level || payload.type || 'info').toUpperCase();
            const message = payload.message || payload.msg || JSON.stringify(payload);
            appendCoreLog(`[${timestamp}] [${level}] ${message}`);
          }
        } catch (err) {
          console.error('Failed to parse log stream message:', err);
        }
      };

      source.onerror = () => {
        if (!isMounted) {
          return;
        }

        setIsConnected(false);
        setError('Core log stream disconnected');
        source.close();

        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
        }
        reconnectTimerRef.current = setTimeout(connect, 5000);
      };
    };

    connect();
    fetchContainerLogs();
    const interval = setInterval(fetchContainerLogs, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [appendCoreLog, fetchContainerLogs]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [containerLogs, coreLogs, activeTab]);

  const handleClear = () => {
    if (activeTab === 'containers') {
      setContainerLogs('');
      setContainerCount(0);
    } else {
      setCoreLogs('');
    }
    setError(null);
  };

  const currentLogs = activeTab === 'containers' ? containerLogs : coreLogs;

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Header with controls */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-text">Logs</h3>
          {isConnected ? (
            <span className="px-2 py-0.5 text-xs font-medium bg-success/20 text-success rounded-full flex items-center gap-1">
              <span className="w-2 h-2 bg-success rounded-full animate-pulse"></span>
              Live
            </span>
          ) : (
            <span className="px-2 py-0.5 text-xs font-medium bg-error/20 text-error rounded-full">
              Disconnected
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-2">
          <button
            onClick={() => setActiveTab('containers')}
            className={`px-3 py-1 text-xs font-medium rounded-t-lg transition-colors ${
              activeTab === 'containers' 
                ? 'bg-primary/20 text-primary border-b-2 border-primary' 
                : 'text-muted hover:text-text hover:bg-surface/50'
            }`}
          >
            Containers {containerCount > 0 && `(${containerCount})`}
          </button>
          <button
            onClick={() => setActiveTab('core')}
            className={`px-3 py-1 text-xs font-medium rounded-t-lg transition-colors ${
              activeTab === 'core' 
                ? 'bg-primary/20 text-primary border-b-2 border-primary' 
                : 'text-muted hover:text-text hover:bg-surface/50'
            }`}
          >
            Core
          </button>
      </div>

      {/* Control buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleClear}
          className="btn btn-sm btn-error flex-1"
          title="Clear log display"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Clear
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="p-2 bg-error/10 border border-error/30 rounded text-xs text-error">
          Error: {error}
        </div>
      )}

      {/* Log display area - 1/6 screen height + scroll */}
      <div
        ref={scrollRef}
        className="font-mono text-xs bg-black/90 text-green-400 p-3 rounded border border-primary/30 overflow-y-auto whitespace-pre-wrap break-all"
        style={{ 
          height: 'calc(100vh / 6)',
          minHeight: '150px',
          maxHeight: '300px'
        }}
      >
        {currentLogs || (isConnected ? `Waiting for ${activeTab} logs...` : 'Connecting to log stream...')}
      </div>

      {/* Info text */}
      <p className="text-xs text-muted italic">
        {activeTab === 'containers' 
            ? 'Real-time logs from active game launches and installations.' 
            : 'System logs from Dillinger Core backend.'}
      </p>
    </div>
  );
}
