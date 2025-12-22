'use client';

import { useState, useEffect } from 'react';

interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
}

interface VolumeItem {
  name: string;
  mountpoint: string | null;
  driver: string;
  createdAt?: string;
  hostPath?: string;  // For configured volumes
}

interface FileExplorerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  title?: string;
  selectMode?: 'file' | 'directory' | 'both';
  showVolumes?: boolean;
  initialPath?: string;
}

export default function FileExplorer({
  isOpen,
  onClose,
  onSelect,
  title = 'Select Path',
  selectMode = 'both',
  showVolumes = true,
  initialPath,
}: FileExplorerProps) {
  const [currentPath, setCurrentPath] = useState('');
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState('');
  const [hostRoots, setHostRoots] = useState<string[]>([]);
  const [dockerVolumes, setDockerVolumes] = useState<VolumeItem[]>([]);

  // Load home directory on mount
  useEffect(() => {
    if (isOpen && !currentPath) {
      const start = typeof initialPath === 'string' ? initialPath.trim() : '';
      if (start) {
        browsePath(start);
      } else {
        loadHome();
      }
    }
  }, [isOpen]);

  // Load volumes if enabled
  useEffect(() => {
    if (isOpen && showVolumes) {
      loadVolumes();
    }
  }, [isOpen, showVolumes]);

  async function loadHome() {
    try {
      const response = await fetch('/api/filesystem/home');
      const data = await response.json();
      if (data.success) {
        browsePath(data.data.path);
      }
    } catch (err) {
      setError('Failed to load home directory');
    }
  }

  async function loadVolumes() {
    try {
      // Load host roots
      const rootsResponse = await fetch('/api/filesystem/roots');
      const rootsData = await rootsResponse.json();
      if (rootsData.success) {
        setHostRoots(rootsData.data.roots);
      }

      // Load configured volumes from storage (these are the volumes configured in the sidebar)
      const configuredVolumesResponse = await fetch('/api/volumes');
      const configuredVolumesData = await configuredVolumesResponse.json();
      if (configuredVolumesData.success && configuredVolumesData.data) {
        // Map configured volumes to VolumeItem format
        const configuredVolumes: VolumeItem[] = configuredVolumesData.data.map((v: { name: string; hostPath: string; type: string; createdAt?: string }) => ({
          name: v.name,
          mountpoint: v.hostPath,
          hostPath: v.hostPath,
          driver: v.type || 'bind',
          createdAt: v.createdAt,
        }));
        setDockerVolumes(configuredVolumes);
      }
    } catch (err) {
      console.error('Failed to load volumes:', err);
    }
  }

  async function browsePath(path: string) {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/filesystem/browse?path=${encodeURIComponent(path)}`);
      const data = await response.json();
      
      if (data.success) {
        setCurrentPath(data.data.currentPath);
        setItems(data.data.items);
        setSelectedPath(data.data.currentPath);
      } else {
        setError(data.error || 'Failed to browse directory');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to browse directory');
    } finally {
      setLoading(false);
    }
  }

  function handleItemClick(item: FileItem) {
    if (item.type === 'directory') {
      browsePath(item.path);
    } else {
      setSelectedPath(item.path);
    }
  }

  function handleSelect() {
    if (selectMode === 'directory' && selectedPath) {
      onSelect(selectedPath);
      onClose();
    } else if (selectMode === 'file' && selectedPath && selectedPath !== currentPath) {
      onSelect(selectedPath);
      onClose();
    } else if (selectMode === 'both' && selectedPath) {
      onSelect(selectedPath);
      onClose();
    }
  }

  function formatSize(bytes?: number): string {
    if (!bytes) return '';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }

  function goUp() {
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
    browsePath(parentPath);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-lg shadow-xl w-full max-w-5xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-bold text-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-text transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Volumes Sidebar */}
          {showVolumes && (hostRoots.length > 0 || dockerVolumes.length > 0) && (
            <div className="w-56 border-r border-border p-4 overflow-y-auto bg-surface/50">
              {/* Host Roots */}
              {hostRoots.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Host</h3>
                  <div className="space-y-1">
                    {hostRoots.map((root) => (
                      <button
                        type="button"
                        key={root}
                        onClick={() => browsePath(root)}
                        className="w-full text-left px-3 py-2 rounded text-sm text-text hover:bg-primary/10 hover:text-primary transition-colors"
                      >
                        <svg className="inline-block w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                        </svg>
                        {root}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Docker Volumes */}
              {dockerVolumes.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Volumes</h3>
                  <div className="space-y-1">
                    {dockerVolumes.map((volume) => (
                      <button
                        type="button"
                        key={volume.name}
                        onClick={() => volume.mountpoint && browsePath(volume.mountpoint)}
                        disabled={!volume.mountpoint}
                        className="w-full text-left px-3 py-2 rounded text-sm hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
                        title={volume.mountpoint || 'No mount point available'}
                      >
                        <div className="flex items-start gap-2">
                          <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <div className="text-text group-hover:text-primary transition-colors truncate font-medium">
                              {volume.name}
                            </div>
                            {volume.mountpoint && (
                              <div className="text-xs text-muted truncate font-mono mt-0.5">
                                {volume.mountpoint}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* File Browser */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Path Bar */}
            <div className="p-4 border-b border-border bg-surface/30">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goUp}
                  disabled={loading || currentPath === '/'}
                  className="p-2 rounded hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Go up"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="flex-1 px-3 py-2 bg-background border border-border rounded text-sm font-mono text-text">
                  {currentPath || '/'}
                </div>
              </div>
            </div>

            {/* File List */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : error ? (
                <div className="text-center text-danger py-8">{error}</div>
              ) : items.length === 0 ? (
                <div className="text-center text-muted py-8">Empty directory</div>
              ) : (
                <div className="space-y-1">
                  {items.map((item) => {
                    const isSelected = selectedPath === item.path;
                    const canSelect = 
                      selectMode === 'both' ||
                      (selectMode === 'directory' && item.type === 'directory') ||
                      (selectMode === 'file' && item.type === 'file');

                    return (
                      <button
                        type="button"
                        key={item.path}
                        onClick={() => handleItemClick(item)}
                        className={`w-full text-left px-3 py-2 rounded flex items-center gap-3 transition-colors ${
                          isSelected && canSelect
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-surface text-text'
                        }`}
                      >
                        {item.type === 'directory' ? (
                          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        )}
                        <span className="flex-1 truncate text-sm">{item.name}</span>
                        {item.size && (
                          <span className="text-xs text-muted">{formatSize(item.size)}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex items-center justify-between bg-surface/30">
          <div className="text-sm text-muted">
            Selected: <span className="font-mono text-text">{selectedPath || 'None'}</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded border border-border text-text hover:bg-surface transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSelect}
              disabled={!selectedPath || (selectMode === 'file' && selectedPath === currentPath)}
              className="px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Select
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
