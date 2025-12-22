'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

interface LogPanelProps {
  className?: string;
}

type TabType = 'containers' | 'core';

type LogLevel = 'error' | 'warning' | 'info';

const MAX_LOG_PREVIEW_CHARS = 140;

function inferLogLevel(line: string): LogLevel {
  const normalized = line.toLowerCase();

  if (
    normalized.includes('[error]') ||
    normalized.includes(' error ') ||
    normalized.startsWith('error') ||
    normalized.includes('err:') ||
    normalized.includes('failed')
  ) {
    return 'error';
  }

  if (
    normalized.includes('[warn]') ||
    normalized.includes('[warning]') ||
    normalized.includes(' warn ') ||
    normalized.startsWith('warn') ||
    normalized.includes('warning')
  ) {
    return 'warning';
  }

  return 'info';
}

function toPreviewText(line: string): string {
  const trimmed = line.trimEnd();
  if (trimmed.length <= MAX_LOG_PREVIEW_CHARS) {
    return trimmed;
  }
  return `${trimmed.slice(0, MAX_LOG_PREVIEW_CHARS - 1)}…`;
}

async function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

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
  const [showErrors, setShowErrors] = useState(true);
  const [showWarnings, setShowWarnings] = useState(true);
  const [showInfo, setShowInfo] = useState(true);
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
        setError('Log stream disconnected');
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
  const tabLabel = activeTab === 'containers' ? 'Runners' : 'Core';

  const filteredLines = useMemo(() => {
    const lines = (currentLogs || '').split('\n');

    return lines
      .map((line) => {
        const level = inferLogLevel(line);
        return {
          level,
          letter: level === 'error' ? 'E' : level === 'warning' ? 'W' : 'I',
          full: line,
          preview: toPreviewText(line),
        };
      })
      .filter((entry) => {
        if (entry.full.trim() === '') return false;
        if (entry.level === 'error') return showErrors;
        if (entry.level === 'warning') return showWarnings;
        return showInfo;
      });
  }, [currentLogs, showErrors, showWarnings, showInfo]);

  const handleCopy = async () => {
    try {
      const text = filteredLines.map((l) => l.full).join('\n');
      await copyToClipboard(text);
    } catch (err) {
      console.error('Failed to copy logs:', err);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Header with controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
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

          {/* Filters (apply to current tab view) */}
          <button
            type="button"
            onClick={() => setShowErrors((v) => !v)}
            className={`px-2 py-0.5 text-xs font-medium rounded-full border transition-colors ${
              showErrors
                ? 'bg-error/20 text-error border-error/30'
                : 'bg-surface/30 text-muted border-border hover:bg-surface/50'
            }`}
            title="Toggle error logs"
          >
            Errors
          </button>
          <button
            type="button"
            onClick={() => setShowWarnings((v) => !v)}
            className={`px-2 py-0.5 text-xs font-medium rounded-full border transition-colors ${
              showWarnings
                ? 'bg-warning/20 text-warning border-warning/30'
                : 'bg-surface/30 text-muted border-border hover:bg-surface/50'
            }`}
            title="Toggle warning logs"
          >
            Warnings
          </button>
          <button
            type="button"
            onClick={() => setShowInfo((v) => !v)}
            className={`px-2 py-0.5 text-xs font-medium rounded-full border transition-colors ${
              showInfo
                ? 'bg-primary/20 text-primary border-primary/30'
                : 'bg-surface/30 text-muted border-border hover:bg-surface/50'
            }`}
            title="Toggle info logs"
          >
            Info
          </button>
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
            Runners {containerCount > 0 && `(${containerCount})`}
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
      <div className="flex items-stretch gap-2">
        <button
          onClick={handleCopy}
          className="btn-primary w-1/2 text-xs"
          title="Copy filtered logs to clipboard"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy
        </button>
        <button
          onClick={handleClear}
          className="btn-primary w-1/2 text-xs"
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
          {error === 'Log stream disconnected' ? error : `Error: ${error}`}
        </div>
      )}

      {/* Log display area - 1/6 screen height + scroll */}
      <div
        ref={scrollRef}
        className="text-xs bg-surface/30 p-2 rounded border border-border overflow-y-auto scrollbar-visible"
        style={{ 
          height: 'calc(100vh / 6)',
          minHeight: '150px',
          maxHeight: '300px'
        }}
      >
        <table className="w-full text-xs">
          <tbody>
            {filteredLines.length === 0 ? (
              <tr>
                <td className="py-6 text-center text-muted italic" colSpan={2}>
                  {isConnected ? `Waiting for ${tabLabel} logs...` : 'Connecting to log stream...'}
                </td>
              </tr>
            ) : (
              filteredLines.map((entry, idx) => (
                <tr key={`${activeTab}-${idx}`} className="border-b border-border/40 last:border-0">
                  <td className="align-top py-1 pr-2 w-8">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded font-semibold ${
                        entry.level === 'error'
                          ? 'bg-error/20 text-error'
                          : entry.level === 'warning'
                          ? 'bg-warning/20 text-warning'
                          : 'bg-primary/20 text-primary'
                      }`}
                      title={entry.level}
                    >
                      {entry.letter}
                    </span>
                  </td>
                  <td className="py-1 font-mono text-text break-all" title={entry.full}>
                    {entry.preview}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Info text */}
      <p className="text-xs text-muted italic">
        {activeTab === 'containers' 
            ? 'Real-time logs from active runners (game launches and installers).' 
            : 'System logs from Dillinger Core backend.'}
      </p>
    </div>
  );
}
