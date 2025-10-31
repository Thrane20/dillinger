'use client';

import { useState, useEffect } from 'react';

interface HealthStatus {
  status: string;
  timestamp: string;
  version: string;
  storage: string;
  dataPath: string;
  uptime?: number;
  checks?: {
    storage: boolean;
    docker: boolean;
    metadata: boolean;
  };
  counts?: {
    games: number;
    platforms: number;
    sessions: number;
    collections: number;
  };
}

export default function HomePage() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkHealth() {
      try {
        const response = await fetch('/api/health');
        if (response.ok) {
          const data = await response.json();
          setHealthStatus(data);
        } else {
          setError('Failed to connect to backend API');
        }
      } catch (err) {
        setError('Backend API is not available');
      } finally {
        setLoading(false);
      }
    }

    checkHealth();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-10 transition-colors duration-300">
      {/* Status Banner */}
      {error ? (
        <div className="alert-error">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-danger" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <h3 className="text-sm font-semibold text-danger-foreground">Backend Connection Error</h3>
              <p className="mt-2 text-sm text-muted">
                {error}
                <span className="block">Make sure the backend server is running on port 3001.</span>
              </p>
            </div>
          </div>
        </div>
      ) : healthStatus?.status === 'healthy' ? (
        <div className="alert-success">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-success" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <h3 className="text-sm font-semibold text-success-foreground">System Healthy</h3>
              <p className="mt-2 text-sm text-muted">Backend API is running and storage is accessible.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="alert-warning">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-warning" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <h3 className="text-sm font-semibold text-warning-foreground">System Degraded</h3>
              <p className="mt-2 text-sm text-muted">Some services may not be fully operational.</p>
            </div>
          </div>
        </div>
      )}

      {/* Welcome Section */}
      <div className="neumorphic-panel text-center space-y-5">
        <h2 className="text-4xl font-bold text-text">Welcome to Dillinger</h2>
        <p className="text-lg text-muted max-w-3xl mx-auto">
          Your comprehensive game library management platform. Add games from any platform, organize your collection, and launch
          games in containerized environments with desktop streaming.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-4 py-2 font-medium text-primary">
            Powerful metadata management
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary/10 px-4 py-2 font-medium text-secondary">
            Cross-platform streaming
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-4 py-2 font-medium text-accent">
            Containerized sessions
          </span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <div className="card">
          <div className="card-body">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="text-lg font-semibold text-text">Your Games</h3>
                <p className="text-sm text-muted">
                  Browse your game library and launch games with one click.
                </p>
                <a href="/games" className="btn-primary">
                  View Games
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/15 text-secondary">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="text-lg font-semibold text-text">Add Games</h3>
                <p className="text-sm text-muted">
                  Add games from your file system and automatically fetch metadata from external sources.
                </p>
                <a href="/add-game" className="btn-secondary">
                  Add Game
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/20 text-accent">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="text-lg font-semibold text-text">Platforms</h3>
                <p className="text-sm text-muted">
                  Configure gaming platforms and execution environments for different game types.
                </p>
                <a href="/platforms" className="btn-accent">
                  View Platforms
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="card md:col-span-2 xl:col-span-1">
          <div className="card-body">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/15 text-secondary">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="text-lg font-semibold text-text">Collections</h3>
                <p className="text-sm text-muted">
                  Organize your games into collections for better management and discovery.
                </p>
                <a href="/collections" className="btn-secondary">
                  Create Collection
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* System Information */}
      {healthStatus && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-text">System Information</h3>
          </div>
          <div className="card-body">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Version</dt>
                <dd className="mt-1 text-sm font-medium text-text">{healthStatus.version}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Storage</dt>
                <dd className="mt-1 text-sm font-medium text-text">{healthStatus.storage}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Data Path</dt>
                <dd className="mt-1 text-sm font-medium text-text font-mono">{healthStatus.dataPath}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Uptime</dt>
                <dd className="mt-1 text-sm font-medium text-text">
                  {healthStatus.uptime ? `${Math.floor(healthStatus.uptime / 60)} minutes` : 'Unknown'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {/* Getting Started */}
      {(!healthStatus?.counts || (healthStatus.counts.games === 0 && healthStatus.counts.platforms === 0)) && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-text">Getting Started</h3>
          </div>
          <div className="card-body">
            <div className="prose max-w-none">
              <p className="text-muted">
                Welcome to Dillinger! To get started with your game library:
              </p>
              <ol className="list-decimal list-inside space-y-2 text-muted mt-4">
                <li>First, check out the available platforms and configure any you need</li>
                <li>Add your first game by clicking "Add Game" and selecting a game file</li>
                <li>Organize your games into collections for better management</li>
                <li>Launch games directly from your library with one click</li>
              </ol>
              <div className="mt-6 flex flex-wrap gap-3">
                <a href="/platforms" className="btn-primary">
                  View Platforms
                </a>
                <a href="/add-game" className="btn-neutral">
                  Add Your First Game
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
