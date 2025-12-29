'use client';

import { useState, useEffect } from 'react';

interface Volume {
  id: string;
  name: string;
  dockerVolumeName: string;
  hostPath: string;
}

interface VolumeDefaults {
  defaults: {
    installers: string | null;
    downloads: string | null;
    installed: string | null;
    roms: string | null;
  };
  volumeMetadata: Record<string, {
    storageType?: 'ssd' | 'platter' | 'archive';
  }>;
}

interface VolumeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  volume: Volume;
  onSave: () => void;
}

type DefaultType = 'installers' | 'downloads' | 'installed' | 'roms';
type StorageType = 'ssd' | 'platter' | 'archive' | '';

const DEFAULT_LABELS: Record<DefaultType, { label: string; icon: string; description: string }> = {
  installers: {
    label: 'Installers',
    icon: '📦',
    description: 'Store downloaded game installers (.exe, .msi, etc.)',
  },
  downloads: {
    label: 'Downloads',
    icon: '⬇️',
    description: 'Temporary storage for in-progress downloads',
  },
  installed: {
    label: 'Installed Games',
    icon: '🎮',
    description: 'Where games are installed and run from',
  },
  roms: {
    label: 'ROMs',
    icon: '💾',
    description: 'ROM files for emulated platforms',
  },
};

const STORAGE_TYPES: { value: StorageType; label: string; icon: string; description: string }[] = [
  { value: '', label: 'Not Set', icon: '❓', description: 'No storage type specified' },
  { value: 'ssd', label: 'SSD', icon: '⚡', description: 'Fast solid-state storage for active games' },
  { value: 'platter', label: 'Platter', icon: '💿', description: 'Traditional hard drive for general storage' },
  { value: 'archive', label: 'Archive', icon: '📚', description: 'Cold storage for games you rarely play' },
];

export default function VolumeSettingsModal({ isOpen, onClose, volume, onSave }: VolumeSettingsModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [defaults, setDefaults] = useState<VolumeDefaults | null>(null);
  const [selectedDefaults, setSelectedDefaults] = useState<Set<DefaultType>>(new Set());
  const [storageType, setStorageType] = useState<StorageType>('');
  const [error, setError] = useState<string | null>(null);

  // Load current defaults on mount
  useEffect(() => {
    if (isOpen) {
      loadDefaults();
    }
  }, [isOpen, volume.id]);

  async function loadDefaults() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/volumes/defaults');
      const data = await response.json();
      if (data.success) {
        setDefaults(data.data);
        
        // Set which defaults this volume is assigned to
        const assigned = new Set<DefaultType>();
        const defs = data.data.defaults;
        if (defs.installers === volume.id) assigned.add('installers');
        if (defs.downloads === volume.id) assigned.add('downloads');
        if (defs.installed === volume.id) assigned.add('installed');
        if (defs.roms === volume.id) assigned.add('roms');
        setSelectedDefaults(assigned);
        
        // Set storage type
        const meta = data.data.volumeMetadata[volume.id];
        setStorageType(meta?.storageType || '');
      } else {
        setError(data.error || 'Failed to load settings');
      }
    } catch (err) {
      setError('Failed to load volume settings');
      console.error('Failed to load volume defaults:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      // Save each default assignment
      for (const defaultType of ['installers', 'downloads', 'installed', 'roms'] as DefaultType[]) {
        const isSelected = selectedDefaults.has(defaultType);
        const wasSelected = defaults?.defaults[defaultType] === volume.id;
        
        if (isSelected !== wasSelected) {
          await fetch('/api/volumes/defaults', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              volumeId: isSelected ? volume.id : null,
              defaultType,
            }),
          });
        }
      }

      // Save storage type
      await fetch('/api/volumes/defaults', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          volumeId: volume.id,
          storageType: storageType || null,
        }),
      });

      onSave();
      onClose();
    } catch (err) {
      setError('Failed to save settings');
      console.error('Failed to save volume settings:', err);
    } finally {
      setSaving(false);
    }
  }

  function toggleDefault(type: DefaultType) {
    setSelectedDefaults(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }

  function getOtherVolumeForDefault(type: DefaultType): string | null {
    if (!defaults) return null;
    const currentId = defaults.defaults[type];
    if (currentId && currentId !== volume.id) {
      return currentId;
    }
    return null;
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
              <p className="text-sm text-muted mt-0.5 font-mono">{volume.name}</p>
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
          {loading ? (
            <div className="text-center py-8 text-muted">Loading settings...</div>
          ) : error ? (
            <div className="p-4 bg-error/10 border border-error/30 rounded-lg text-error text-sm">
              {error}
            </div>
          ) : (
            <>
              {/* Default Assignments */}
              <div>
                <h3 className="text-sm font-semibold text-text mb-3">Default Assignments</h3>
                <p className="text-xs text-muted mb-4">
                  Set this volume as the default location for different content types.
                  These will be used when downloading, installing, or browsing for files.
                </p>
                <div className="space-y-2">
                  {(Object.keys(DEFAULT_LABELS) as DefaultType[]).map(type => {
                    const { label, icon, description } = DEFAULT_LABELS[type];
                    const isSelected = selectedDefaults.has(type);
                    const otherVolumeId = getOtherVolumeForDefault(type);
                    
                    return (
                      <button
                        key={type}
                        onClick={() => toggleDefault(type)}
                        className={`w-full p-3 rounded-lg border text-left transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50 hover:bg-background'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-xl">{icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-text">{label}</span>
                              {isSelected && (
                                <span className="px-2 py-0.5 text-[10px] font-semibold bg-primary text-white rounded">
                                  DEFAULT
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted mt-0.5">{description}</p>
                            {otherVolumeId && !isSelected && (
                              <p className="text-xs text-warning mt-1">
                                Currently set to another volume
                              </p>
                            )}
                            {!otherVolumeId && !isSelected && defaults?.defaults[type] === null && (
                              <p className="text-xs text-muted/70 mt-1 italic">
                                Not yet set
                              </p>
                            )}
                          </div>
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            isSelected ? 'border-primary bg-primary' : 'border-muted'
                          }`}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
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
            </>
          )}
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
            disabled={loading || saving}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
