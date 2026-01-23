'use client';

import { useState, useEffect } from 'react';

interface GOGAuthStatus {
  authenticated: boolean;
  connected: boolean;
  username?: string;
}

export default function OnlineSourcesPage() {
  const [gogAuthStatus, setGogAuthStatus] = useState<GOGAuthStatus>({ authenticated: false, connected: false });
  const [gameCount, setGameCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authWindow, setAuthWindow] = useState<Window | null>(null);
  const [gogAccessCode, setGogAccessCode] = useState('');
  const [accessCodeSaving, setAccessCodeSaving] = useState(false);
  const [accessCodeSuccess, setAccessCodeSuccess] = useState(false);
  const [showAuthCodeInput, setShowAuthCodeInput] = useState(false);

  // Check GOG authentication status on mount
  useEffect(() => {
    checkGOGAuthStatus();
  }, []);

  // Listen for OAuth callback messages
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Security check: verify origin
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data.type === 'GOG_AUTH_SUCCESS' && event.data.code) {
        console.log('Received GOG auth code, exchanging for token...');
        
        try {
          const response = await fetch('/api/online-sources/gog/callback', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code: event.data.code }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              console.log('GOG authentication successful!');
              setGogAuthStatus({ authenticated: true, connected: true, username: data.username });
              // Load games after successful authentication
              await loadGOGGames();
              // Close the auth window
              if (authWindow && !authWindow.closed) {
                authWindow.close();
              }
            }
          } else {
            const errorData = await response.json();
            setError(errorData.error || 'Failed to complete GOG authentication');
          }
        } catch (err) {
          setError('Failed to complete GOG authentication: ' + (err instanceof Error ? err.message : 'Unknown error'));
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [authWindow]);

  async function checkGOGAuthStatus() {
    try {
      const response = await fetch('/api/online-sources/gog/status');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setGogAuthStatus(data.status);
          // If authenticated, load games
          if (data.status.authenticated) {
            await loadGOGGames();
          }
        }
      }
    } catch (err) {
      console.error('Failed to check GOG auth status:', err);
    }
  }

  async function loginToGOG() {
    setError(null);
    setLoading(true);

    try {
      // Get the OAuth URL from the backend
      const response = await fetch('/api/online-sources/gog/auth-url');
      if (!response.ok) {
        throw new Error('Failed to get GOG auth URL');
      }

      const data = await response.json();
      if (!data.success || !data.authUrl) {
        throw new Error('Invalid response from server');
      }

      // Open popup window for GOG login
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        data.authUrl,
        'GOG Login',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`
      );

      if (!popup) {
        throw new Error('Failed to open popup window. Please allow popups for this site.');
      }

      setAuthWindow(popup);

      // Monitor popup window
      const checkWindowClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkWindowClosed);
          setAuthWindow(null);
          setLoading(false);
        }
      }, 500);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  }

  async function logoutFromGOG() {
    try {
      const response = await fetch('/api/online-sources/gog/logout', {
        method: 'POST',
      });

      if (response.ok) {
        setGogAuthStatus({ authenticated: false, connected: false });
        setGameCount(0);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to logout from GOG');
      }
    } catch (err) {
      setError('Failed to logout: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  async function loadGOGGames() {
    setLoading(true);

    try {
      // Just fetch page 1 with limit 1 to get the total count efficiently
      const response = await fetch('/api/online-sources/gog/games?page=1&limit=1');
      if (response.ok) {
        const data = await response.json();
        // Games API returns { games, total, page, limit, totalPages }
        if (data.total !== undefined) {
          setGameCount(data.total);
        } else if (data.error) {
          setError(data.error);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load GOG games');
      }
    } catch (err) {
      setError('Failed to load GOG games: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }

  // Auth codes are single-use, so we don't load/store them
  // The textbox should always be empty for entering new codes

  async function saveGOGAccessCode() {
    setAccessCodeSaving(true);
    setAccessCodeSuccess(false);
    setError(null);

    try {
      // Exchange the authorization code for access tokens
      const exchangeResponse = await fetch('/api/online-sources/gog/exchange-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: gogAccessCode }),
      });

      const exchangeData = await exchangeResponse.json();
      
      if (exchangeResponse.ok && exchangeData.success) {
        setAccessCodeSuccess(true);
        // Clear the code input on success (the code is single-use)
        setGogAccessCode('');
        setTimeout(() => setAccessCodeSuccess(false), 3000);
        // Refresh auth status to update connected state
        await checkGOGAuthStatus();
      } else {
        // Show the actual error from GOG
        const errorMessage = exchangeData.message || exchangeData.error || 'Failed to exchange code';
        setError(`GOG Authentication Failed: ${errorMessage}. The authorization code may have expired or already been used. Please get a new code.`);
      }
    } catch (err) {
      setError('Failed to exchange code: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setAccessCodeSaving(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-6 p-4">
      <div className="card">
        <div className="card-body">
          <h2 className="text-2xl font-bold text-text mb-4">Online Game Sources</h2>
          <p className="text-muted">
            Connect your online game library accounts to import and manage games from various platforms.
          </p>
        </div>
      </div>

      {error && (
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
              <h3 className="text-sm font-semibold text-danger-foreground">Error</h3>
              <p className="mt-2 text-sm text-muted">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* GOG Section */}
      <div className="card">
        <div className="card-body space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">GOG</span>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-text">GOG.com</h3>
                <p className="text-sm text-muted">
                  {gogAuthStatus.authenticated
                    ? `Logged in as ${gogAuthStatus.username || 'User'}`
                    : gogAuthStatus.connected
                    ? 'Connected'
                    : 'Not connected'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {gogAuthStatus.authenticated || gogAuthStatus.connected ? (
                <button
                  onClick={logoutFromGOG}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Logout
                </button>
              ) : (
                <button
                  onClick={loginToGOG}
                  disabled={loading}
                  className="btn-primary"
                >
                  {loading ? (
                    <>
                      <span className="animate-spin inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                      Connecting...
                    </>
                  ) : (
                    'Connect GOG Account'
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Authenticated: Show game count and browse button */}
          {(gogAuthStatus.authenticated || gogAuthStatus.connected) && (
            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary">{gameCount}</div>
                    <div className="text-sm text-muted">Games Owned</div>
                  </div>
                </div>
                <a
                  href="/online_sources/gog-library"
                  className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors inline-flex items-center gap-2 text-lg font-semibold"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                    />
                  </svg>
                  Browse Library
                </a>
              </div>
            </div>
          )}

          {/* Authorization Code Section - only show input if not logged in, or if user clicked button */}
          {(!gogAuthStatus.authenticated && !gogAuthStatus.connected) ? (
            <div className="pt-4 border-t border-border">
              <div className="space-y-3">
                <label htmlFor="gogAccessCode" className="block text-sm font-medium text-text">
                  GOG Authorization Code
                </label>
                <p className="text-xs text-muted">
                  Alternative login: Paste the authorization code from the GOG login redirect URL (code=...). It will be automatically exchanged for an access token.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="gogAccessCode"
                    value={gogAccessCode}
                    onChange={(e) => setGogAccessCode(e.target.value)}
                    placeholder="Paste authorization code from redirect URL..."
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-text focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    onClick={saveGOGAccessCode}
                    disabled={accessCodeSaving || !gogAccessCode.trim()}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {accessCodeSaving ? (
                      <>
                        <span className="animate-spin inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                        Exchanging...
                      </>
                    ) : (
                      'Exchange Code'
                    )}
                  </button>
                </div>
                {accessCodeSuccess && (
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Authentication successful!
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* When logged in, show a button to re-authenticate with a new code */
            <div className="pt-4 border-t border-border">
              {!showAuthCodeInput ? (
                <button
                  onClick={() => setShowAuthCodeInput(true)}
                  className="text-sm text-muted hover:text-text transition-colors"
                >
                  Paste new authorization code...
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label htmlFor="gogAccessCode" className="block text-sm font-medium text-text">
                      New Authorization Code
                    </label>
                    <button
                      onClick={() => {
                        setShowAuthCodeInput(false);
                        setGogAccessCode('');
                      }}
                      className="text-xs text-muted hover:text-text"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      id="gogAccessCode"
                      value={gogAccessCode}
                      onChange={(e) => setGogAccessCode(e.target.value)}
                      placeholder="Paste authorization code from redirect URL..."
                      className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-text focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      onClick={async () => {
                        await saveGOGAccessCode();
                        setShowAuthCodeInput(false);
                      }}
                      disabled={accessCodeSaving || !gogAccessCode.trim()}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {accessCodeSaving ? (
                        <>
                          <span className="animate-spin inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                          Exchanging...
                        </>
                      ) : (
                        'Exchange Code'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Future integrations placeholder */}
      <div className="card">
        <div className="card-body">
          <h3 className="text-lg font-semibold text-text mb-2">Coming Soon</h3>
          <p className="text-sm text-muted mb-4">
            Additional online game sources will be added in future updates:
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 border border-border rounded-lg opacity-50">
              <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center mb-2">
                <span className="text-white font-bold">Epic</span>
              </div>
              <p className="text-sm font-medium text-text">Epic Games Store</p>
            </div>
            <div className="p-4 border border-border rounded-lg opacity-50">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center mb-2">
                <span className="text-white font-bold">Steam</span>
              </div>
              <p className="text-sm font-medium text-text">Steam</p>
            </div>
            <div className="p-4 border border-border rounded-lg opacity-50">
              <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center mb-2">
                <span className="text-white font-bold">Xbox</span>
              </div>
              <p className="text-sm font-medium text-text">Xbox Game Pass</p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
