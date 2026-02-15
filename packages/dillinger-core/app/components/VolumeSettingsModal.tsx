'use client';

import { useState, useEffect } from 'react';

interface VolumeSettings {
  mountPath: string;
  friendlyName?: string;
  storageType?: 'ssd' | 'platter' | 'archive';
  isDefaultFor: string[];
}

interface VolumeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  volume: VolumeSettings;
  onSave: () => void;
}

type StorageType = 'ssd' | 'platter' | 'archive' | '';

const STORAGE_TYPES: { value: StorageType; label: string; icon: string; description: string }[] = [
  { value: '', label: 'Not Set', icon: '❓', description: 'No storage type specified' },
  { value: 'ssd', label: 'SSD', icon: '⚡', description: 'Fast solid-state storage for active games' },
  { value: 'platter', label: 'HDD', icon: '💿', description: 'Traditional hard drive for general storage' },
  { value: 'archive', label: 'Archive', icon: '📚', description: 'Cold storage for games you rarely play' },
];

export default function VolumeSettingsModal({ isOpen, onClose, volume, onSave }: VolumeSettingsModalProps) {
  const [saving, setSaving] = useState(false);
  const [friendlyName, setFriendlyName] = useState(volume.friendlyName || '');
  const [storageType, setStorageType] = useState<StorageType>(volume.storageType || '');
  const [error, setError] = useState<string | null>(null);

  // Reset state when volume changes
  useEffect(() => {
    if (isOpen) {
      setFriendlyName(volume.friendlyName || '');
      setStorageType(volume.storageType || '');
      setError(null);
    }
  }, [isOpen, volume]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      // Build the update payload
      const payload: {
        mountPath: string;
        friendlyName?: string;
        storageType?: string;
      } = {
        mountPath: volume.mountPath,
      };

      // Only include friendlyName if changed
      if (friendlyName !== (volume.friendlyName || '')) {
        payload.friendlyName = friendlyName || undefined;
      }

      // Only include storageType if changed
      if (storageType !== (volume.storageType || '')) {
        payload.storageType = storageType || undefined;
      }

      const response = await fetch('/api/volumes/metadata', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to save settings');
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
      console.error('Failed to save volume settings:', err);
    } finally {
      setSaving(false);
    }
  }

  // Get display name for the volume
  function getDisplayName(): string {
    if (volume.friendlyName) return volume.friendlyName;
    if (volume.mountPath === '/data') return 'dillinger_core';
    const segments = volume.mountPath.split('/').filter(Boolean);
    return segments[segments.length - 1] || volume.mountPath;
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface border border-border rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-text">Volume Settings</h2>
              <p className="text-sm text-muted mt-0.5 font-mono">{volume.mountPath}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-background rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {error && (
            <div className="p-4 bg-error/10 border border-error/30 rounded-lg text-error text-sm">
              {error}
            </div>
          )}

          {/* Friendly Name */}
          <div>
            <h3 className="text-sm font-semibold text-text mb-3">Display Name</h3>
            <input
              type="text"
              value={friendlyName}
              onChange={(e) => setFriendlyName(e.target.value)}
              placeholder={getDisplayName()}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted mt-2">
              A friendly name to identify this volume. Leave blank to use the path.
            </p>
          </div>

          {/* Storage Type */}
          <div>
            <h3 className="text-sm font-semibold text-text mb-3">Storage Type</h3>
            <p className="text-xs text-muted mb-4">
              Classify this volume&apos;s physical storage type. This helps with future features
              like archiving games or promoting them to faster storage.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {STORAGE_TYPES.map(({ value, label, icon, description }) => (
                <button
                  key={value || 'none'}
                  onClick={() => setStorageType(value)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    storageType === value
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50 hover:bg-background'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span>{icon}</span>
                    <span className="font-medium text-text text-sm">{label}</span>
                  </div>
                  <p className="text-[10px] text-muted">{description}</p>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-background transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
