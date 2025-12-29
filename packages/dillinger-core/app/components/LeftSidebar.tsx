'use client';

import { useState, useEffect } from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import FileExplorer from './FileExplorer';
import VolumeSettingsModal from './VolumeSettingsModal';

interface Volume {
  id: string;
  name: string;
  dockerVolumeName: string;
  hostPath: string;
  createdAt: string;
  type: 'docker' | 'bind';
  status: 'active' | 'error';
  purpose?: string; // Deprecated
}

interface DockerVolume {
  name: string;
  driver: string;
  mountpoint: string;
  createdAt?: string;
  size?: string;
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

// NOTE: SessionVolumeInfo interface commented out - no longer needed with dillinger_root architecture
/*
interface SessionVolumeInfo {
  total: number;
  active: number;
  inactive: number;
}
*/

export default function LeftSidebar() {
  const [showFileExplorer, setShowFileExplorer] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showLinkVolumeDialog, setShowLinkVolumeDialog] = useState(false);
  const [selectedDockerVolume, setSelectedDockerVolume] = useState<string>('');
  const [availableDockerVolumes, setAvailableDockerVolumes] = useState<string[]>([]);
  const [selectedPath, setSelectedPath] = useState('');
  const [volumeName, setVolumeName] = useState('');
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [unmountedVolumes, setUnmountedVolumes] = useState<DockerVolume[]>([]);
  const [loading, setLoading] = useState(true);
  const [volumeDefaults, setVolumeDefaults] = useState<VolumeDefaults | null>(null);
  const [editingVolume, setEditingVolume] = useState<Volume | null>(null);

  // Load volumes on mount
  useEffect(() => {
    loadVolumes();
  }, []);

  async function loadVolumes() {
    try {
      const response = await fetch('/api/volumes');
      const data = await response.json();
      if (data.success) {
        const configuredVolumes = data.data || [];

        // Fetch Docker volumes and add unlinked ones automatically
        const dockerResponse = await fetch('/api/docker-volumes');
        const dockerData = await dockerResponse.json();

        if (dockerData.success) {
          const hostVolumes = dockerData.data.volumes || [];
          const linkedVolumeNames = configuredVolumes.map((v: Volume) => v.dockerVolumeName);

          // Update available Docker volumes for linking (unlinked volumes only)
          const unlinkedVolumes = hostVolumes
            .filter((dv: DockerVolume) => !linkedVolumeNames.includes(dv.name));
          
          const unlinkedVolumeNames = unlinkedVolumes.map((dv: DockerVolume) => dv.name);
          setAvailableDockerVolumes(unlinkedVolumeNames);

          // Set unmounted volumes (exist on host but not accessible/mounted)
          setUnmountedVolumes(unlinkedVolumes);

          // Only show configured (accessible) volumes in main list
          setVolumes(configuredVolumes);
          console.log(`[LeftSidebar] Loaded ${configuredVolumes.length} accessible volumes + ${unlinkedVolumes.length} unmounted volumes`);
        } else {
          setVolumes(configuredVolumes);
        }
      }
      
      // Load volume defaults
      const defaultsResponse = await fetch('/api/volumes/defaults');
      const defaultsData = await defaultsResponse.json();
      if (defaultsData.success) {
        setVolumeDefaults(defaultsData.data);
      }
    } catch (error) {
      console.error('Failed to load volumes:', error);
    } finally {
      setLoading(false);
    }
  }

  // Get badges for a volume based on its default assignments and storage type
  function getVolumeBadges(volumeId: string): { defaults: string[]; storageType?: string } {
    if (!volumeDefaults) return { defaults: [] };
    
    const defaults: string[] = [];
    if (volumeDefaults.defaults.installers === volumeId) defaults.push('📦');
    if (volumeDefaults.defaults.downloads === volumeId) defaults.push('⬇️');
    if (volumeDefaults.defaults.installed === volumeId) defaults.push('🎮');
    if (volumeDefaults.defaults.roms === volumeId) defaults.push('💾');
    
    const meta = volumeDefaults.volumeMetadata[volumeId];
    const storageType = meta?.storageType;
    
    return { defaults, storageType };
  }

