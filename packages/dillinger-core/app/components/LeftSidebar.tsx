'use client';

import { useState, useEffect } from 'react';
import { InformationCircleIcon, ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline';
import VolumeSettingsModal from './VolumeSettingsModal';

interface DetectedVolume {
  mountPath: string;
  device: string;
  fsType: string;
  isSystem: boolean;
  friendlyName?: string;
  storageType?: 'ssd' | 'platter' | 'archive';
  isDefaultFor: string[];
}

export default function LeftSidebar() {
  const [volumes, setVolumes] = useState<DetectedVolume[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddVolumeDialog, setShowAddVolumeDialog] = useState(false);
  const [editingVolume, setEditingVolume] = useState<DetectedVolume | null>(null);
  
  // Add volume dialog state
  const [newVolumeName, setNewVolumeName] = useState('');
  const [newVolumeHostPath, setNewVolumeHostPath] = useState('');
  const [copied, setCopied] = useState(false);

  // Load volumes on mount
  useEffect(() => {
    loadVolumes();
  }, []);

  async function loadVolumes() {
    try {
      setLoading(true);
      const response = await fetch('/api/volumes/detected');
      const data = await response.json();
      if (data.success) {
        setVolumes(data.data.volumes || []);
      }
    } catch (error) {
      console.error('Failed to load volumes:', error);
    } finally {
      setLoading(false);
    }
  }

  // Get display name for a volume
  function getDisplayName(volume: DetectedVolume): string {
    if (volume.friendlyName) return volume.friendlyName;
    if (volume.mountPath === '/data') return 'dillinger_root';
    // Use last path segment as name
    const segments = volume.mountPath.split('/').filter(Boolean);
    return segments[segments.length - 1] || volume.mountPath;
  }

  // Get badges for a volume
  function getVolumeBadges(volume: DetectedVolume): { defaults: string[]; storageType?: string } {
    const defaultBadges: string[] = [];
    if (volume.isDefaultFor.includes('installers')) defaultBadges.push('📦');
    if (volume.isDefaultFor.includes('downloads')) defaultBadges.push('⬇️');
    if (volume.isDefaultFor.includes('installed')) defaultBadges.push('🎮');
    if (volume.isDefaultFor.includes('roms')) defaultBadges.push('💾');
    
    return { defaults: defaultBadges, storageType: volume.storageType };
  }

  // Generate the docker -v line
  function getDockerVolumeLine(): string {
    if (!newVolumeHostPath) return '';
    // Mirror the host path inside the container
    return `-v ${newVolumeHostPath}:${newVolumeHostPath} \\`;
  }

  // Copy to clipboard
  async function handleCopy() {
    const line = getDockerVolumeLine();
    if (line) {
      await navigator.clipboard.writeText(line);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  // Reset add dialog
  function resetAddDialog() {
    setNewVolumeName('');
    setNewVolumeHostPath('');
    setCopied(false);
    setShowAddVolumeDialog(false);
  }

  return (
    <div className="h-full flex flex-col card border-2 border-primary/30 shadow-lg bg-surface/75 backdrop-blur-sm">
      <div className="card-body flex flex-col h-full overflow-hidden">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
        </div>

        <div className="space-y-3 flex-1 overflow-y-auto">
          {/* Storage Volumes Section */}
          <div>
            <div className="p-4 rounded-lg bg-surface/50 border border-border space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                  </svg>
                  Storage Volumes
                </h3>
              </div>

              {loading ? (
                <p className="text-xs text-muted italic">Detecting mounted volumes...</p>
              ) : (
                <div className="space-y-4">
                  {/* Detected Volumes */}
                  <div className="space-y-2">
                    {volumes.length === 0 ? (
                      <div className="text-center py-6">
                        <svg className="w-10 h-10 mx-auto text-muted/50 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        <p className="text-sm text-muted">No volumes detected</p>
                        <p className="text-xs text-muted/70 mt-1">Mount volumes to the container to see them here</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-56 overflow-y-auto">
                        {volumes.map((volume) => {
                          const badges = getVolumeBadges(volume);
                          return (
                            <div
                              key={volume.mountPath}
                              className="p-3 rounded bg-background border border-border/50 hover:border-border transition-colors"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {volume.isSystem && (
                                      <div className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/20 text-blue-400">
                                        ⚙️ SYSTEM
                                      </div>
                                    )}
                                    {badges.storageType && (
                                      <div className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                        badges.storageType === 'ssd' ? 'bg-yellow-500/20 text-yellow-400' :
                                        badges.storageType === 'platter' ? 'bg-purple-500/20 text-purple-400' :
                                        'bg-gray-500/20 text-gray-400'
                                      }`}>
                                        {badges.storageType === 'ssd' ? '⚡ SSD' :
                                         badges.storageType === 'platter' ? '💿 HDD' :
                                         '📚 Archive'}
                                      </div>
                                    )}
                                    <div className="font-semibold text-text text-sm truncate">
                                      {getDisplayName(volume)}
                                    </div>
                                    {badges.defaults.length > 0 && (
                                      <div className="flex gap-0.5" title="Default for: installers, downloads, installed, roms">
                                        {badges.defaults.map((emoji, i) => (
                                          <span key={i} className="text-xs">{emoji}</span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-muted text-xs mt-1 font-mono truncate" title={volume.mountPath}>
                                    {volume.mountPath}
                                  </div>
                                </div>
                                <div className="flex flex-col gap-1 flex-shrink-0">
                                  <button
                                    onClick={() => setEditingVolume(volume)}
                                    className="p-1.5 text-muted hover:text-primary hover:bg-primary/10 rounded transition-colors"
                                    title="Edit volume settings"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Add Volume Button */}
                  <div className="pt-2 border-t border-border">
                    <button
                      onClick={() => setShowAddVolumeDialog(true)}
                      className="w-full text-xs px-3 py-2 rounded bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Storage Volume
                    </button>
                    <p className="text-[10px] text-muted/70 mt-2 text-center">
                      Volumes must be mounted to the container at startup
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Filters Section */}
          <div className="pt-2">
            <div className="p-4 rounded-lg bg-surface/50 border border-border">
              <h3 className="text-sm font-semibold text-text mb-2">Filters</h3>
              <p className="text-xs text-muted italic">This space for rent</p>
            </div>
          </div>

          {/* Collections Section */}
          <div className="p-4 rounded-lg bg-surface/50 border border-border">
            <h3 className="text-sm font-semibold text-text mb-2">Collections</h3>
            <p className="text-xs text-muted italic">This space for rent</p>
          </div>
        </div>
      </div>

      {/* Add Volume Dialog (Instructional) */}
      {showAddVolumeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface border border-border rounded-lg shadow-xl p-6 w-[520px] max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-text mb-4">Add Storage Volume</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text mb-2">
                  Volume Name
                </label>
                <input
                  type="text"
                  value={newVolumeName}
                  onChange={(e) => setNewVolumeName(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., games_nas, fast_ssd"
                  autoFocus
                />
                <p className="text-xs text-muted/70 mt-1">A friendly name for this volume (optional)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-2">
                  Host Path
                </label>
                <input
                  type="text"
                  value={newVolumeHostPath}
                  onChange={(e) => setNewVolumeHostPath(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="/mnt/games or /home/user/games"
                />
                <p className="text-xs text-muted/70 mt-1">
                  The absolute path on your host system
                </p>
              </div>

              {newVolumeHostPath && (
                <div className="p-4 bg-gray-900 border border-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-sm text-gray-300">
                      <InformationCircleIcon className="w-4 h-4" />
                      <span>Add this line to <code className="text-primary">start-dillinger.sh</code>:</span>
                    </div>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
                    >
                      {copied ? (
                        <>
                          <CheckIcon className="w-3 h-3 text-green-400" />
                          <span className="text-green-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <ClipboardDocumentIcon className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  
                  <pre className="text-sm font-mono text-green-400 bg-black/30 p-3 rounded overflow-x-auto">
                    {getDockerVolumeLine()}
                  </pre>
                  
                  <div className="mt-4 space-y-2 text-xs text-gray-400">
                    <p>Add this line after the other <code>-v</code> lines in the script, then:</p>
                    <ol className="list-decimal list-inside space-y-1 ml-2">
                      <li>Stop the current container: <code className="text-gray-300">docker stop dillinger</code></li>
                      <li>Remove the container: <code className="text-gray-300">docker rm dillinger</code></li>
                      <li>Run the script again: <code className="text-gray-300">./start-dillinger.sh</code></li>
                    </ol>
                  </div>
                </div>
              )}

              <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <InformationCircleIcon className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-text">
                    <p className="font-medium mb-1">Why do I need to restart?</p>
                    <p className="text-muted/80">
                      Docker containers can only access directories that are mounted at startup. 
                      To add a new volume, you need to recreate the container with the new mount.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={resetAddDialog}
                className="flex-1 px-4 py-2 rounded-lg border border-border text-text hover:bg-background transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Volume Settings Modal */}
      {editingVolume && (
        <VolumeSettingsModal
          isOpen={true}
          onClose={() => setEditingVolume(null)}
          volume={{
            mountPath: editingVolume.mountPath,
            friendlyName: editingVolume.friendlyName,
            storageType: editingVolume.storageType,
            isDefaultFor: editingVolume.isDefaultFor,
          }}
          onSave={() => {
            loadVolumes();
            setEditingVolume(null);
          }}
        />
      )}
    </div>
  );
}
