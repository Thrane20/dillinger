'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

type Session = {
  id: string;
  gameId: string;
  status: string;
  platformId: string;
  containerId?: string;
  created?: string;
  updated?: string;
};

function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin ${className}`}
    />
  );
}

export default function DebugSessionPage() {
  const params = useParams();
  const router = useRouter();

  const gameId = params.gameId as string;
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<Session | null>(null);
  const [gameTitle, setGameTitle] = useState<string>(gameId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [logsLoading, setLogsLoading] = useState(false);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [stopLoading, setStopLoading] = useState(false);
  const [stopRemoveLoading, setStopRemoveLoading] = useState(false);
  const [logsText, setLogsText] = useState('');
  const [inspectText, setInspectText] = useState('');
  const [containerName, setContainerName] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // AI Analysis state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiError, setAiError] = useState<string | null>(null);

  const containerIdShort = useMemo(() => {
    if (!session?.containerId) return 'N/A';
    return session.containerId.slice(0, 12);
  }, [session?.containerId]);

  useEffect(() => {
    void load();
  }, [gameId, sessionId]);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const [gameRes, sessionRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/launch/${gameId}`),
        fetch(`${API_BASE_URL}/api/launch/${gameId}/sessions/${sessionId}`),
      ]);

      if (gameRes.ok) {
        const gameData = await gameRes.json();
        if (gameData?.success && gameData?.game?.title) {
          setGameTitle(gameData.game.title);
        }
      }

      if (!sessionRes.ok) {
        const err = await sessionRes.json().catch(() => null);
        throw new Error(err?.error || 'Failed to load session');
      }

      const sessionData = await sessionRes.json();
      setSession(sessionData.session);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function fetchLogs(tail: number) {
    setLogsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/launch/${gameId}/sessions/${sessionId}/logs?tail=${tail}`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Failed to fetch logs');
      }
      const data = await res.json();
      setLogsText(data.logs || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLogsLoading(false);
    }
  }

  async function fetchInspect() {
    setInspectLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/launch/${gameId}/sessions/${sessionId}/inspect`
      );
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Failed to fetch inspect');
      }
      const data = await res.json();
      const name = typeof data?.inspect?.Name === 'string' ? data.inspect.Name : null;
      if (name) {
        setContainerName(name.startsWith('/') ? name.slice(1) : name);
      }
      setInspectText(JSON.stringify(data.inspect, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setInspectLoading(false);
    }
  }

  async function refresh() {
    setRefreshLoading(true);
    try {
      await load();
    } finally {
      setRefreshLoading(false);
    }
  }

  async function stopContainer() {
    setStopLoading(true);
    setError(null);
    setActionMessage(null);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/launch/${gameId}/sessions/${sessionId}/stop`,
        { method: 'POST' }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Failed to stop container');
      }
      setActionMessage('Container stopped.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setStopLoading(false);
    }
  }

  async function stopAndRemoveContainer() {
    setStopRemoveLoading(true);
    setError(null);
    setActionMessage(null);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/launch/${gameId}/sessions/${sessionId}/stop-remove`,
        { method: 'POST' }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Failed to stop+remove container');
      }
      setActionMessage('Container stopped and removed.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setStopRemoveLoading(false);
    }
  }

  async function askDillingerAI() {
    if (!logsText.trim()) {
      setAiError('Please load logs first before asking for AI analysis.');
      return;
    }

    setAiLoading(true);
    setAiError(null);
    setAiAnalysis('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/ai/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logs: logsText }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'AI analysis failed');
      }

      setAiAnalysis(data.analysis || 'No analysis returned.');
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'AI analysis failed');
    } finally {
      setAiLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center">
          <div className="text-xl">Loading debug session...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-auto">
      <div className="container mx-auto p-8 max-w-6xl">
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-primary hover:text-primary-hover mb-4"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold">Debug: {gameTitle}</h1>
            <div className="mt-2 text-sm text-muted font-mono">
              <div>gameId: {gameId}</div>
              <div>sessionId: {sessionId}</div>
              <div>
                containerId:{' '}
                {session?.containerId ? `${containerIdShort}…` : 'N/A'}
              </div>
              <div>containerName: {containerName ?? 'N/A'}</div>
              <div>status: {session?.status ?? 'unknown'}</div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => void refresh()}
              disabled={refreshLoading}
              className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-text hover:opacity-90 disabled:opacity-60"
            >
              {refreshLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block h-4 w-4 border-2 border-gray-800 dark:border-gray-200 border-t-transparent rounded-full animate-spin" />
                  Refreshing…
                </span>
              ) : (
                'Refresh'
              )}
            </button>
            <button
              onClick={() => void fetchInspect()}
              disabled={inspectLoading}
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {inspectLoading ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  Inspecting…
                </span>
              ) : (
                'Docker Inspect'
              )}
            </button>
            <button
              onClick={() => void fetchLogs(500)}
              disabled={logsLoading}
              className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
            >
              {logsLoading ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner />
                  Loading…
                </span>
              ) : (
                'Logs (tail 500)'
              )}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-800 dark:text-red-100">
          {error}
        </div>
      )}

      {actionMessage && (
        <div className="mb-6 bg-green-100 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-green-800 dark:text-green-100">
          {actionMessage}
        </div>
      )}

      <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-xl font-semibold">Container Controls</h2>
        </div>
        <div className="p-4 flex flex-wrap gap-3">
          <button
            onClick={() => void stopContainer()}
            disabled={stopLoading || stopRemoveLoading}
            className="px-4 py-2 rounded bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-60"
            title="Stop the running container (keeps it for inspection)"
          >
            {stopLoading ? (
              <span className="inline-flex items-center gap-2">
                <Spinner />
                Stopping…
              </span>
            ) : (
              'Stop'
            )}
          </button>
          <button
            onClick={() => void stopAndRemoveContainer()}
            disabled={stopLoading || stopRemoveLoading}
            className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
            title="Stop and remove the container"
          >
            {stopRemoveLoading ? (
              <span className="inline-flex items-center gap-2">
                <Spinner />
                Removing…
              </span>
            ) : (
              'Stop & Remove'
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-xl font-semibold">Container Logs</h2>
            <div className="flex gap-2">
              <button
                onClick={() => void fetchLogs(2000)}
                disabled={logsLoading}
                className="px-3 py-1 rounded bg-green-700 text-white hover:bg-green-800 disabled:opacity-60 text-sm"
              >
                {logsLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner className="h-3 w-3" />
                    Loading…
                  </span>
                ) : (
                  'tail 2000'
                )}
              </button>
              <button
                onClick={() => setLogsText('')}
                className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 text-text hover:opacity-90 text-sm"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="p-4">
            <textarea
              value={logsText}
              onChange={(e) => setLogsText(e.target.value)}
              className="w-full h-[420px] font-mono text-xs bg-gray-50 dark:bg-gray-900 text-text border border-border rounded p-3"
              placeholder="Click Logs to load docker logs…"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-xl font-semibold">Docker Inspect</h2>
            <div className="flex gap-2">
              <button
                onClick={() => void fetchInspect()}
                disabled={inspectLoading}
                className="px-3 py-1 rounded bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-60 text-sm"
              >
                Refresh
              </button>
              <button
                onClick={() => setInspectText('')}
                className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 text-text hover:opacity-90 text-sm"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="p-4">
            <textarea
              value={inspectText}
              onChange={(e) => setInspectText(e.target.value)}
              className="w-full h-[420px] font-mono text-xs bg-gray-50 dark:bg-gray-900 text-text border border-border rounded p-3"
              placeholder="Click Docker Inspect to load docker inspect JSON…"
            />
          </div>
        </div>
      </div>

      {/* AI Analysis Section */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🤖</span>
            <h2 className="text-xl font-semibold">Dillinger AI Assistant</h2>
          </div>
          <button
            onClick={() => void askDillingerAI()}
            disabled={aiLoading || !logsText.trim()}
            className="px-4 py-2 rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
            title={!logsText.trim() ? 'Load logs first to enable AI analysis' : 'Analyze logs with AI'}
          >
            {aiLoading ? (
              <>
                <Spinner />
                Analyzing…
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Ask Dillinger AI
              </>
            )}
          </button>
        </div>
        <div className="p-4">
          {aiError && (
            <div className="mb-4 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-red-800 dark:text-red-100 text-sm">
              {aiError}
            </div>
          )}
          {!logsText.trim() && !aiAnalysis && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <div className="text-4xl mb-3">📋</div>
              <p>Load container logs first, then click &quot;Ask Dillinger AI&quot; to get troubleshooting recommendations.</p>
              <p className="text-sm mt-2 text-gray-400 dark:text-gray-500">
                AI will analyze DLL issues, GPU errors, video playback problems, and suggest fixes.
              </p>
            </div>
          )}
          {logsText.trim() && !aiAnalysis && !aiLoading && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <div className="text-4xl mb-3">🔍</div>
              <p>Logs loaded! Click &quot;Ask Dillinger AI&quot; to analyze them.</p>
              <p className="text-sm mt-2 text-gray-400 dark:text-gray-500">
                The AI will look for Wine/Proton issues and provide recommendations for WINEDLLOVERRIDES, winetricks, and registry settings.
              </p>
            </div>
          )}
          {aiAnalysis && (
            <div className="prose dark:prose-invert max-w-none">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap overflow-auto max-h-[600px]">
                {aiAnalysis}
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
