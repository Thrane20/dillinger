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

  useEffect(() => {
    loadSettings();
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
    } catch (error) {
      console.error('Failed to load settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
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
      </div>
    </div>
  );
}
