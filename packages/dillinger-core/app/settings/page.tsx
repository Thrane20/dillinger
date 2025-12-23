'use client';

import { useState, useEffect } from 'react';
import type {
  GetScraperSettingsResponse,
  UpdateScraperSettingsRequest,
  ScraperType,
} from '@dillinger/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

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

  // GPU settings
  const [gpuVendor, setGpuVendor] = useState<'auto' | 'amd' | 'nvidia'>('auto');
  
  // Download settings
  const [maxConcurrentDownloads, setMaxConcurrentDownloads] = useState(2);
  
  // Joystick settings
  const [joysticks, setJoysticks] = useState<Array<{ id: string; name: string; path: string }>>([]);
  const [joystickSettings, setJoystickSettings] = useState<Record<string, { deviceId: string; deviceName: string }>>({});
  const [selectedJoystickPlatform, setSelectedJoystickPlatform] = useState('arcade');

  // Platform Config settings
  const [platformConfigContent, setPlatformConfigContent] = useState('');
  const [selectedConfigPlatform, setSelectedConfigPlatform] = useState('arcade');
  const [configLoading, setConfigLoading] = useState(false);

  // Maintenance
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);

  // Factory Reset (Danger Zone)
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  
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
    loadGpuSettings();
    loadDownloadSettings();
    loadJoystickSettings();
    loadPlatformConfig('arcade');
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
      setMessage({ type: 'error', text: 'Failed to save IGDB settings' });
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

  const loadGpuSettings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/settings/gpu`);
      if (!response.ok) {
        throw new Error('Failed to load GPU settings');
      }
      const data = await response.json();
      const vendor = data.settings?.vendor;
      if (vendor === 'amd' || vendor === 'nvidia' || vendor === 'auto') {
        setGpuVendor(vendor);
      } else {
        setGpuVendor('auto');
      }
    } catch (error) {
      console.error('Failed to load GPU settings:', error);
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

  const saveGpuSettings = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const response = await fetch(`${API_BASE_URL}/api/settings/gpu`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ vendor: gpuVendor }),
      });

      if (!response.ok) {
        throw new Error('Failed to save GPU settings');
      }

      setMessage({ type: 'success', text: 'GPU settings saved successfully!' });
    } catch (error) {
      console.error('Failed to save GPU settings:', error);
      setMessage({ type: 'error', text: 'Failed to save GPU settings' });
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

  const performFactoryReset = async () => {
    if (resetConfirmText !== 'DELETE EVERYTHING') {
      return;
    }

    try {
      setResetLoading(true);

      const response = await fetch(`${API_BASE_URL}/api/settings/maintenance/factory-reset`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to perform factory reset');
      }

      // Reset successful - redirect to home page to show setup wizard
      window.location.href = '/';
    } catch (error) {
      console.error('Factory reset failed:', error);
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to perform factory reset' 
      });
      setResetLoading(false);
      setShowResetConfirm(false);
      setResetConfirmText('');
    }
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

  const loadJoystickSettings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/settings/joysticks`);
      if (!response.ok) {
        throw new Error('Failed to load joystick settings');
      }
      const data = await response.json();
      setJoysticks(data.available || []);
      setJoystickSettings(data.settings || {});
    } catch (error) {
      console.error('Failed to load joystick settings:', error);
    }
  };

  const saveJoystickSettings = async (platform: string, deviceId: string) => {
    try {
      setSaving(true);
      setMessage(null);

      const device = joysticks.find(j => j.id === deviceId);
      const deviceName = device?.name || 'Unknown Device';

      const response = await fetch(`${API_BASE_URL}/api/settings/joysticks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform,
          deviceId,
          deviceName
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save joystick settings');
      }

      setMessage({ type: 'success', text: `Joystick settings for ${platform} saved successfully!` });
      await loadJoystickSettings();
    } catch (error) {
      console.error('Failed to save joystick settings:', error);
      setMessage({ type: 'error', text: 'Failed to save joystick settings' });
    } finally {
      setSaving(false);
    }
  };

  const loadPlatformConfig = async (platformId: string) => {
    try {
      setConfigLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/settings/platforms/${platformId}/config`);
      if (response.status === 404) {
        setPlatformConfigContent(''); // No config yet
        return;
      }
      if (!response.ok) {
        throw new Error('Failed to load platform config');
      }
      const data = await response.json();
      setPlatformConfigContent(data.content || '');
    } catch (error) {
      console.error('Failed to load platform config:', error);
    } finally {
      setConfigLoading(false);
    }
  };

  const savePlatformConfig = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const response = await fetch(`${API_BASE_URL}/api/settings/platforms/${selectedConfigPlatform}/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: platformConfigContent
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save platform config');
      }

      setMessage({ type: 'success', text: 'Platform configuration saved successfully!' });
    } catch (error) {
      console.error('Failed to save platform config:', error);
      setMessage({ type: 'error', text: 'Failed to save platform config' });
    } finally {
      setSaving(false);
    }
  };

  const launchRetroArchGui = async () => {
    try {
      setMessage(null);
      const response = await fetch(`${API_BASE_URL}/api/settings/platforms/retroarch/launch-gui`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to launch RetroArch GUI');
      }
      
      const data = await response.json();
      setMessage({ type: 'success', text: `RetroArch GUI launched! Container ID: ${data.containerId.substring(0, 12)}` });
    } catch (error) {
      console.error('Failed to launch RetroArch GUI:', error);
      setMessage({ type: 'error', text: 'Failed to launch RetroArch GUI' });
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
                (settings?.settings as any)?.igdb?.configured
                  ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
              }`}
            >
              {(settings?.settings as any)?.igdb?.configured
                ? 'Configured'
                : 'Not Configured'}
            </span>
          </div>

          <p className="text-gray-600 dark:text-gray-400 mb-4">
            IGDB provides comprehensive game metadata including screenshots, descriptions, release
            dates, and more. You will need to register for a free API key at{' '}
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
                <div className="space-y-3">
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      <strong>No audio outputs detected.</strong> This can happen when:
                    </p>
                    <ul className="text-sm text-yellow-700 dark:text-yellow-300 list-disc ml-5 mt-1">
                      <li>PulseAudio/PipeWire is not running on the host</li>
                      <li>The PulseAudio socket is not mounted into the container</li>
                      <li>Running in a dev container without host audio access</li>
                    </ul>
                  </div>
                  <div>
                    <label htmlFor="manualAudioSink" className="block text-sm font-medium mb-1">
                      Manual Sink Name (optional)
                    </label>
                    <input
                      type="text"
                      id="manualAudioSink"
                      value={selectedAudioSink}
                      onChange={(e) => setSelectedAudioSink(e.target.value)}
                      placeholder="e.g., alsa_output.pci-0000_00_1f.3.analog-stereo"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Run <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">pactl list sinks short</code> on your host to find sink names.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {(availableAudioSinks.length > 0 || selectedAudioSink) && (
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

        {/* Configure Platforms */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4">Configure Platforms</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Manage platform-specific settings, including joystick mapping and configuration files.
          </p>

          <div className="space-y-6">
            {/* Platform Selector */}
            <div className="flex space-x-2 border-b border-gray-200 dark:border-gray-700 pb-4">
              {['arcade', 'console', 'computer'].map((platform) => (
                <button
                  key={platform}
                  onClick={() => {
                    setSelectedJoystickPlatform(platform);
                    if (platform === 'arcade') {
                        setSelectedConfigPlatform('arcade');
                        loadPlatformConfig('arcade');
                    }
                  }}
                  className={`px-4 py-2 rounded-lg capitalize ${
                    selectedJoystickPlatform === platform
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {platform}
                </button>
              ))}
            </div>

            {/* Joystick Section */}
            <div>
              <h3 className="text-lg font-medium mb-3">Joystick Mapping</h3>
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2">
                    Select Joystick
                  </label>
                  {joysticks.length > 0 ? (
                    <select
                      value={joystickSettings[selectedJoystickPlatform]?.deviceId || ''}
                      onChange={(e) => saveJoystickSettings(selectedJoystickPlatform, e.target.value)}
                      disabled={saving}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select a joystick...</option>
                      {joysticks.map((joystick) => (
                        <option key={joystick.id} value={joystick.id}>
                          {joystick.name} ({joystick.id})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No joysticks detected. Connect a controller and refresh the page.
                    </p>
                  )}
                </div>
                
                {joystickSettings[selectedJoystickPlatform] && (
                  <div className="text-sm text-green-600 dark:text-green-400">
                    ✓ Configured: {joystickSettings[selectedJoystickPlatform].deviceName}
                  </div>
                )}
              </div>
            </div>

            {/* Config Section (only for supported platforms) */}
            {selectedJoystickPlatform === 'arcade' && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <h3 className="text-lg font-medium mb-3">Platform Configuration (RetroArch)</h3>
                    
                    {/* Launch GUI Button */}
                    <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-900">
                        <h4 className="font-medium text-purple-900 dark:text-purple-100 mb-2">Interactive Configuration</h4>
                        <p className="text-sm text-purple-800 dark:text-purple-200 mb-4">
                            Launch the full RetroArch interface to configure input, video, and other settings interactively. 
                            Changes saved in the GUI will be persisted to the master configuration.
                        </p>
                        <button 
                            onClick={launchRetroArchGui}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                            Launch RetroArch GUI
                        </button>
                    </div>

                    {/* Config Editor */}
                    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <h4 className="font-medium mb-3">Master Configuration File (retroarch.cfg)</h4>
                      
                      {configLoading ? (
                        <div className="text-center py-4">Loading configuration...</div>
                      ) : (
                        <div className="space-y-4">
                          <textarea
                            value={platformConfigContent}
                            onChange={(e) => setPlatformConfigContent(e.target.value)}
                            className="w-full h-96 px-4 py-2 font-mono text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Configuration content..."
                          />
                          
                          <button
                            onClick={savePlatformConfig}
                            disabled={saving}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                          >
                            {saving ? 'Saving...' : 'Save Master Configuration'}
                          </button>
                        </div>
                      )}
                    </div>
                </div>
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

        {/* GPU Settings */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4">GPU Settings</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Select which GPU vendor stack to prefer inside game containers. Use <span className="font-medium">Auto</span> unless you have a specific multi-GPU setup.
          </p>

          <div className="space-y-4">
            <div>
              <label htmlFor="gpuVendor" className="block text-sm font-medium mb-2">
                Preferred GPU Vendor
              </label>
              <select
                id="gpuVendor"
                value={gpuVendor}
                onChange={(e) => setGpuVendor(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="auto">Auto</option>
                <option value="amd">AMD</option>
                <option value="nvidia">NVIDIA</option>
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                AMD sets Vulkan ICD selection to RADV. NVIDIA support will require the NVIDIA container runtime and device nodes.
              </p>
            </div>

            <button
              onClick={saveGpuSettings}
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save GPU Settings'}
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

        {/* Danger Zone */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border-2 border-red-500">
          <h2 className="text-2xl font-semibold mb-4 text-red-600 dark:text-red-400">⚠️ Danger Zone</h2>
          
          <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <h3 className="font-semibold text-red-700 dark:text-red-300 mb-2">Factory Reset</h3>
              <p className="text-sm text-red-600 dark:text-red-400 mb-3">
                This will permanently delete <strong>ALL</strong> your data including:
              </p>
              <ul className="text-sm text-red-600 dark:text-red-400 list-disc list-inside mb-4 space-y-1">
                <li>All games and their metadata</li>
                <li>All save files and states</li>
                <li>All platform configurations</li>
                <li>All settings and preferences</li>
                <li>All downloaded content and BIOS files</li>
              </ul>
              <p className="text-sm text-red-700 dark:text-red-300 font-semibold">
                This action cannot be undone!
              </p>
            </div>

            {!showResetConfirm ? (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Delete Everything and Reset
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Type <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded font-mono">DELETE EVERYTHING</code> to confirm:
                </p>
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder="Type DELETE EVERYTHING"
                  className="w-full px-4 py-2 border border-red-300 dark:border-red-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  disabled={resetLoading}
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowResetConfirm(false);
                      setResetConfirmText('');
                    }}
                    disabled={resetLoading}
                    className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={performFactoryReset}
                    disabled={resetConfirmText !== 'DELETE EVERYTHING' || resetLoading}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {resetLoading ? 'Resetting...' : 'Confirm Reset'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
