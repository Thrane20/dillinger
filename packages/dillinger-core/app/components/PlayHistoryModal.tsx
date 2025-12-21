'use client';

import { useEffect, useState } from 'react';
import { formatPlayTime } from '../utils/timeFormat';

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

interface PlayHistoryModalProps {
  gameId: string;
  gameTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function PlayHistoryModal({ gameId, gameTitle, isOpen, onClose }: PlayHistoryModalProps) {
  const [sessions, setSessions] = useState<GameSessionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && gameId) {
      fetchSessions();
    }
  }, [isOpen, gameId]);

  async function fetchSessions() {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/launch/${gameId}/sessions`);
      if (!response.ok) {
        throw new Error('Failed to fetch session history');
      }
      
      const data = await response.json();
      if (data.success && data.sessions) {
        // Filter completed sessions and sort by start time, most recent first
        const sortedSessions = data.sessions
          .filter((s: GameSessionEntry) => s.status === 'stopped' && s.duration)
          .sort((a: GameSessionEntry, b: GameSessionEntry) => 
            new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
          );
        setSessions(sortedSessions);
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load play history');
    } finally {
      setLoading(false);
    }
  }

  function formatDateTime(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  function formatDuration(seconds: number): string {
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
  }

  const totalSeconds = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const totalHours = totalSeconds / 3600;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-text">Play History - {gameTitle}</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-text transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-180px)]">
          {loading ? (
            <div className="text-center py-8 text-muted">Loading play history...</div>
          ) : error ? (
            <div className="text-center py-8 text-red-600 dark:text-red-400">{error}</div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-muted">No play history available</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-4 font-semibold text-text">Session Date & Time</th>
                    <th className="text-left py-3 px-4 font-semibold text-text">Duration</th>
                    <th className="text-left py-3 px-4 font-semibold text-text">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session, index) => (
                    <tr 
                      key={session.id}
                      className={`border-b border-gray-100 dark:border-gray-700 ${
                        index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-800' : 'bg-white dark:bg-gray-900'
                      }`}
                    >
                      <td className="py-3 px-4 text-text">{formatDateTime(session.startTime)}</td>
                      <td className="py-3 px-4 text-text font-mono">
                        {session.duration ? formatDuration(session.duration) : 'N/A'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                          Completed
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer with Summary */}
        {!loading && !error && sessions.length > 0 && (
          <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted">
                <span className="font-semibold text-text">{sessions.length}</span> play session{sessions.length !== 1 ? 's' : ''} recorded
              </div>
              <div className="text-sm">
                <span className="text-muted">Total time played: </span>
                <span className="font-bold text-lg text-primary">{formatPlayTime(totalHours)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
