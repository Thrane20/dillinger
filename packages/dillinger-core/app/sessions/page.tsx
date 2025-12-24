'use client';

import { useState, useEffect } from 'react';
import { formatLastPlayed } from '../utils/timeFormat';

interface GameSession {
  id: string;
  gameId: string;
  gameTitle: string;
  gamePrimaryImage?: string;
  startTime: string;
  endTime?: string;
  duration: number; // in minutes
  screenshots?: string[];
  platform?: string;
  status: 'running' | 'completed' | 'crashed';
}

interface TimelineGroup {
  date: string;
  displayDate: string;
  sessions: GameSession[];
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  async function fetchSessions() {
    try {
      const response = await fetch('/api/sessions');
      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function launchGame(gameId: string) {
    try {
      const response = await fetch('/api/games/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, mode: 'local' }),
      });
      if (!response.ok) {
        throw new Error('Failed to launch game');
      }
    } catch (err) {
      console.error('Error launching game:', err);
    }
  }

  function formatDuration(minutes: number): string {
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  }

  function formatSessionDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  function getMonthYearHeader(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
    }).toUpperCase();
  }

  function groupSessionsByMonth(sessions: GameSession[]): TimelineGroup[] {
    const groups: { [key: string]: GameSession[] } = {};
    
    sessions.forEach(session => {
      const monthYear = getMonthYearHeader(session.startTime);
      if (!groups[monthYear]) {
        groups[monthYear] = [];
      }
      groups[monthYear].push(session);
    });

    return Object.entries(groups).map(([date, sessions]) => ({
      date,
      displayDate: date,
      sessions: sessions.sort((a, b) => 
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      ),
    }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted">Loading your gaming history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="alert-error">
            <h3 className="text-lg font-semibold text-danger-foreground">Error</h3>
            <p className="text-muted mt-2">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="card">
        <div className="card-body text-center py-12">
          <svg
            className="mx-auto h-16 w-16 text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="mt-4 text-xl font-medium text-text">No Gaming Sessions Yet</h3>
          <p className="mt-2 text-muted">
            Start playing some games and your history will appear here!
          </p>
          <div className="mt-6">
            <a href="/" className="btn-primary">
              Browse Games
            </a>
          </div>
        </div>
      </div>
    );
  }

  const timelineGroups = groupSessionsByMonth(sessions);

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-8 p-4">
      {/* Header */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-text">Gaming Timeline</h1>
              <p className="text-muted mt-2">
                Your complete gaming history • {sessions.length} session{sessions.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted">Total playtime</div>
              <div className="text-2xl font-bold text-text">
                {formatDuration(sessions.reduce((acc, s) => acc + s.duration, 0))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {timelineGroups.map((group, groupIndex) => (
          <div key={group.date} className="relative">
            {/* Month/Year Header */}
            <div className="sticky top-0 z-10 bg-background py-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent"></div>
                <h2 className="text-lg font-bold text-text tracking-wider px-4 py-2 bg-primary-soft rounded-full">
                  {group.displayDate}
                </h2>
                <div className="flex-1 h-px bg-gradient-to-l from-transparent via-border to-transparent"></div>
              </div>
            </div>

            {/* Sessions for this month */}
            <div className="relative">
              {/* Vertical Timeline Line */}
              <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/50 via-primary to-primary/50 -translate-x-1/2"></div>

              {group.sessions.map((session, index) => {
                const isLeft = index % 2 === 0;
                
                return (
                  <div key={session.id} className="relative mb-12">
                    {/* Timeline Node */}
                    <div className="absolute left-1/2 top-8 w-4 h-4 rounded-full bg-primary ring-4 ring-background -translate-x-1/2 z-10 shadow-lg"></div>

                    {/* Session Card */}
                    <div className={`flex items-start gap-8 ${isLeft ? 'flex-row-reverse' : 'flex-row'}`}>
                      {/* Left/Right Spacer */}
                      <div className="flex-1"></div>

                      {/* Content */}
                      <div className={`flex-1 ${isLeft ? 'pr-12' : 'pl-12'}`}>
                        <div className={`card hover:shadow-lg transition-all duration-200 ${
                          session.status === 'running' ? 'ring-2 ring-green-500' : ''
                        }`}>
                          <div className="card-body p-4">
                            <div className="flex gap-4">
                              {/* Game Thumbnail */}
                              <div className="flex-shrink-0">
                                {session.gamePrimaryImage ? (
                                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 relative group">
                                    <img
                                      src={session.gamePrimaryImage}
                                      alt={session.gameTitle}
                                      className="w-full h-full object-cover"
                                    />
                                    {session.status === 'running' && (
                                      <div className="absolute top-1 right-1">
                                        <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-lg"></span>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="w-20 h-20 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                    <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                )}
                              </div>

                              {/* Session Details */}
                              <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-semibold text-text truncate">
                                  {session.gameTitle}
                                </h3>
                                <div className="flex items-center gap-4 mt-1 text-sm text-muted">
                                  <div className="flex items-center gap-1">
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>{formatSessionDate(session.startTime)}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    <span>{formatDuration(session.duration)}</span>
                                  </div>
                                  {session.platform && (
                                    <div className="flex items-center gap-1">
                                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                                      </svg>
                                      <span className="capitalize">{session.platform}</span>
                                    </div>
                                  )}
                                </div>

                                {/* Screenshots Section */}
                                <div className="mt-3">
                                  {session.screenshots && session.screenshots.length > 0 ? (
                                    <div className="flex gap-2 overflow-x-auto pb-2">
                                      {session.screenshots.map((screenshot, idx) => (
                                        <div key={idx} className="flex-shrink-0">
                                          <img
                                            src={screenshot}
                                            alt={`Screenshot ${idx + 1}`}
                                            className="h-16 w-24 object-cover rounded border border-border hover:scale-105 transition-transform cursor-pointer"
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-muted italic bg-gray-50 dark:bg-gray-800 rounded px-3 py-2 inline-block">
                                      No screenshots
                                    </div>
                                  )}
                                </div>

                                {/* Action Button */}
                                <div className="mt-3">
                                  {session.status === 'running' ? (
                                    <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-md text-sm font-medium">
                                      <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                                      Currently Playing
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => launchGame(session.gameId)}
                                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground rounded-md text-sm font-medium transition-colors"
                                    >
                                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      Play it Again
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Timeline End Cap */}
        <div className="relative flex justify-center pt-8">
          <div className="bg-primary/20 rounded-full px-6 py-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              <span>Beginning of your journey</span>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
