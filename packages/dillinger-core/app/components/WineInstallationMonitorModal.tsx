'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface WineInstallationMonitorModalProps {
  gameId: string;
  gameTitle: string;
  onClose: () => void;
  onCancel: () => void;
}

type RunnerStatus = 'unknown' | 'starting' | 'running' | 'stopped' | 'error';
type ActivityStatus = 'idle' | 'active' | 'quiet';

export default function WineInstallationMonitorModal({
  gameId,
  gameTitle,
  onClose,
  onCancel,
}: WineInstallationMonitorModalProps) {
  const [logs, setLogs] = useState<string>('');
  const [runnerStatus, setRunnerStatus] = useState<RunnerStatus>('unknown');
  const [activityStatus, setActivityStatus] = useState<ActivityStatus>('idle');
  const [lastLogLength, setLastLogLength] = useState(0);
  const [lastActivityTime, setLastActivityTime] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const quietTimeoutRef = useRef<number | null>(null);
  const hasReceivedLogs = useRef(false);

  // Time thresholds (in ms)
  const QUIET_THRESHOLD = 30000; // 30 seconds without activity = "uh oh"
  const POLL_INTERVAL = 2000; // Poll every 2 seconds

  // Scroll to bottom of logs
  const scrollToBottom = useCallback(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Fetch logs - this is the primary way to detect if the runner is up
  const fetchStatus = useCallback(async () => {
    try {
      // Fetch container logs - if this succeeds, the container exists
      const logsResponse = await fetch(`/api/games/${gameId}/container-logs?type=install&tail=200`);
      const logsData = await logsResponse.json();

      if (logsData.success && logsData.logs !== undefined) {
        // Successfully got logs = container is running
        setRunnerStatus('running');
        hasReceivedLogs.current = true;
        
        const newLogs = logsData.logs;
        const newLength = newLogs.length;

        // Detect activity - if log length changed, we have activity
        if (newLength !== lastLogLength) {
          setActivityStatus('active');
          setLastActivityTime(Date.now());
          setLastLogLength(newLength);

          // Clear any pending quiet timeout
          if (quietTimeoutRef.current) {
            window.clearTimeout(quietTimeoutRef.current);
          }

          // Set new quiet timeout
          quietTimeoutRef.current = window.setTimeout(() => {
            setActivityStatus('quiet');
          }, QUIET_THRESHOLD);
        }

        setLogs(newLogs);
        setError(null);
      } else if (logsData.error) {
        // Container might not exist yet or has exited
        if (logsData.error.includes('No container found') || logsData.error.includes('Session has no containerId')) {
          // If we previously had logs but now don't, container has stopped
          if (hasReceivedLogs.current) {
            setRunnerStatus('stopped');
          } else {
            // Still waiting for container to start
            setRunnerStatus('starting');
          }
        }
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
      // Only set error status if we never received logs (otherwise it might be transient)
      if (!hasReceivedLogs.current) {
        setRunnerStatus('error');
      }
    }
  }, [gameId, lastLogLength]);

  // Poll for updates
  useEffect(() => {
    // Initial fetch
    fetchStatus();

    // Set up polling interval
    const interval = setInterval(fetchStatus, POLL_INTERVAL);

    return () => {
      clearInterval(interval);
      if (quietTimeoutRef.current) {
        window.clearTimeout(quietTimeoutRef.current);
      }
    };
  }, [fetchStatus]);

  // Auto-scroll when logs update
  useEffect(() => {
    scrollToBottom();
  }, [logs, scrollToBottom]);

  // Check for quiet state on mount
  useEffect(() => {
    const checkQuiet = () => {
      const timeSinceActivity = Date.now() - lastActivityTime;
      if (timeSinceActivity > QUIET_THRESHOLD && activityStatus === 'active') {
        setActivityStatus('quiet');
      }
    };

    const quietCheckInterval = setInterval(checkQuiet, 5000);
    return () => clearInterval(quietCheckInterval);
  }, [lastActivityTime, activityStatus]);

  // Runner status indicator
  const getRunnerStatusDisplay = () => {
    switch (runnerStatus) {
      case 'starting':
        return {
          color: 'bg-yellow-500',
          text: 'Starting...',
          animate: 'animate-pulse',
        };
      case 'running':
        return {
          color: 'bg-green-500',
          text: 'Running',
          animate: '',
        };
      case 'stopped':
        return {
          color: 'bg-gray-500',
          text: 'Stopped',
          animate: '',
        };
      case 'error':
        return {
          color: 'bg-red-500',
          text: 'Error',
          animate: '',
        };
      default:
        return {
          color: 'bg-gray-400',
          text: 'Checking...',
          animate: 'animate-pulse',
        };
    }
  };

  const statusDisplay = getRunnerStatusDisplay();

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-surface border border-border rounded-xl shadow-2xl max-w-3xl w-full mx-4 max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-purple-500/10 to-blue-500/10">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {/* Meditating Guru Icon */}
              <div className="text-5xl" role="img" aria-label="meditating guru">
                🧘
              </div>
              <div>
                <h2 className="text-xl font-bold text-text">Wine Installation in Progress</h2>
                <p className="text-sm text-muted mt-1">
                  Installing <span className="font-semibold text-purple-400">{gameTitle}</span>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-muted hover:text-text transition-colors p-1"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Zen Message */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-900/20 to-purple-900/20 border-b border-border">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🍃</span>
            <div>
              <p className="text-sm text-text">
                <span className="font-medium">Take a breath.</span> Wine installations can take time to start up and shut down.
              </p>
              <p className="text-xs text-muted mt-1">
                If there's a delay where nothing appears to be happening, relax — it's normal for Wine processes.
              </p>
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div className="px-6 py-3 bg-surface/50 border-b border-border flex items-center justify-between">
          {/* Runner Status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted uppercase tracking-wide">Wine Runner:</span>
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${statusDisplay.color} ${statusDisplay.animate}`} />
                <span className="text-sm font-medium text-text">{statusDisplay.text}</span>
              </div>
            </div>
          </div>

          {/* Activity Indicator */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted uppercase tracking-wide">Activity:</span>
            {activityStatus === 'active' && (
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="w-3 h-3 rounded-full bg-green-500 animate-ping absolute" />
                  <div className="w-3 h-3 rounded-full bg-green-500 relative" />
                </div>
                <span className="text-sm font-medium text-green-400">Things are happening!</span>
              </div>
            )}
            {activityStatus === 'idle' && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-400" />
                <span className="text-sm text-muted">Waiting for activity...</span>
              </div>
            )}
            {activityStatus === 'quiet' && (
              <div className="flex items-center gap-2 bg-yellow-500/20 px-3 py-1 rounded-full">
                <span className="text-lg">😬</span>
                <span className="text-sm font-medium text-yellow-400">Uh oh... runner has gone very quiet</span>
              </div>
            )}
          </div>
        </div>

        {/* Logs Panel */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="px-4 py-2 bg-gray-900/50 border-b border-border flex items-center justify-between">
            <span className="text-xs font-medium text-muted uppercase tracking-wide">Runner Logs</span>
            <span className="text-xs text-gray-500">{logs ? `${logs.split('\n').length} lines` : 'No logs yet'}</span>
          </div>
          <div className="flex-1 overflow-auto bg-gray-950 p-4">
            {error && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
                {error}
              </div>
            )}
            {logs ? (
              <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap break-words leading-relaxed">
                {logs}
                <div ref={logsEndRef} />
              </pre>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted">
                <div className="text-4xl mb-3 animate-bounce">⏳</div>
                <p className="text-sm">Waiting for container to start...</p>
                <p className="text-xs mt-1 text-gray-500">Logs will appear here once the runner is up</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-surface/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Complete the installer in the Wine desktop when it appears</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-red-400 border border-red-500/50 rounded-lg hover:bg-red-500/10 transition-colors"
            >
              Cancel Installation
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-text bg-surface border border-border rounded-lg hover:bg-hover transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
