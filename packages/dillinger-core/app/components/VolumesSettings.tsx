'use client';

import { useEffect, useState } from 'react';
import VolumeSettingsModal from './VolumeSettingsModal';

type StorageType = 'ssd' | 'platter' | 'archive';

interface DetectedVolume {
  mountPath: string;
  device: string;
  fsType: string;
  isSystem: boolean;
  friendlyName?: string;
  storageType?: StorageType;
  dockerVolumeName?: string;
  firstClassCategory: 'core' | 'roms' | 'cache' | 'installed' | null;
}

interface FirstClassStatus {
  core: { present: boolean; mountPath: string; dockerVolumeName: string };
  roms: { present: boolean; mountPath: string; dockerVolumeName: string };
  cache: { present: boolean; mountPath: string; dockerVolumeName: string };
  installed: {
    present: boolean;
    expectedPrefix: string;
    mounts: Array<{ dockerVolumeName: string; suffix: string; mountPath: string }>;
  };
}

export default function VolumesSettings() {
  const [volumes, setVolumes] = useState<DetectedVolume[]>([]);
  const [status, setStatus] = useState<FirstClassStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingVolume, setEditingVolume] = useState<DetectedVolume | null>(null);

  async function loadVolumes() {
    try {
      setLoading(true);
      const response = await fetch('/api/volumes/detected');
      const data = await response.json();
      if (data.success) {
        setVolumes(
          (data.data.volumes || []).filter(
            (v: DetectedVolume) => v.firstClassCategory !== null || !!v.dockerVolumeName?.startsWith('dillinger_')
          )
        );
        setStatus(data.data.firstClassStatus || null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVolumes();
  }, []);

  const firstClassRows = [
    status ? { label: 'Core Data', icon: '🧠', ...status.core } : null,
    status ? { label: 'ROMs', icon: '💾', ...status.roms } : null,
    status ? { label: 'Cache', icon: '📦', ...status.cache } : null,
  ].filter(Boolean) as Array<{ label: string; icon: string; present: boolean; mountPath: string; dockerVolumeName: string }>;

  const mountedVolumeByPath = new Map(volumes.map((volume) => [volume.mountPath, volume]));

  function getStorageTypeIcon(storageType?: StorageType): string {
    if (storageType === 'ssd') return '⚡';
    if (storageType === 'platter') return '💿';
    if (storageType === 'archive') return '📚';
    return '';
  }

  return (
    <div className="space-y-4">
      <div className="border border-gray-200 dark:border-gray-700 p-4 rounded-lg bg-surface/30">
        <h3 className="text-lg font-semibold mb-3">First-Class Volume Status</h3>
        {loading ? (
          <p className="text-sm text-muted">Detecting mounted volumes…</p>
        ) : (
          <div className="space-y-2">
            {firstClassRows.map((row) => (
              <div key={row.dockerVolumeName} className="flex items-center justify-between rounded border border-border px-3 py-2">
                <div className="text-sm">
                  <span className="mr-2">{row.icon}</span>
                  <span className="font-medium">{row.label}</span>
                  {(() => {
                    const matched = mountedVolumeByPath.get(row.mountPath);
                    const speedIcon = getStorageTypeIcon(matched?.storageType);
                    if (!speedIcon) return null;
                    return <span className="ml-2" title="Tagged storage speed">{speedIcon}</span>;
                  })()}
                  <span className="ml-2 text-xs text-muted font-mono">{row.dockerVolumeName}</span>
                </div>
                <div className="text-xs flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${row.present ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  <span>{row.mountPath}</span>
                  {row.present && mountedVolumeByPath.get(row.mountPath) && (
                    <button
                      type="button"
                      onClick={() => setEditingVolume(mountedVolumeByPath.get(row.mountPath) || null)}
                      className="ml-2 px-2 py-1 rounded border border-border hover:bg-background"
                    >
                      Tag speed
                    </button>
                  )}
                </div>
              </div>
            ))}

            <div className="rounded border border-border px-3 py-2">
              <div className="text-sm font-medium">🎮 Installed Volumes <span className="text-xs text-muted font-mono">dillinger_installed_*</span></div>
              {status?.installed.mounts.length ? (
                <div className="mt-2 space-y-1">
                  {status.installed.mounts.map((mount) => (
                    <div key={mount.dockerVolumeName} className="flex items-center justify-between gap-2">
                      <div className="text-xs text-muted font-mono">
                        {getStorageTypeIcon(mountedVolumeByPath.get(mount.mountPath)?.storageType) && (
                          <span className="mr-1" title="Tagged storage speed">
                            {getStorageTypeIcon(mountedVolumeByPath.get(mount.mountPath)?.storageType)}
                          </span>
                        )}
                        {mount.dockerVolumeName} → {mount.mountPath}
                      </div>
                      {mountedVolumeByPath.get(mount.mountPath) && (
                        <button
                          type="button"
                          onClick={() => setEditingVolume(mountedVolumeByPath.get(mount.mountPath) || null)}
                          className="px-2 py-1 text-xs rounded border border-border hover:bg-background"
                        >
                          Tag speed
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted">No `dillinger_installed_*` volumes detected</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="text-xs text-muted">
        Missing volumes can be added by mounting them in your runtime command (see `start-dillinger.sh`).
      </div>

      {editingVolume && (
        <VolumeSettingsModal
          isOpen={true}
          onClose={() => setEditingVolume(null)}
          volume={{
            mountPath: editingVolume.mountPath,
            friendlyName: editingVolume.friendlyName,
            storageType: editingVolume.storageType,
            isDefaultFor: [],
          }}
          onSave={() => {
            setEditingVolume(null);
            loadVolumes();
          }}
        />
      )}
    </div>
  );
}
