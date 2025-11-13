'use client';

import { useState, useEffect } from 'react';
import type {
  GetScraperSettingsResponse,
  UpdateScraperSettingsRequest,
  ScraperType,
} from '@dillinger/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function SettingsPage() {
  const [settings, setSettings] = useState<GetScraperSettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const [igdbClientId, setIgdbClientId] = useState('');
  const [igdbClientSecret, setIgdbClientSecret] = useState('');
  
  // Audio settings
  const [availableAudioSinks, setAvailableAudioSinks] = useState<Array<{ id: string; name: string; description: string }>>([]);
  const [selectedAudioSink, setSelectedAudioSink] = useState('');
  
  // Docker settings
  const [autoRemoveContainers, setAutoRemoveContainers] = useState(false);
  
  // Download settings
  const [maxConcurrentDownloads, setMaxConcurrentDownloads] = useState(2);
  
  // Maintenance
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);
  
  // UI Settings
  const [backdropFadeDuration, setBackdropFadeDuration] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseFloat(localStorage.getItem('backdropFadeDuration') || '0.5');
    }
    return 0.5;
  });

  useEffect(() => {
    loadSettings();
    loadAudioSettings();
    loadDockerSettings();
    loadDownloadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/settings/scrapers`);
      if (!response.ok) {
        throw new Error('Failed to load settings');
      }
      const data: GetScraperSettingsResponse = await response.json();
      setSettings(data);
      
      // Populate IGDB credentials if they exist
      if (data.settings?.igdb) {
        setIgdbClientId(data.settings.igdb.clientId || '');
        setIgdbClientSecret(data.settings.igdb.clientSecret || '');
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const loadAudioSettings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/settings/audio`);
      if (!response.ok) {
        throw new Error('Failed to load audio settings');
      }
      const data = await response.json();
      setAvailableAudioSinks(data.availableSinks || []);
      setSelectedAudioSink(data.settings?.defaultSink || '');
    } catch (error) {
      console.error('Failed to load audio settings:', error);
    }
  };

  const saveIgdbSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!igdbClientId || !igdbClientSecret) {
      setMessage({ type: 'error', text: 'Please fill in all fields' });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);

      const payload: UpdateScraperSettingsRequest = {
        scraperType: 'igdb' as ScraperType,
        credentials: {
          clientId: igdbClientId,
          clientSecret: igdbClientSecret,
        },
      };

      const response = await fetch(`${API_BASE_URL}/api/settings/scrapers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      setMessage({ type: 'success', text: 'IGDB settings saved successfully!' });
      setIgdbClientId('');
      setIgdbClientSecret('');
      
      // Reload settings to update UI
      await loadSettings();
    } catch (error) {
      console.error('Failed to save settings:', error);
      setMessage({ type: 'error', text: 'Failed to save audio settings' });
    } finally {
      setSaving(false);
    }
  };

  const loadDockerSettings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/settings/docker`);
      if (!response.ok) {
        throw new Error('Failed to load Docker settings');
      }
      const data = await response.json();
      setAutoRemoveContainers(data.settings?.autoRemoveContainers || false);
    } catch (error) {
      console.error('Failed to load Docker settings:', error);
    }
  };

  const loadDownloadSettings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/settings/downloads`);
      if (!response.ok) {
        throw new Error('Failed to load download settings');
      }
      const data = await response.json();
      setMaxConcurrentDownloads(data.settings?.maxConcurrent || 2);
    } catch (error) {
      console.error('Failed to load download settings:', error);
    }
  };

  const saveDockerSettings = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const response = await fetch(`${API_BASE_URL}/api/settings/docker`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ autoRemoveContainers }),
      });

      if (!response.ok) {
        throw new Error('Failed to save Docker settings');
      }

      setMessage({ type: 'success', text: 'Docker settings saved successfully!' });
    } catch (error) {
      console.error('Failed to save Docker settings:', error);
      setMessage({ type: 'error', text: 'Failed to save Docker settings' });
    } finally {
      setSaving(false);
    }
  };

  const saveDownloadSettings = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const response = await fetch(`${API_BASE_URL}/api/settings/downloads`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ maxConcurrent: maxConcurrentDownloads }),
      });

      if (!response.ok) {
        throw new Error('Failed to save download settings');
      }

      setMessage({ type: 'success', text: 'Download settings saved successfully!' });
    } catch (error) {
      console.error('Failed to save download settings:', error);
      setMessage({ type: 'error', text: 'Failed to save download settings' });
    } finally {
      setSaving(false);
    }
  };

  const cleanupContainers = async () => {
    try {
      setCleanupLoading(true);
      setCleanupMessage(null);

      const response = await fetch(`${API_BASE_URL}/api/settings/maintenance/cleanup-containers`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to cleanup containers');
      }

      const data = await response.json();
      setCleanupMessage(data.message);
    } catch (error) {
      console.error('Failed to cleanup containers:', error);
      setCleanupMessage('Failed to cleanup containers');
    } finally {
      setCleanupLoading(false);
    }
  };

  const cleanupVolumes = async () => {
    try {
      setCleanupLoading(true);
      setCleanupMessage(null);

      const response = await fetch(`${API_BASE_URL}/api/settings/maintenance/cleanup-volumes`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to cleanup volumes');
      }

      const data = await response.json();
      setCleanupMessage(data.message);
    } catch (error) {
      console.error('Failed to cleanup volumes:', error);
      setCleanupMessage('Failed to cleanup volumes');
    } finally {
      setCleanupLoading(false);
    }
  };

  const saveUISettings = () => {
    localStorage.setItem('backdropFadeDuration', backdropFadeDuration.toString());
    setMessage({ type: 'success', text: 'UI settings saved successfully!' });
    
    // Dispatch custom event to notify games page
    window.dispatchEvent(new CustomEvent('backdropSettingsChanged'));
  };

  const saveAudioSettings = async () => {
    if (!selectedAudioSink) {
      setMessage({ type: 'error', text: 'Please select an audio output' });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);

      const response = await fetch(`${API_BASE_URL}/api/settings/audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ defaultSink: selectedAudioSink }),
      });

      if (!response.ok) {
        throw new Error('Failed to save audio settings');
      }

      setMessage({ type: 'success', text: 'Audio settings saved successfully!' });
      await loadAudioSettings();
    } catch (error) {
      console.error('Failed to save audio settings:', error);
      setMessage({ type: 'error', text: 'Failed to save audio settings' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-center">
          <div className="text-xl">Loading settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8">Settings</h1>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100'
              : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-8">
        {/* IGDB Settings */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">IGDB (Internet Game Database)</h2>
            <span
              className={`px-3 py-1 rounded-full text-sm ${
                settings?.availableScrapers.find((s) => s.type === 'igdb')?.enabled
                  ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
              }`}
            >
              {settings?.availableScrapers.find((s) => s.type === 'igdb')?.enabled
                ? 'Configured'
                : 'Not Configured'}
            </span>
          </div>

          <p className="text-gray-600 dark:text-gray-400 mb-4">
            IGDB provides comprehensive game metadata including screenshots, descriptions, release
            dates, and more. You'll need to register for a free API key at{' '}
            <a
              href="https://api-docs.igdb.com/#account-creation"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              api-docs.igdb.com
            </a>
          </p>

          <form onSubmit={saveIgdbSettings} className="space-y-4">
            <div>
              <label htmlFor="igdbClientId" className="block text-sm font-medium mb-1">
                Client ID
              </label>
              <input
                type="text"
                id="igdbClientId"
                value={igdbClientId}
                onChange={(e) => setIgdbClientId(e.target.value)}
                placeholder="Enter your IGDB Client ID"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="igdbClientSecret" className="block text-sm font-medium mb-1">
                Client Secret
              </label>
              <input
                type="password"
                id="igdbClientSecret"
                value={igdbClientSecret}
                onChange={(e) => setIgdbClientSecret(e.target.value)}
                placeholder="Enter your IGDB Client Secret"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {igdbClientSecret && igdbClientSecret.startsWith('*') && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Existing secret is hidden. Enter a new value to update it.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save IGDB Settings'}
            </button>
          </form>
        </div>

        {/* Future scrapers can be added here */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4">Other Scrapers</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Additional scraper integrations (SteamGridDB, Giant Bomb, etc.) will be available in
            future updates.
          </p>
        </div>

        {/* Audio Settings */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4">Audio Settings</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Select the default audio output device for games. This setting will be used by all game containers.
          </p>

          <div className="space-y-4">
            <div>
              <label htmlFor="audioSink" className="block text-sm font-medium mb-2">
                Audio Output Device
              </label>
              {availableAudioSinks.length > 0 ? (
                <select
                  id="audioSink"
                  value={selectedAudioSink}
                  onChange={(e) => setSelectedAudioSink(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select an audio output...</option>
                  {availableAudioSinks.map((sink) => (
                    <option key={sink.id} value={sink.id}>
                      {sink.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No audio outputs detected. Make sure PulseAudio or PipeWire is running.
                </p>
              )}
            </div>

            {availableAudioSinks.length > 0 && (
              <button
                onClick={saveAudioSettings}
                disabled={saving || !selectedAudioSink}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Audio Settings'}
              </button>
            )}
          </div>
        </div>

        {/* Docker Settings */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4">Docker Settings</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Configure how Docker containers are managed for game sessions.
          </p>

          <div className="space-y-4">
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="autoRemove"
                  type="checkbox"
                  checked={autoRemoveContainers}
                  onChange={(e) => setAutoRemoveContainers(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="autoRemove" className="font-medium text-gray-900 dark:text-gray-100">
                  Auto-remove containers
                </label>
                <p className="text-gray-600 dark:text-gray-400">
                  Automatically remove game containers when they stop. Disable this to keep containers for debugging.
                </p>
              </div>
            </div>

            <button
              onClick={saveDockerSettings}
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Docker Settings'}
            </button>
          </div>
        </div>

        {/* Download Settings */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4">Download Settings</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Configure download behavior for GOG installers and other content. Downloads run in separate worker threads to prevent blocking the UI.
          </p>

          <div className="space-y-4">
            <div>
              <label htmlFor="maxConcurrent" className="block text-sm font-medium mb-2">
                Maximum Concurrent Downloads (1-10)
              </label>
              <input
                type="number"
                id="maxConcurrent"
                min="1"
                max="10"
                value={maxConcurrentDownloads}
                onChange={(e) => setMaxConcurrentDownloads(parseInt(e.target.value) || 2)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Higher values download more files simultaneously but use more system resources. Each download runs in its own worker thread.
              </p>
            </div>

            <button
              onClick={saveDownloadSettings}
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Download Settings'}
            </button>
          </div>
        </div>

        {/* Maintenance */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4">Maintenance</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Clean up stopped containers and orphaned volumes to free up disk space.
          </p>

          {cleanupMessage && (
            <div className="mb-4 p-4 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100">
              {cleanupMessage}
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={cleanupContainers}
              disabled={cleanupLoading}
              className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {cleanupLoading ? 'Cleaning up...' : 'Clean Up Stopped Containers'}
            </button>

            <button
              onClick={cleanupVolumes}
              disabled={cleanupLoading}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {cleanupLoading ? 'Cleaning up...' : 'Clean Up Orphaned Volumes'}
            </button>

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              ⚠️ System volumes (dillinger_root, dillinger_installed, dillinger_installers) are protected and will not be removed.
            </p>
          </div>
        </div>

        {/* UI Settings */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4">UI Settings</h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="backdropFade" className="block text-sm font-medium mb-2">
                Backdrop Fade Duration
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Controls how quickly the background image transitions when hovering over game tiles.
              </p>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  id="backdropFade"
                  min="0"
                  max="2"
                  step="0.1"
                  value={backdropFadeDuration}
                  onChange={(e) => setBackdropFadeDuration(parseFloat(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm font-medium w-16 text-right">
                  {backdropFadeDuration.toFixed(1)}s
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>Instant (0s)</span>
                <span>Slow (2s)</span>
              </div>
            </div>

            <button
              onClick={saveUISettings}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Save UI Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