  function handleAddVolume() {
    setShowCreateDialog(true);
  }

  function handleVolumeSelected(path: string) {
    setSelectedPath(path);
    setShowFileExplorer(false);
    // Pre-fill with directory name
    const dirName = path.split('/').filter(Boolean).pop() || 'volume';
    setVolumeName(dirName);
    // Reopen the create dialog
    setShowCreateDialog(true);
  }

  async function handleCreateVolume() {
    if (!volumeName.trim() || !selectedPath) return;

    try {
      const response = await fetch('/api/volumes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: volumeName.trim(),
          hostPath: selectedPath,
          type: 'docker',
        }),
      });

      const data = await response.json();
      if (data.success) {
        await loadVolumes();
        setShowCreateDialog(false);
        setVolumeName('');
        setSelectedPath('');
      } else {
        alert(`Failed to create volume: ${data.error}${data.warning ? '\n' + data.warning : ''}`);
      }
    } catch (error) {
      console.error('Failed to create volume:', error);
      alert('Failed to create volume');
    }
  }

  async function handleLinkExistingVolume() {
    if (!selectedDockerVolume) return;

    try {
      const response = await fetch('/api/volumes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedDockerVolume, // Use the volume name directly
          hostPath: '', // Will be filled by backend
          type: 'docker',
          linkExisting: true,
          dockerVolumeName: selectedDockerVolume,
        }),
      });

      const data = await response.json();
      if (data.success) {
        await loadVolumes();
        setShowLinkVolumeDialog(false);
        setSelectedDockerVolume('');
      } else {
        alert(`Failed to link volume: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to link volume:', error);
      alert('Failed to link volume');
    }
  }

  async function handleRemoveVolume(volumeId: string) {
    if (!confirm('Remove this volume? Docker volume will be deleted.')) return;

    try {
      const response = await fetch(`/api/volumes/${volumeId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.success) {
        await loadVolumes(); // Reload list
      } else {
        alert(`Failed to remove volume: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to remove volume:', error);
      alert('Failed to remove volume');
    }
  }

  // NOTE: This function is commented out as save volumes are no longer used
  // All game saves are stored in dillinger_root at /data/saves/<gameId>
  /*
  async function handleCleanSessionVolumes() {
    // Load session info first
    console.log('Loading session volumes...');
    try {
      const response = await fetch('/api/volumes/session-volumes');
      const data = await response.json();
      console.log('Session volumes response:', data);
      if (data.success) {
        console.log('Setting sessionInfo to:', data.data);
        console.log('Setting showCleanupDialog to true');
        setSessionInfo(data.data);
        setShowCleanupDialog(true);
        console.log('State updated - dialog should show');
      } else {
        console.error('API returned error:', data.error);
        alert(`Failed to load session volumes: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to load session volumes:', error);
      alert('Failed to load session volumes');
    }
  }

  async function confirmCleanup() {
    console.log('Confirming cleanup...');
    setCleanupInProgress(true);
    try {
      const response = await fetch('/api/volumes/cleanup-saves', {
        method: 'DELETE',
      });

      const data = await response.json();
      console.log('Cleanup response:', data);
      if (data.success) {
        alert(data.message || `Cleaned up ${data.data.cleaned} orphaned save volumes`);
        setShowCleanupDialog(false);
        setSessionInfo(null);
      } else {
        alert(`Failed to cleanup: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to cleanup save volumes:', error);
      alert('Failed to cleanup save volumes');
    } finally {
      setCleanupInProgress(false);
    }
  }
  */

  return (
    <div className="h-full flex flex-col card border-2 border-primary/30 shadow-lg bg-surface/75 backdrop-blur-sm">
      <div className="card-body flex flex-col h-full overflow-hidden">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
        </div>

        <div className="space-y-3 flex-1 overflow-y-auto">
          {/* Volume Manager Section */}
          <div>
            <div className="p-4 rounded-lg bg-surface/50 border border-border space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-text flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                  </svg>
                  Volume / Bind Mount Manager
                </h3>
              </div>

              {loading ? (
                <p className="text-xs text-muted italic">Loading...</p>
              ) : (
                <div className="space-y-4">
                  {/* Accessible Volumes Section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-semibold text-text uppercase tracking-wider">
                        Accessible Volumes ({volumes.length})
                      </h4>
                      <button
                        onClick={handleAddVolume}
                        className="text-xs px-3 py-1.5 rounded bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all"
                      >
                        + Add Bind Mount
                      </button>
                    </div>

                  {volumes.length === 0 ? (
                    <div className="text-center py-8">
                      <svg className="w-12 h-12 mx-auto text-muted/50 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      <p className="text-sm text-muted mb-1">No volumes or bind mounts configured</p>
                      <p className="text-xs text-muted/70">Add a bind mount to access host directories in containers</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {volumes.map((volume) => {
                        const badges = getVolumeBadges(volume.id);
                        return (
                        <div
                          key={volume.id}
                          className="p-3 rounded bg-background border border-border/50 hover:border-border transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className={`px-2 py-0.5 rounded text-[10px] font-medium ${volume.type === 'docker'
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : 'bg-green-500/20 text-green-400'
                                  }`}>
                                  {volume.type === 'docker' ? 'DOCKER' : 'BIND'}
                                </div>
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
                                <div className="font-semibold text-text text-sm truncate">{volume.name}</div>
                                {badges.defaults.length > 0 && (
                                  <div className="flex gap-0.5" title="Default for: installers, downloads, installed, roms">
                                    {badges.defaults.map((emoji, i) => (
                                      <span key={i} className="text-xs">{emoji}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="text-muted text-xs mt-1 font-mono truncate" title={volume.hostPath}>
                                {volume.hostPath}
                              </div>
                              <div className="text-muted/70 text-[10px] mt-1">
                                Created {new Date(volume.createdAt).toLocaleDateString()}
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
                              <button
                                onClick={() => handleRemoveVolume(volume.id)}
                                className="p-1.5 text-muted hover:text-error hover:bg-error/10 rounded transition-colors"
                                title="Remove volume"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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

                  {/* Unmounted Volumes Section */}
                  {unmountedVolumes.length > 0 && (
                    <div className="space-y-2 pt-4 border-t border-border">
                      <div className="mb-3">
                        <h4 className="text-xs font-semibold text-text uppercase tracking-wider mb-1">
                          Unmounted Volumes ({unmountedVolumes.length})
                        </h4>
                        <p className="text-[10px] text-muted/70 italic">
                          These volumes exist on the host but are not mounted to the container. Read-only view.
                        </p>
                      </div>

                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {unmountedVolumes.map((volume) => (
                          <div
                            key={volume.name}
                            className="p-2 rounded bg-background/50 border border-border/30 flex items-center gap-2"
                          >
                            <div className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-500/20 text-gray-400">
                              UNMOUNTED
                            </div>
                            <div className="font-medium text-text text-xs truncate">{volume.name}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Clean Session Volumes Button - DEPRECATED
                    Game saves are now stored in dillinger_root at /data/saves/<gameId>
                    No separate save volumes are created anymore.
                */}
              {/* <div className="mt-3 pt-3 border-t border-border">
                  <button
                    onClick={handleCleanSessionVolumes}
                    className="w-full text-xs px-3 py-2 rounded bg-warning/20 text-warning hover:bg-warning hover:text-white transition-all flex items-center justify-center gap-2"
                    title="Clean up inactive game session save volumes"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Clean Session Volumes
                  </button>
                </div> */}
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


      {/* File Explorer Dialog */}
      <FileExplorer
        isOpen={showFileExplorer}
        onClose={() => setShowFileExplorer(false)}
        onSelect={handleVolumeSelected}
        title="Select Volume Path"
        selectMode="directory"
        showVolumes={true}
      />

      {/* Create Volume Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface border border-border rounded-lg shadow-xl p-6 w-[480px]">
            <h3 className="text-lg font-bold text-text mb-4">Create New Bind Mount</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text mb-2">
                  Volume Name
                </label>
                <input
                  type="text"
                  value={volumeName}
                  onChange={(e) => setVolumeName(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="e.g., my-games, roms, installers"
                  autoFocus
                />
                <p className="text-xs text-muted/70 mt-1">Give this volume a descriptive name</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-2">
                  Mount Path
                </label>
                <input
                  type="text"
                  value={selectedPath}
                  onChange={(e) => setSelectedPath(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="/path/to/your/files"
                />
                <p className="text-xs text-muted/70 mt-1">
                  Path on your host system where files will be stored (bind mount)
                </p>
              </div>

              <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <InformationCircleIcon className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-text">
                    <p className="font-medium mb-1">About Bind Mounts</p>
                    <p className="text-muted/80">
                      The volume will create a bind mount to a directory on your host system.
                      This allows Dillinger containers to access your files directly without copying them.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateDialog(false);
                  setVolumeName('');
                  setSelectedPath('');
                }}
                className="flex-1 px-4 py-2 rounded-lg border border-border text-text hover:bg-background transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateVolume}
                disabled={!volumeName.trim() || !selectedPath.trim()}
                className="flex-1 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Create Bind Mount
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Volume Dialog */}
      {showLinkVolumeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface border border-border rounded-lg shadow-xl p-6 w-[480px]">
            <h3 className="text-lg font-bold text-text mb-4">Link Existing Docker Volume</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text mb-2">
                  Docker Volume
                </label>
                <select
                  value={selectedDockerVolume || ''}
                  onChange={(e) => setSelectedDockerVolume(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                >
                  <option value="">Select a volume...</option>
                  {availableDockerVolumes.map((vol) => (
                    <option key={vol} value={vol}>
                      {vol}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted/70 mt-1">
                  Choose an existing Docker volume to track in Dillinger
                </p>
              </div>

              <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <InformationCircleIcon className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-text">
                    <p className="font-medium mb-1">About Docker Volumes</p>
                    <p className="text-muted/80">
                      Docker volumes are managed by Docker and persist independently of containers.
                      Linking one here allows you to use it with Dillinger runners.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowLinkVolumeDialog(false);
                  setSelectedDockerVolume('');
                }}
                className="flex-1 px-4 py-2 rounded-lg border border-border text-text hover:bg-background transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleLinkExistingVolume}
                disabled={!selectedDockerVolume}
                className="flex-1 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Link Volume
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NOTE: Session Cleanup Dialog commented out - no longer needed with dillinger_root architecture */}
      {/* Session Cleanup Confirmation Dialog */}
      {/*
      {(() => {
        console.log('Dialog render check - showCleanupDialog:', showCleanupDialog, 'sessionInfo:', sessionInfo);
        return null;
      })()}
      {showCleanupDialog && sessionInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-lg shadow-xl p-6 w-96">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-text">Clean Session Volumes</h3>
            </div>
            
            <div className="space-y-3 mb-6">
              <p className="text-sm text-text">
                This will remove all inactive game session save volumes.
              </p>
              
              <div className="p-3 rounded bg-background border border-border space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Total session volumes:</span>
                  <span className="font-semibold text-text">{sessionInfo.total}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Active (in use):</span>
                  <span className="font-semibold text-success">{sessionInfo.active}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Inactive (will be deleted):</span>
                  <span className="font-semibold text-warning">{sessionInfo.inactive}</span>
                </div>
              </div>

              {sessionInfo.inactive === 0 && (
                <p className="text-xs text-muted italic">
                  No inactive volumes to clean up.
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCleanupDialog(false);
                  setSessionInfo(null);
                }}
                disabled={cleanupInProgress}
                className="flex-1 px-4 py-2 rounded-lg border border-border text-text hover:bg-background transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmCleanup}
                disabled={cleanupInProgress || sessionInfo.inactive === 0}
                className="flex-1 px-4 py-2 rounded-lg bg-warning text-white hover:bg-warning/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {cleanupInProgress ? 'Cleaning...' : `Clean ${sessionInfo.inactive} Volume${sessionInfo.inactive !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
      */}

      {/* Volume Settings Modal */}
      {editingVolume && (
        <VolumeSettingsModal
          isOpen={true}
          onClose={() => setEditingVolume(null)}
          volume={editingVolume}
          onSave={() => loadVolumes()}
        />
      )}
    </div>
  );
}
