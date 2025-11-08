'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface GameSessionEntry {
  id: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  exitCode?: number;
  status: 'starting' | 'running' | 'stopped' | 'error';
  containerId?: string;
  platformId: string;
}

interface SessionStats {
  totalSessions: number;
  totalPlayTime: number;
  lastPlayed?: string;
  averageSessionLength: number;
}

export default function SessionsPage() {
  const params = useParams();
  const router = useRouter();
  const gameId = params.id as string;
  
  const [sessions, setSessions] = useState<GameSessionEntry[]>([]);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, [gameId]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/launch/${gameId}/sessions`);
      
      if (!response.ok) {
        throw new Error('Failed to load sessions');
      }

      const data = await response.json();
      setSessions(data.sessions || []);
      setStats(data.stats || null);
    } catch (err) {
      console.error('Failed to load sessions:', err);
      setError('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return 'N/A';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const formatDate = (isoString: string): string => {
    return new Date(isoString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center">
          <div className="text-xl">Loading sessions...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-8">
        <div className="bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-800 dark:text-red-100">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8 max-w-6xl">
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-primary hover:text-primary-hover mb-4"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Games
        </button>
        <h1 className="text-4xl font-bold">Game Sessions</h1>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="text-sm text-muted mb-1">Total Sessions</div>
            <div className="text-3xl font-bold text-text">{stats.totalSessions}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="text-sm text-muted mb-1">Total Play Time</div>
            <div className="text-3xl font-bold text-text">{formatDuration(stats.totalPlayTime)}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="text-sm text-muted mb-1">Average Session</div>
            <div className="text-3xl font-bold text-text">{formatDuration(Math.floor(stats.averageSessionLength))}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <div className="text-sm text-muted mb-1">Last Played</div>
            <div className="text-sm font-medium text-text">
              {stats.lastPlayed ? new Date(stats.lastPlayed).toLocaleDateString() : 'Never'}
            </div>
          </div>
        </div>
      )}

      {/* Sessions List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="p-6 border-b border-border">
          <h2 className="text-2xl font-semibold">Session History</h2>
        </div>

        {sessions.length === 0 ? (
          <div className="p-8 text-center text-muted">
            No sessions recorded yet. Launch the game to start tracking!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                    Start Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                    Platform
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                    Session ID
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sessions
                  .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                  .map((session) => (
                    <tr key={session.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text">
                        {formatDate(session.startTime)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-text">
                        {formatDuration(session.duration)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            session.status === 'stopped'
                              ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                              : session.status === 'running'
                              ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300'
                              : session.status === 'error'
                              ? 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                          }`}
                        >
                          {session.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted font-mono">
                        {session.platformId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-muted font-mono">
                        {session.id.substring(0, 8)}...
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
