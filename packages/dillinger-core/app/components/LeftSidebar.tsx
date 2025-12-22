'use client';

import { useState, useEffect } from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import FileExplorer from './FileExplorer';
import type { VolumePurpose } from '@dillinger/shared';

interface Volume {
  id: string;
  name: string;
  dockerVolumeName: string;
  hostPath: string;
  createdAt: string;
  type: 'docker' | 'bind';
  status: 'active' | 'error';
  purpose: VolumePurpose;
}

interface DockerVolume {
  name: string;
  driver: string;
  mountpoint: string;
}

// Volume Section Component
function VolumeSection({
  title,
  description,
  volumes,
  onAdd,
  onLink,
  onRemove,
  recommended = false,
  showLink = false,
}: {
  title: string;
  description?: string;
  volumes: Volume[];
  onAdd: () => void;
  onLink?: () => void;
  onRemove: (id: string) => void;
  recommended?: boolean;
  showLink?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-text flex items-center gap-1.5">
          {title}
          {description && (
            <span className="group relative">
              <InformationCircleIcon className="w-3.5 h-3.5 text-muted hover:text-text cursor-help" />
              <span className="invisible group-hover:visible absolute left-0 top-5 z-50 w-64 p-2 text-xs font-normal bg-gray-900 dark:bg-gray-700 text-white rounded shadow-lg">
                {description}
              </span>
            </span>
          )}
          {recommended && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary">
              Recommended
            </span>
          )}
        </h4>
        <div className="flex items-center gap-1">
          {showLink && onLink && (
            <button
              onClick={onLink}
              className="text-xs px-2 py-0.5 rounded bg-secondary/10 text-secondary hover:bg-secondary hover:text-white transition-all"
              title={`Link existing volume to ${title}`}
            >
              Link
            </button>
          )}
          <button
            onClick={onAdd}
            className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all"
            title={`Add ${title} volume`}
          >
            + Add
          </button>
        </div>
      </div>
      
      {volumes.length === 0 ? (
        <p className="text-xs text-muted italic pl-2">
          {recommended ? 'Click + Add to configure' : 'No volumes'}
        </p>
      ) : (
        <div className="space-y-1">
          {volumes.map((volume) => (
            <div
              key={volume.id}
              className="p-2 rounded bg-background border border-border"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-text truncate">{volume.name}</div>
                  <div className="text-[10px] text-muted truncate font-mono">{volume.hostPath}</div>
                </div>
                <button
                  onClick={() => onRemove(volume.id)}
                  className="text-danger hover:text-danger-hover transition-colors"
                  title="Remove volume"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [showLinkVolumeDialog, setShowLinkVolumeDialog] = useState(false);
  const [showReassignDialog, setShowReassignDialog] = useState(false);
  const [selectedDockerVolume, setSelectedDockerVolume] = useState<DockerVolume | null>(null);
  // NOTE: Cleanup dialog state commented out - no longer needed with dillinger_root architecture
  // const [showCleanupDialog, setShowCleanupDialog] = useState(false);
  const [selectedPath, setSelectedPath] = useState('');
  const [volumeName, setVolumeName] = useState('');
  const [selectedPurpose, setSelectedPurpose] = useState<VolumePurpose>('other');
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [dockerVolumes, setDockerVolumes] = useState<DockerVolume[]>([]);
  const [loading, setLoading] = useState(true);
  // const [sessionInfo, setSessionInfo] = useState<SessionVolumeInfo | null>(null);
  // const [cleanupInProgress, setCleanupInProgress] = useState(false);

  // Load volumes on mount
  useEffect(() => {
    loadVolumes();
    loadDockerVolumes();
  }, []);

  async function loadVolumes() {
    try {
      const response = await fetch('/api/volumes');
      const data = await response.json();
      if (data.success) {
        // Migrate old volumes without purpose to 'other'
        const migratedVolumes = data.data.map((v: Volume) => ({
          ...v,
          purpose: v.purpose || 'other',
        }));
        setVolumes(migratedVolumes);
      }
    } catch (error) {
      console.error('Failed to load volumes:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadDockerVolumes() {
    try {
      const response = await fetch('/api/docker-volumes');
      const data = await response.json();
      if (data.success) {
        setDockerVolumes(data.data.volumes || []);
      }
    } catch (error) {
      console.error('Failed to load Docker volumes:', error);
    }
  }

  function handleAddVolume(purpose: VolumePurpose) {
    setSelectedPurpose(purpose);
    setShowFileExplorer(true);
  }

  function handleLinkVolume(dockerVolume: DockerVolume, purpose: VolumePurpose) {
    setSelectedDockerVolume(dockerVolume);
    setSelectedPurpose(purpose);
    setVolumeName(dockerVolume.name.replace(/^dillinger_/, ''));
    setSelectedPath(dockerVolume.mountpoint);
    setShowLinkVolumeDialog(true);
  }

  function handleReassignVolume(purpose: VolumePurpose) {
    setSelectedPurpose(purpose);
    setShowReassignDialog(true);
  }

  async function handleConfirmReassign(volumeId: string) {
    try {
      const response = await fetch(`/api/volumes?id=${volumeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose: selectedPurpose,
        }),
      });

      const data = await response.json();
      if (data.success) {
        await loadVolumes(); // Reload list
        setShowReassignDialog(false);
        setSelectedPurpose('other');
      } else {
        alert(`Failed to reassign volume: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to reassign volume:', error);
      alert('Failed to reassign volume');
    }
  }

  function handleVolumeSelected(path: string) {
    setSelectedPath(path);
    setShowFileExplorer(false);
    setShowNameDialog(true);
    // Pre-fill with directory name
    const dirName = path.split('/').filter(Boolean).pop() || 'volume';
    setVolumeName(dirName);
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
          purpose: selectedPurpose,
        }),
      });

      const data = await response.json();
      if (data.success) {
        await loadVolumes(); // Reload list
        await loadDockerVolumes(); // Reload Docker volumes
        setShowNameDialog(false);
        setVolumeName('');
        setSelectedPath('');
        setSelectedPurpose('other');
      } else {
        alert(`Failed to create volume: ${data.error}${data.warning ? '\n' + data.warning : ''}`);
      }
    } catch (error) {
      console.error('Failed to create volume:', error);
      alert('Failed to create volume');
    }
  }

  async function handleLinkExistingVolume() {
    if (!volumeName.trim() || !selectedPath || !selectedDockerVolume) return;

    try {
      const response = await fetch('/api/volumes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: volumeName.trim(),
          hostPath: selectedPath,
          type: 'docker',
          purpose: selectedPurpose,
          linkExisting: true,
          dockerVolumeName: selectedDockerVolume.name,
        }),
      });

      const data = await response.json();
      if (data.success) {
        await loadVolumes(); // Reload list
        await loadDockerVolumes(); // Reload Docker volumes
        setShowLinkVolumeDialog(false);
        setVolumeName('');
        setSelectedPath('');
        setSelectedPurpose('other');
        setSelectedDockerVolume(null);
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
                  <>
                    {/* Installers Section */}
                    <VolumeSection
                      title="Installers"
                      description="Where you place your .msi and .exe files for installation. These are the game setup files before they're installed."
                      volumes={volumes.filter((v) => v.purpose === 'installers')}
                      onAdd={() => handleAddVolume('installers')}
                      onLink={() => handleReassignVolume('installers')}
                      onRemove={handleRemoveVolume}
                      recommended={volumes.filter((v) => v.purpose === 'installers').length === 0}
                      showLink={volumes.filter((v) => v.purpose === 'other').length > 0}
                    />

                    {/* Installed Games Section */}
                    <VolumeSection
                      title="Installed Games"
                      description="Where your installed Wine applications and games are stored. This is the final destination after installation from setup files."
                      volumes={volumes.filter((v) => v.purpose === 'installed')}
                      onAdd={() => handleAddVolume('installed')}
                      onLink={() => handleReassignVolume('installed')}
                      onRemove={handleRemoveVolume}
                      recommended={volumes.filter((v) => v.purpose === 'installed').length === 0}
                      showLink={volumes.filter((v) => v.purpose === 'other').length > 0}
                    />

                    {/* ROMs Section */}
                    <VolumeSection
                      title="ROMs"
                      description="Storage for game ROM files used by emulators (Commodore, Amiga, arcade, etc.). These are game images, not installers."
                      volumes={volumes.filter((v) => v.purpose === 'roms')}
                      onAdd={() => handleAddVolume('roms')}
                      onLink={() => handleReassignVolume('roms')}
                      onRemove={handleRemoveVolume}
                      recommended={volumes.filter((v) => v.purpose === 'roms').length === 0}
                      showLink={volumes.filter((v) => v.purpose === 'other').length > 0}
                    />

                    {/* Other Section */}
                    <VolumeSection
                      title="Other"
                      volumes={volumes.filter((v) => v.purpose === 'other')}
                      onAdd={() => handleAddVolume('other')}
                      onRemove={handleRemoveVolume}
                    />

                    {/* Host Volumes Section */}
                    {dockerVolumes.length > 0 && (
                      <div className="pt-3 border-t border-border">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">
                            Host Docker Volumes
                          </h4>
                        </div>
                        <div className="space-y-1">
                          {dockerVolumes
                            .filter((dv) => !volumes.some((v) => v.dockerVolumeName === dv.name))
                            .map((dv) => (
                              <div
                                key={dv.name}
                                className="p-2 rounded bg-background/50 border border-border/50 text-xs"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-text truncate">{dv.name}</div>
                                    <div className="text-muted truncate font-mono text-[10px]">
                                      {dv.mountpoint}
                                    </div>
                                  </div>
                                  <div className="relative group">
                                    <button
                                      className="text-primary hover:text-primary-hover transition-colors"
                                      title="Link to Dillinger"
                                    >
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                      </svg>
                                    </button>
                                    {/* Link Dropdown */}
                                    <div className="absolute right-0 mt-1 w-32 bg-surface border border-border rounded shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                                      {(['installers', 'installed', 'roms', 'other'] as VolumePurpose[]).map((purpose) => (
                                        <button
                                          key={purpose}
                                          onClick={() => handleLinkVolume(dv, purpose)}
                                          className="w-full text-left px-3 py-1.5 text-xs text-text hover:bg-primary/10 transition-colors capitalize"
                                        >
                                          {purpose}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </>
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

      {/* Volume Name Dialog */}
      {showNameDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface border border-border rounded-lg shadow-xl p-6 w-96">
            <h3 className="text-lg font-bold text-text mb-4">Create Volume</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text mb-2">
                  Purpose
                </label>
                <div className="px-3 py-2 bg-background/50 border border-border rounded-lg text-sm text-text font-medium capitalize">
                  {selectedPurpose}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text mb-2">
                  Volume Name
                </label>
                <input
                  type="text"
                  value={volumeName}
                  onChange={(e) => setVolumeName(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="my-games"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  Host Path
                </label>
                <div className="px-3 py-2 bg-background/50 border border-border rounded-lg text-sm text-muted font-mono truncate">
                  {selectedPath}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowNameDialog(false);
                  setVolumeName('');
                  setSelectedPath('');
                  setSelectedPurpose('other');
                }}
                className="flex-1 px-4 py-2 rounded-lg border border-border text-text hover:bg-background transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateVolume}
                disabled={!volumeName.trim()}
                className="flex-1 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link Volume Dialog */}
      {showLinkVolumeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface border border-border rounded-lg shadow-xl p-6 w-96">
            <h3 className="text-lg font-bold text-text mb-4">Link Existing Volume</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text mb-2">
                  Purpose
                </label>
                <div className="px-3 py-2 bg-background/50 border border-border rounded-lg text-sm text-text font-medium capitalize">
                  {selectedPurpose}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text mb-2">
                  Volume Name
                </label>
                <input
                  type="text"
                  value={volumeName}
                  onChange={(e) => setVolumeName(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="my-games"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  Docker Volume
                </label>
                <div className="px-3 py-2 bg-background/50 border border-border rounded-lg text-sm text-muted font-mono truncate">
                  {selectedDockerVolume?.name}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-muted mb-2">
                  Mount Point
                </label>
                <div className="px-3 py-2 bg-background/50 border border-border rounded-lg text-sm text-muted font-mono truncate">
                  {selectedPath}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowLinkVolumeDialog(false);
                  setVolumeName('');
                  setSelectedPath('');
                  setSelectedPurpose('other');
                  setSelectedDockerVolume(null);
                }}
                className="flex-1 px-4 py-2 rounded-lg border border-border text-text hover:bg-background transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleLinkExistingVolume}
                disabled={!volumeName.trim()}
                className="flex-1 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reassign Volume Dialog */}
      {showReassignDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface border border-border rounded-lg shadow-xl p-6 w-96">
            <h3 className="text-lg font-bold text-text mb-4">
              Link Volume to {selectedPurpose === 'installers' ? 'Installers' : selectedPurpose === 'installed' ? 'Installed Games' : 'ROMs'}
            </h3>
            
            <div className="space-y-2 mb-6">
              <p className="text-sm text-muted mb-3">
                Select a volume from "Other" to reassign:
              </p>
              
              {volumes.filter((v) => v.purpose === 'other').length === 0 ? (
                <p className="text-sm text-muted italic text-center py-4">
                  No volumes available in "Other" category
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {volumes.filter((v) => v.purpose === 'other').map((volume) => (
                    <button
                      key={volume.id}
                      onClick={() => handleConfirmReassign(volume.id)}
                      className="w-full text-left p-3 rounded bg-background border border-border hover:bg-primary/10 hover:border-primary transition-all group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-text group-hover:text-primary truncate">
                            {volume.name}
                          </div>
                          <div className="text-xs text-muted truncate font-mono mt-0.5">
                            {volume.hostPath}
                          </div>
                        </div>
                        <svg className="w-5 h-5 text-muted group-hover:text-primary transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowReassignDialog(false);
                  setSelectedPurpose('other');
                }}
                className="px-4 py-2 rounded-lg border border-border text-text hover:bg-background transition-all"
              >
                Cancel
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
