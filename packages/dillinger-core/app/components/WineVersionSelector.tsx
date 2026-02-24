'use client';

import { useState, useEffect } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface InstalledWineVersion {
  id: string;
  type: 'system' | 'wine-staging' | 'ge-proton';
  version: string;
  displayName: string;
  path: string;
  installedAt: string;
  usesUmu: boolean;
  releaseNotes?: string;
}

interface WineVersionSelectorProps {
  value: string; // 'default' or version ID
  onChange: (versionId: string) => void;
}

export default function WineVersionSelector({
  value,
  onChange,
}: WineVersionSelectorProps) {
  const [installedVersions, setInstalledVersions] = useState<InstalledWineVersion[]>([]);
  const [defaultVersionId, setDefaultVersionId] = useState<string>('system');
  const [loading, setLoading] = useState(true);

  // Fetch installed Wine versions
  useEffect(() => {
    const fetchVersions = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/wine-versions`);
        if (response.ok) {
          const data = await response.json();
          setInstalledVersions(data.installed || []);
          setDefaultVersionId(data.defaultId || 'system');
        }
      } catch (error) {
        console.error('Failed to load Wine versions:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchVersions();
  }, []);

  // Check if selected version uses UMU
  const selectedVersion = value === 'default' 
    ? installedVersions.find(v => v.id === defaultVersionId)
    : installedVersions.find(v => v.id === value);
  
  const usesUmu = selectedVersion?.usesUmu || false;

  const getVersionTypeBadge = (type: string) => {
    switch (type) {
      case 'system':
        return <span className="px-1.5 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">System</span>;
      case 'ge-proton':
        return <span className="px-1.5 py-0.5 text-xs rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">GE-Proton</span>;
      case 'wine-staging':
        return <span className="px-1.5 py-0.5 text-xs rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">Wine Staging</span>;
      default:
        return null;
    }
  };

  const handleVersionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVersionId = e.target.value;
    onChange(newVersionId);
  };

  if (loading) {
    return (
      <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="text-sm text-gray-500">Loading Wine versions...</div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-text">Wine Version</div>
          <div className="text-xs text-gray-500">
            Choose which Wine/Proton version to use for this game
          </div>
        </div>
        {usesUmu && (
          <span className="px-2 py-1 text-xs rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            UMU Launcher
          </span>
        )}
      </div>

      {/* Version Selector */}
      <div>
        <select
          value={value}
          onChange={handleVersionChange}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-text"
        >
          <option value="default">
            Use Default ({installedVersions.find(v => v.id === defaultVersionId)?.displayName || 'System Wine'})
          </option>
          <optgroup label="Installed Versions">
            {installedVersions.map(version => (
              <option key={version.id} value={version.id}>
                {version.displayName}
                {version.usesUmu ? ' (UMU)' : ''}
              </option>
            ))}
          </optgroup>
        </select>
        
        {/* Show selected version details */}
        {selectedVersion && value !== 'default' && (
          <div className="mt-2 text-xs text-gray-500 flex items-center gap-2">
            {getVersionTypeBadge(selectedVersion.type)}
            <span>Path: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{selectedVersion.path}</code></span>
          </div>
        )}
      </div>

      {/* Link to manage versions */}
      <div className="text-xs text-right">
        <a href="/platforms" className="text-blue-600 hover:underline">
          Manage Wine versions →
        </a>
      </div>
    </div>
  );
}
