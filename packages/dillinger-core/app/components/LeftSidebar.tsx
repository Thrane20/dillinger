'use client';

import { useState, useEffect } from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import FileExplorer from './FileExplorer';

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
  const [loading, setLoading] = useState(true);

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
          const unlinkedVolumeNames = hostVolumes
            .filter((dv: DockerVolume) => !linkedVolumeNames.includes(dv.name))
            .map((dv: DockerVolume) => dv.name);
          setAvailableDockerVolumes(unlinkedVolumeNames);
          
          // Create virtual Volume entries for unlinked Docker volumes
          const unlinkedAsVolumes: Volume[] = hostVolumes
            .filter((dv: DockerVolume) => !linkedVolumeNames.includes(dv.name))
            .map((dv: DockerVolume) => ({
              id: `host-${dv.name}`,
              name: dv.name,
              dockerVolumeName: dv.name,
              hostPath: dv.mountpoint,
              createdAt: dv.createdAt || new Date().toISOString(),
              type: 'docker' as const,
              status: 'active' as const,
            }));
          
          // Merge configured volumes + unlinked host volumes
          setVolumes([...configuredVolumes, ...unlinkedAsVolumes]);
          console.log(`[LeftSidebar] Loaded ${configuredVolumes.length} configured + ${unlinkedAsVolumes.length} unlinked volumes`);
        } else {
          setVolumes(configuredVolumes);
        }
      }
    } catch (error) {
      console.error('Failed to load volumes:', error);
    } finally {
      setLoading(false);
    }
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
    <div className="space-y-4">
      <div className="card sticky top-4 border-2 border-primary/30 shadow-lg bg-surface/75 backdrop-blur-sm">
        <div className="card-body">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-text">Quick Actions</h2>
          </div>
          
          <div className="space-y-3">
            {/* Add Game */}
            <a 
              href="/games/add"
              className="block p-4 rounded-lg bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary group-hover:bg-primary group-hover:text-white transition-all">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-text group-hover:text-primary transition-colors">Add Game</h3>
                  <p className="text-xs text-muted mt-1">Add games to your library</p>
                </div>
              </div>
            </a>

            {/* Scrape Game */}
            <a 
              href="/scrapers"
              className="block p-4 rounded-lg bg-secondary/10 border border-secondary/30 hover:bg-secondary/20 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/20 text-secondary group-hover:bg-secondary group-hover:text-white transition-all">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-text group-hover:text-secondary transition-colors">Scrape Game</h3>
                  <p className="text-xs text-muted mt-1">Fetch game metadata from external sources</p>
                </div>
              </div>
            </a>

            {/* Volume Manager Section */}
            <div className="pt-2">
              <div className="p-4 rounded-lg bg-surface/50 border border-border space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-text flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                    </svg>
                    Volume Manager
                  </h3>
                </div>

                {loading ? (
                  <p className="text-xs text-muted italic">Loading...</p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-semibold text-text uppercase tracking-wider">
                        All Volumes ({volumes.length})
                      </h4>
                      <button
                        onClick={handleAddVolume}
                        className="text-xs px-3 py-1.5 rounded bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all"
                      >
                        + Add Volume
                      </button>
                    </div>

                    {volumes.length === 0 ? (
                      <div className="text-center py-8">
                        <svg className="w-12 h-12 mx-auto text-muted/50 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        <p className="text-sm text-muted mb-1">No volumes configured</p>
                        <p className="text-xs text-muted/70">Create a volume to store your games and files</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-96 overflow-y-auto">
                        {volumes.map((volume) => (
                          <div
                            key={volume.id}
                            className="p-3 rounded bg-background border border-border/50 hover:border-border transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                    volume.type === 'docker' 
                                      ? 'bg-blue-500/20 text-blue-400' 
                                      : 'bg-green-500/20 text-green-400'
                                  }`}>
                                    {volume.type === 'docker' ? 'DOCKER' : 'BIND'}
                                  </div>
                                  <div className="font-semibold text-text text-sm truncate">{volume.name}</div>
                                </div>
                                <div className="text-muted text-xs mt-1 font-mono truncate" title={volume.hostPath}>
                                  {volume.hostPath}
                                </div>
                                <div className="text-muted/70 text-[10px] mt-1">
                                  Created {new Date(volume.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                              <button
                                onClick={() => handleRemoveVolume(volume.id)}
                                className="p-1.5 text-muted hover:text-error hover:bg-error/10 rounded transition-colors flex-shrink-0"
                                title="Remove volume"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
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
            <h3 className="text-lg font-bold text-text mb-4">Create New Volume</h3>
            
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
                Create Volume
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
    </div>
  );
}
