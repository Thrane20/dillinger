'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  TrashIcon,
  ArrowPathIcon,
  ServerIcon,
  InformationCircleIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface BiosFile {
  name: string;
  size: number;
  modified: string;
}

interface RunnerStatus {
  id: string;
  repository: string;
  image: string;
  name: string;
  description: string;
  platforms: string[];
  installed: boolean;
  installedVersion?: string;
  latestVersion?: string;
  updateAvailable?: boolean;
  imageId?: string;
  size?: number;
  created?: string;
}

interface PullProgress {
  runnerId: string;
  progress: number;
  status: string;
  error?: string;
}

// Wine version types
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

interface AvailableWineVersion {
  type: 'system' | 'wine-staging' | 'ge-proton';
  version: string;
  displayName: string;
  downloadUrl: string;
  size?: number;
  releaseDate?: string;
  checksumUrl?: string;
  releaseNotes?: string;
}

interface WineVersionsStatus {
  installed: InstalledWineVersion[];
  available: {
    geProton: AvailableWineVersion[];
    wineStaging: AvailableWineVersion[];
  };
  defaultId: string;
  lastRefreshed: string;
}

interface WineInstallProgress {
  versionId: string;
  percent: number;
  status: string;
  error?: string;
}

// Per-section save success indicator component
function SaveIndicator({ show, message }: { show: boolean; message: string }) {
  if (!show) return null;
  return (
    <div className="flex items-center gap-2 bg-green-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow-lg animate-pulse">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      {message}
    </div>
  );
}

// Platform sections for sidebar navigation
const PLATFORM_SECTIONS = [
  { id: 'runners', label: 'Runners', icon: '🖥️' },
  { id: 'wine', label: 'Wine (Windows)', icon: '🍷' },
  { id: 'nes', label: 'NES', icon: '🎮' },
  { id: 'snes', label: 'Super Nintendo', icon: '🕹️' },
  { id: 'arcade', label: 'Arcade / MAME', icon: '👾' },
  { id: 'c64', label: 'C64 / Commodore', icon: '💾' },
  { id: 'amiga', label: 'Amiga', icon: '🖱️' },
];

// Platform settings types
interface NesSettings {
  core: 'nestopia' | 'fceumm' | 'mesen';
  region: 'auto' | 'ntsc' | 'pal';
}

interface SnesSettings {
  core: 'snes9x' | 'bsnes' | 'bsnes_hd';
  region: 'auto' | 'ntsc' | 'pal';
  superfxOverclock: boolean;
}

interface ArcadeSettings {
  videoMode: 'opengl' | 'bgfx' | 'soft';
}

interface C64Settings {
  trueDriveEmulation: boolean;
  warpMode: boolean;
}

interface WineSettings {
  architecture: 'win64' | 'win32';
  renderer: 'vulkan' | 'opengl';
}

interface PlatformSettings {
  nes: NesSettings;
  snes: SnesSettings;
  arcade: ArcadeSettings;
  c64: C64Settings;
  wine: WineSettings;
}

// Default settings
const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  nes: { core: 'nestopia', region: 'auto' },
  snes: { core: 'snes9x', region: 'auto', superfxOverclock: false },
  arcade: { videoMode: 'opengl' },
  c64: { trueDriveEmulation: true, warpMode: false },
  wine: { architecture: 'win64', renderer: 'vulkan' },
};

export default function PlatformsPage() {
  // Section refs for scrolling
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  
  // Active section for sidebar highlight
  const [activeSection, setActiveSection] = useState('runners');
  const [files, setFiles] = useState<BiosFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Runner state
  const [runners, setRunners] = useState<RunnerStatus[]>([]);
  const [loadingRunners, setLoadingRunners] = useState(false);
  const [pullProgress, setPullProgress] = useState<Record<string, PullProgress>>({});

  // Wine versions state
  const [wineVersions, setWineVersions] = useState<WineVersionsStatus | null>(null);
  const [loadingWineVersions, setLoadingWineVersions] = useState(false);
  const [wineInstallProgress, setWineInstallProgress] = useState<Record<string, WineInstallProgress>>({});
  const [refreshingWineCache, setRefreshingWineCache] = useState(false);

  // Per-section save indicators
  const [savedSections, setSavedSections] = useState<Record<string, string>>({});
  
  // Platform settings state
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Load platform settings on mount
  useEffect(() => {
    loadPlatformSettings();
  }, []);

  const loadPlatformSettings = async () => {
    try {
      setLoadingSettings(true);
      const response = await fetch(`${API_BASE_URL}/api/settings/platforms`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.settings) {
          setPlatformSettings({
            ...DEFAULT_PLATFORM_SETTINGS,
            ...data.settings,
          });
        }
      }
    } catch (error) {
      console.error('Failed to load platform settings:', error);
    } finally {
      setLoadingSettings(false);
    }
  };

  // Helper to show save indicator for a section
  const showSaveIndicator = (sectionId: string, msg: string = 'Saved!') => {
    setSavedSections(prev => ({ ...prev, [sectionId]: msg }));
    setTimeout(() => {
      setSavedSections(prev => {
        const newState = { ...prev };
        delete newState[sectionId];
        return newState;
      });
    }, 2000);
  };

  // Save platform settings
  const savePlatformSettings = async (platformId: keyof PlatformSettings) => {
    try {
      const settings = platformSettings[platformId];
      const response = await fetch(`${API_BASE_URL}/api/settings/platforms`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platformId, settings }),
      });

      if (response.ok) {
        showSaveIndicator(platformId, `${platformId.toUpperCase()} settings saved!`);
        setMessage({ type: 'success', text: `${platformId.toUpperCase()} settings saved successfully` });
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error(`Failed to save ${platformId} settings:`, error);
      setMessage({ type: 'error', text: `Failed to save ${platformId} settings` });
    }
  };

  // Update a specific platform setting
  const updatePlatformSetting = <K extends keyof PlatformSettings>(
    platformId: K,
    key: keyof PlatformSettings[K],
    value: PlatformSettings[K][keyof PlatformSettings[K]]
  ) => {
    setPlatformSettings(prev => ({
      ...prev,
      [platformId]: {
        ...prev[platformId],
        [key]: value,
      },
    }));
  };

  // Scroll to section when clicking sidebar
  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = sectionRefs.current[sectionId];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Intersection observer for active section tracking
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.3, rootMargin: '-100px 0px -50% 0px' }
    );

    Object.values(sectionRefs.current).forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  // Load runners on mount
  useEffect(() => {
    loadRunners();
  }, []);

  // Load Wine versions when Wine section is active
  useEffect(() => {
    if (activeSection === 'wine') {
      loadWineVersions();
    }
  }, [activeSection]);

  // Load BIOS files when section changes
  useEffect(() => {
    if (activeSection === 'amiga') {
      loadBiosFiles('amiga');
    } else if (activeSection === 'c64') {
      loadBiosFiles('c64');
    }
  }, [activeSection]);

  const loadRunners = async () => {
    setLoadingRunners(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/runners`);
      if (response.ok) {
        const data = await response.json();
        // Filter out runner-base - it's infrastructure, not user-facing
        const filteredRunners = (data.runners || []).filter(
          (r: RunnerStatus) => r.id !== 'base'
        );
        setRunners(filteredRunners);
      }
    } catch (error) {
      console.error('Failed to load runners:', error);
    } finally {
      setLoadingRunners(false);
    }
  };

  const loadBiosFiles = async (platformId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/platforms/${platformId}/bios`);
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files || []);
      }
    } catch (error) {
      console.error('Failed to load BIOS files:', error);
    }
  };

  // Wine version management functions
  const loadWineVersions = async () => {
    setLoadingWineVersions(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/wine-versions`);
      if (response.ok) {
        const data = await response.json();
        setWineVersions(data);
      }
    } catch (error) {
      console.error('Failed to load Wine versions:', error);
    } finally {
      setLoadingWineVersions(false);
    }
  };

  const refreshWineVersionsCache = async () => {
    setRefreshingWineCache(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/wine-versions/refresh`, {
        method: 'POST',
      });
      if (response.ok) {
        await loadWineVersions();
        setMessage({ type: 'success', text: 'Wine versions cache refreshed' });
      }
    } catch (error) {
      console.error('Failed to refresh Wine versions:', error);
      setMessage({ type: 'error', text: 'Failed to refresh Wine versions' });
    } finally {
      setRefreshingWineCache(false);
    }
  };

  const installWineVersion = useCallback(async (version: AvailableWineVersion) => {
    const versionId = `${version.type}-${version.version}`.toLowerCase().replace(/\s+/g, '-');
    
    setWineInstallProgress(prev => ({
      ...prev,
      [versionId]: { versionId, percent: 0, status: 'Starting...' }
    }));

    try {
      const response = await fetch(`${API_BASE_URL}/api/wine-versions?stream=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version }),
      });

      if (!response.ok) {
        throw new Error('Installation request failed');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'progress') {
                setWineInstallProgress(prev => ({
                  ...prev,
                  [versionId]: {
                    versionId,
                    percent: data.percent,
                    status: data.status
                  }
                }));
              } else if (data.type === 'complete') {
                setWineInstallProgress(prev => {
                  const newState = { ...prev };
                  delete newState[versionId];
                  return newState;
                });
                loadWineVersions();
                setMessage({ type: 'success', text: `${version.displayName} installed successfully!` });
              } else if (data.type === 'error') {
                setWineInstallProgress(prev => ({
                  ...prev,
                  [versionId]: {
                    versionId,
                    percent: 0,
                    status: 'Failed',
                    error: data.error
                  }
                }));
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Wine install error:', error);
      setWineInstallProgress(prev => ({
        ...prev,
        [versionId]: {
          versionId,
          percent: 0,
          status: 'Failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }));
    }
  }, []);

  const removeWineVersion = async (versionId: string) => {
    if (!confirm('Are you sure you want to remove this Wine version?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/wine-versions/${versionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Wine version removed successfully' });
        loadWineVersions();
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to remove Wine version' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to remove Wine version' });
    }
  };

  const setDefaultWineVersion = async (versionId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/wine-versions/default`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Default Wine version updated' });
        loadWineVersions();
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to set default' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to set default Wine version' });
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, platformId: string) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < e.target.files.length; i++) {
      formData.append('files', e.target.files[i]);
    }

    try {
      setUploading(true);
      setMessage(null);

      const response = await fetch(`${API_BASE_URL}/api/platforms/${platformId}/bios`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      setMessage({ type: 'success', text: 'Files uploaded successfully' });
      loadBiosFiles(platformId);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Upload error:', error);
      setMessage({ type: 'error', text: 'Failed to upload files' });
    } finally {
      setUploading(false);
    }
  };

  const pullRunner = useCallback(async (runnerId: string, version: string) => {
    setPullProgress(prev => ({
      ...prev,
      [runnerId]: { runnerId, progress: 0, status: 'Starting pull...' }
    }));

    try {
      const response = await fetch(`${API_BASE_URL}/api/runners/${runnerId}/pull?version=${encodeURIComponent(version)}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Pull request failed');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'progress') {
                setPullProgress(prev => ({
                  ...prev,
                  [runnerId]: {
                    runnerId,
                    progress: data.progress,
                    status: `${data.status} (${data.progress}%)`
                  }
                }));
              } else if (data.type === 'status') {
                setPullProgress(prev => ({
                  ...prev,
                  [runnerId]: {
                    ...prev[runnerId],
                    status: data.status
                  }
                }));
              } else if (data.type === 'complete') {
                setPullProgress(prev => {
                  const newState = { ...prev };
                  delete newState[runnerId];
                  return newState;
                });
                loadRunners();
                setMessage({ type: 'success', text: 'Runner downloaded successfully!' });
              } else if (data.type === 'error') {
                setPullProgress(prev => ({
                  ...prev,
                  [runnerId]: {
                    runnerId,
                    progress: 0,
                    status: 'Failed',
                    error: data.message
                  }
                }));
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Pull error:', error);
      setPullProgress(prev => ({
        ...prev,
        [runnerId]: {
          runnerId,
          progress: 0,
          status: 'Failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }));
    }
  }, []);

  const removeRunner = async (runnerId: string) => {
    if (!confirm('Are you sure you want to remove this runner image?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/runners/${runnerId}/pull`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Runner removed successfully' });
        loadRunners();
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to remove runner' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to remove runner' });
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getRunnerForPlatform = (platformId: string): RunnerStatus | undefined => {
    return runners.find(r => r.platforms.includes(platformId));
  };

  const renderRunnerStatus = (runner: RunnerStatus | undefined, platformName: string) => {
    if (!runner) {
      return (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
            <ExclamationTriangleIcon className="w-5 h-5" />
            <span>No runner configured for {platformName}</span>
          </div>
        </div>
      );
    }

    const isPulling = !!pullProgress[runner.id];
    const progress = pullProgress[runner.id];

    return (
      <div className={`border rounded-lg p-4 mb-6  ${
        runner.installed 
          ? runner.updateAvailable
            ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
            : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
          : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {runner.installed ? (
              runner.updateAvailable ? (
                <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              ) : (
                <CheckCircleIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
              )
            ) : (
              <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-gray-900 dark:text-gray-100">{runner.name}</h4>
                {runner.updateAvailable && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 rounded-full">
                    Update Available
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">{runner.description}</p>
              <div className="flex items-center gap-3 mt-1">
                {runner.installed && runner.installedVersion && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Installed: <span className="font-mono text-green-600 dark:text-green-400">v{runner.installedVersion}</span>
                  </span>
                )}
                {runner.latestVersion && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Latest: <span className="font-mono text-blue-600 dark:text-blue-400">v{runner.latestVersion}</span>
                  </span>
                )}
                {runner.installed && runner.size && (
                  <span className="text-xs text-gray-400">{formatBytes(runner.size)}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {runner.installed ? (
              <>
                {runner.updateAvailable && runner.latestVersion && (
                  <button
                    onClick={() => pullRunner(runner.id, runner.latestVersion!)}
                    disabled={isPulling}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isPulling ? (
                      <>
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <ArrowPathIcon className="w-4 h-4" />
                        Update to v{runner.latestVersion}
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={() => removeRunner(runner.id)}
                  className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  title="Remove runner"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              </>
            ) : (
              <button
                onClick={() => runner.latestVersion && pullRunner(runner.id, runner.latestVersion)}
                disabled={isPulling || !runner.latestVersion}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isPulling ? (
                  <>
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <ArrowDownTrayIcon className="w-4 h-4" />
                    Download {runner.latestVersion ? `v${runner.latestVersion}` : ''}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
        
        {isPulling && progress && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
              <span>{progress.status}</span>
              <span>{progress.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress.progress}%` }}
              />
            </div>
            {progress.error && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">{progress.error}</p>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderRunnersSection = () => (
    <div 
      id="runners"
      ref={(el) => { sectionRefs.current['runners'] = el; }}
      className="space-y-6 border border-gray-200 dark:border-gray-700 p-6 rounded-lg"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Runner Images</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage Docker images that power game emulation and compatibility layers.
            Images are downloaded from <code className="text-sm bg-gray-100 dark:bg-gray-800 px-1 rounded">ghcr.io/thrane20/dillinger</code>
          </p>
        </div>
        <button
          onClick={loadRunners}
          disabled={loadingRunners}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ArrowPathIcon className={`w-4 h-4 ${loadingRunners ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loadingRunners && runners.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <ArrowPathIcon className="w-8 h-8 animate-spin mx-auto mb-2" />
          Loading runners...
        </div>
      ) : (
        <div className="grid gap-4">
          {runners.map(runner => (
            <div
              key={runner.id}
              className={`bg-white dark:bg-gray-800 border rounded-lg p-4 ${
                runner.installed
                  ? runner.updateAvailable
                    ? 'border-yellow-300 dark:border-yellow-700'
                    : 'border-green-200 dark:border-green-800'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${
                    runner.installed 
                      ? runner.updateAvailable
                        ? 'bg-yellow-100 dark:bg-yellow-900/30'
                        : 'bg-green-100 dark:bg-green-900/30' 
                      : 'bg-gray-100 dark:bg-gray-700'
                  }`}>
                    {runner.installed ? (
                      runner.updateAvailable ? (
                        <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                      ) : (
                        <CheckCircleIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
                      )
                    ) : (
                      <ServerIcon className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">{runner.name}</h3>
                      {runner.updateAvailable && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 rounded-full">
                          Update Available
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{runner.description}</p>
                    <div className="flex items-center gap-3 mt-1">
                      {runner.installed && runner.installedVersion && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Installed: <span className="font-mono text-green-600 dark:text-green-400">v{runner.installedVersion}</span>
                        </span>
                      )}
                      {runner.latestVersion && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Latest: <span className="font-mono text-blue-600 dark:text-blue-400">v{runner.latestVersion}</span>
                        </span>
                      )}
                      {runner.installed && runner.size && (
                        <span className="text-xs text-gray-400">{formatBytes(runner.size)}</span>
                      )}
                    </div>
                    {runner.platforms.length > 0 && (
                      <div className="flex items-center gap-1 mt-2">
                        <span className="text-xs text-gray-400">Platforms:</span>
                        {runner.platforms.map(p => (
                          <span key={p} className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {runner.installed ? (
                    <>
                      {runner.updateAvailable && runner.latestVersion && (
                        <button
                          onClick={() => pullRunner(runner.id, runner.latestVersion!)}
                          disabled={!!pullProgress[runner.id]}
                          className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 transition-colors"
                        >
                          {pullProgress[runner.id] ? (
                            <>
                              <ArrowPathIcon className="w-4 h-4 animate-spin" />
                              {pullProgress[runner.id].progress}%
                            </>
                          ) : (
                            <>
                              <ArrowPathIcon className="w-4 h-4" />
                              Update to v{runner.latestVersion}
                            </>
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => removeRunner(runner.id)}
                        className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <TrashIcon className="w-4 h-4" />
                        Remove
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => runner.latestVersion && pullRunner(runner.id, runner.latestVersion)}
                      disabled={!!pullProgress[runner.id] || !runner.latestVersion}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {pullProgress[runner.id] ? (
                        <>
                          <ArrowPathIcon className="w-4 h-4 animate-spin" />
                          {pullProgress[runner.id].progress}%
                        </>
                      ) : (
                        <>
                          <ArrowDownTrayIcon className="w-4 h-4" />
                          Download {runner.latestVersion ? `v${runner.latestVersion}` : ''}
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
              
              {pullProgress[runner.id] && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                    <span>{pullProgress[runner.id].status}</span>
                    <span>{pullProgress[runner.id].progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${pullProgress[runner.id].progress}%` }}
                    />
                  </div>
                  {pullProgress[runner.id].error && (
                    <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                      {pullProgress[runner.id].error}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderWineSection = () => {
    const wineRunner = getRunnerForPlatform('windows-wine');
    
    const getVersionTypeBadge = (type: string) => {
      switch (type) {
        case 'system':
          return <span className="px-2 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">System</span>;
        case 'ge-proton':
          return <span className="px-2 py-0.5 text-xs rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">GE-Proton</span>;
        case 'wine-staging':
          return <span className="px-2 py-0.5 text-xs rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">Wine Staging</span>;
        default:
          return null;
      }
    };

    const formatSize = (bytes?: number) => {
      if (!bytes) return '';
      const mb = bytes / (1024 * 1024);
      if (mb > 1024) return `${(mb / 1024).toFixed(1)} GB`;
      return `${mb.toFixed(0)} MB`;
    };

    const formatDate = (dateStr?: string) => {
      if (!dateStr) return '';
      return new Date(dateStr).toLocaleDateString();
    };
    
    return (
      <div 
        id="wine"
        ref={(el) => { sectionRefs.current['wine'] = el; }}
        className="space-y-6 border border-gray-200 dark:border-gray-700 p-6 rounded-lg"
      >
        <div>
          <h2 className="text-2xl font-semibold">Wine (Windows Games)</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Run Windows games and applications via Wine compatibility layer.
          </p>
        </div>

        {renderRunnerStatus(wineRunner, 'Wine')}

        {wineRunner?.installed && (
          <>
            {/* Wine Version Management */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">Wine Versions</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Manage Wine and GE-Proton versions. GE-Proton uses <span className="font-medium text-purple-600 dark:text-purple-400">UMU Launcher</span> for enhanced game compatibility.
                  </p>
                </div>
                <button
                  onClick={refreshWineVersionsCache}
                  disabled={refreshingWineCache || loadingWineVersions}
                  className="flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Refresh available versions from upstream"
                >
                  <ArrowPathIcon className={`w-4 h-4 ${refreshingWineCache ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {loadingWineVersions && !wineVersions ? (
                <div className="text-center py-8 text-gray-500">
                  <ArrowPathIcon className="w-8 h-8 animate-spin mx-auto mb-2" />
                  Loading Wine versions...
                </div>
              ) : wineVersions ? (
                <div className="space-y-6">
                  {/* Installed Versions */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Installed Versions</h4>
                    <div className="space-y-2">
                      {wineVersions.installed.map(version => {
                        const isDefault = version.id === wineVersions.defaultId;
                        return (
                          <div
                            key={version.id}
                            className={`flex items-center justify-between p-3 rounded-lg border ${
                              isDefault 
                                ? 'border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20' 
                                : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => setDefaultWineVersion(version.id)}
                                className={`p-1 rounded ${isDefault ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-500'}`}
                                title={isDefault ? 'Default version' : 'Set as default'}
                              >
                                {isDefault ? <StarIconSolid className="w-5 h-5" /> : <StarIcon className="w-5 h-5" />}
                              </button>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900 dark:text-gray-100">{version.displayName}</span>
                                  {getVersionTypeBadge(version.type)}
                                  {version.usesUmu && (
                                    <span className="px-2 py-0.5 text-xs rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                      UMU
                                    </span>
                                  )}
                                  {isDefault && (
                                    <span className="px-2 py-0.5 text-xs rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                                      Default
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  {version.type === 'system' ? 'Built into container' : `Installed ${formatDate(version.installedAt)}`}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {version.releaseNotes && (
                                <button
                                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                  title={version.releaseNotes}
                                >
                                  <InformationCircleIcon className="w-5 h-5" />
                                </button>
                              )}
                              {version.id !== 'system' && (
                                <button
                                  onClick={() => removeWineVersion(version.id)}
                                  disabled={isDefault}
                                  className={`p-2 rounded-lg transition-colors ${
                                    isDefault 
                                      ? 'text-gray-300 cursor-not-allowed' 
                                      : 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                                  }`}
                                  title={isDefault ? 'Cannot remove default version' : 'Remove version'}
                                >
                                  <TrashIcon className="w-5 h-5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Available GE-Proton Versions */}
                  {wineVersions.available.geProton.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Available GE-Proton Versions
                        <span className="ml-2 text-xs font-normal text-gray-500">
                          (Uses UMU Launcher for Steam/Proton compatibility fixes)
                        </span>
                      </h4>
                      <div className="grid gap-2 max-h-64 overflow-y-auto">
                        {wineVersions.available.geProton.map(version => {
                          const versionId = `ge-proton-${version.version}`.toLowerCase();
                          const progress = wineInstallProgress[versionId];
                          const isInstalling = !!progress;
                          
                          return (
                            <div
                              key={versionId}
                              className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-900 dark:text-gray-100">{version.displayName}</span>
                                  {getVersionTypeBadge(version.type)}
                                  {version.size && (
                                    <span className="text-xs text-gray-400">{formatSize(version.size)}</span>
                                  )}
                                </div>
                                {version.releaseDate && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    Released {formatDate(version.releaseDate)}
                                  </div>
                                )}
                                {isInstalling && (
                                  <div className="mt-2">
                                    <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                                      <span>{progress.status}</span>
                                      <span>{progress.percent}%</span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                      <div
                                        className="bg-purple-600 h-1.5 rounded-full transition-all duration-300"
                                        style={{ width: `${progress.percent}%` }}
                                      />
                                    </div>
                                    {progress.error && (
                                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">{progress.error}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => installWineVersion(version)}
                                disabled={isInstalling || !version.downloadUrl}
                                className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ml-4"
                              >
                                {isInstalling ? (
                                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                ) : (
                                  <ArrowDownTrayIcon className="w-4 h-4" />
                                )}
                                {isInstalling ? 'Installing...' : 'Install'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Available Wine Staging Versions */}
                  {wineVersions.available.wineStaging.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Wine Staging Releases
                        <span className="ml-2 text-xs font-normal text-gray-500">
                          (Reference only - install via package manager or container rebuild)
                        </span>
                      </h4>
                      <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          Wine Staging versions are distributed via package managers. Update your container to get the latest Wine Staging release.
                        </p>
                        <div className="text-xs text-gray-500">
                          Latest: {wineVersions.available.wineStaging[0]?.displayName || 'Unknown'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Cache info */}
                  {wineVersions.lastRefreshed && (
                    <div className="text-xs text-gray-400 text-right">
                      Cache updated: {new Date(wineVersions.lastRefreshed).toLocaleString()}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <ExclamationTriangleIcon className="w-8 h-8 mx-auto mb-2" />
                  Failed to load Wine versions
                </div>
              )}
            </div>

            {/* Wine Configuration */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-2">Wine Configuration</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Global Wine settings. Individual games can override these in their game settings.
                </p>
                
                <div className="grid gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Default Wine Architecture
                    </label>
                    <select 
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                      value={platformSettings.wine.architecture}
                      onChange={(e) => updatePlatformSetting('wine', 'architecture', e.target.value as WineSettings['architecture'])}
                    >
                      <option value="win64">64-bit (win64)</option>
                      <option value="win32">32-bit (win32)</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Most modern games require 64-bit Wine</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Default Renderer
                    </label>
                    <select 
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                      value={platformSettings.wine.renderer}
                      onChange={(e) => updatePlatformSetting('wine', 'renderer', e.target.value as WineSettings['renderer'])}
                    >
                      <option value="vulkan">Vulkan (recommended)</option>
                      <option value="opengl">OpenGL (legacy games)</option>
                    </select>
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <SaveIndicator show={!!savedSections['wine']} message={savedSections['wine'] || ''} />
                  <button
                    onClick={() => savePlatformSettings('wine')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                  >
                    Save Wine Settings
                  </button>
                </div>
              </div>
            </div>

            {/* UMU Info Box */}
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <InformationCircleIcon className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-purple-800 dark:text-purple-200">About UMU Launcher</h4>
                  <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                    GE-Proton versions use the <a href="https://github.com/Open-Wine-Components/umu-launcher" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">UMU Launcher</a> for 
                    running Proton outside of Steam. This enables automatic protonfixes and Steam Runtime compatibility.
                    You can configure a UMU Game ID per-game to enable game-specific fixes from the <a href="https://github.com/Open-Wine-Components/umu-database" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">umu-database</a>.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderC64Section = () => {
    const viceRunner = getRunnerForPlatform('c64');
    
    return (
      <div 
        id="c64"
        ref={(el) => { sectionRefs.current['c64'] = el; }}
        className="space-y-6 border border-gray-200 dark:border-gray-700 p-6 rounded-lg"
      >
        <div>
          <h2 className="text-2xl font-semibold">Commodore Emulation</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Commodore 64, 128, VIC-20, Plus/4, and PET emulation via VICE.
          </p>
        </div>

        {renderRunnerStatus(viceRunner, 'VICE')}

        {viceRunner?.installed && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-medium mb-4">VICE Settings</h3>
            <div className="grid gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-gray-700 dark:text-gray-300">True Drive Emulation</label>
                  <p className="text-sm text-gray-500">Accurate but slower disk emulation</p>
                </div>
                <input 
                  type="checkbox" 
                  className="w-5 h-5 rounded border-gray-300"
                  checked={platformSettings.c64.trueDriveEmulation}
                  onChange={(e) => updatePlatformSetting('c64', 'trueDriveEmulation', e.target.checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-gray-700 dark:text-gray-300">Warp Mode</label>
                  <p className="text-sm text-gray-500">Run emulation at maximum speed (no speed limit)</p>
                </div>
                <input 
                  type="checkbox" 
                  className="w-5 h-5 rounded border-gray-300"
                  checked={platformSettings.c64.warpMode}
                  onChange={(e) => updatePlatformSetting('c64', 'warpMode', e.target.checked)}
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <SaveIndicator show={!!savedSections['c64']} message={savedSections['c64'] || ''} />
              <button
                onClick={() => savePlatformSettings('c64')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Save C64 Settings
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderArcadeSection = () => {
    const retroarchRunner = runners.find(r => r.id === 'retroarch');
    
    return (
      <div 
        id="arcade"
        ref={(el) => { sectionRefs.current['arcade'] = el; }}
        className="space-y-6 border border-gray-200 dark:border-gray-700 p-6 rounded-lg"
      >
        <div>
          <h2 className="text-2xl font-semibold">Arcade / MAME</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Classic arcade game emulation via MAME cores in RetroArch.
          </p>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Available Runners</h3>
          {renderRunnerStatus(retroarchRunner, 'RetroArch Runner')}
        </div>

        {retroarchRunner?.installed && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-medium mb-4">MAME Settings</h3>
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Video Mode
                </label>
                <select 
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  value={platformSettings.arcade.videoMode}
                  onChange={(e) => updatePlatformSetting('arcade', 'videoMode', e.target.value as ArcadeSettings['videoMode'])}
                >
                  <option value="opengl">OpenGL</option>
                  <option value="bgfx">BGFX</option>
                  <option value="soft">Software</option>
                </select>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <SaveIndicator show={!!savedSections['arcade']} message={savedSections['arcade'] || ''} />
              <button
                onClick={() => savePlatformSettings('arcade')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Save MAME Settings
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAmigaSection = () => {
    const amigaRunner = getRunnerForPlatform('amiga');
    
    return (
      <div 
        id="amiga"
        ref={(el) => { sectionRefs.current['amiga'] = el; }}
        className="space-y-6 border border-gray-200 dark:border-gray-700 p-6 rounded-lg"
      >
        <div>
          <h2 className="text-2xl font-semibold">Amiga Emulation</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Amiga 500/1200/CD32 emulation via FS-UAE.
          </p>
        </div>

        {renderRunnerStatus(amigaRunner, 'FS-UAE')}

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-medium mb-4">Kickstart ROMs</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Upload Kickstart ROM files required for Amiga emulation. 
            Common files include <code className="text-sm bg-gray-100 dark:bg-gray-700 px-1 rounded">kick34005.A500</code>, 
            <code className="text-sm bg-gray-100 dark:bg-gray-700 px-1 rounded">kick40068.A1200</code>, etc.
          </p>

          <div className="mb-8">
            <label className="block text-sm font-medium mb-2">Upload ROM Files</label>
            <div className="flex items-center gap-4">
              <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={(e) => handleUpload(e, 'amiga')}
                disabled={uploading}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100
                  dark:file:bg-blue-900 dark:file:text-blue-200
                "
              />
              {uploading && <span className="text-sm text-gray-500">Uploading...</span>}
            </div>
          </div>

          <div>
            <h4 className="text-md font-medium mb-3">Uploaded Files</h4>
            {files.length === 0 ? (
              <p className="text-gray-500 italic">No BIOS files uploaded yet.</p>
            ) : (
              <div className="border rounded-lg overflow-hidden dark:border-gray-700">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Filename</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Size</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Modified</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {files.map((file) => (
                      <tr key={file.name}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{file.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{(file.size / 1024).toFixed(1)} KB</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{new Date(file.modified).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderNesSection = () => {
    const retroarchRunner = runners.find(r => r.id === 'retroarch');
    
    return (
      <div 
        id="nes"
        ref={(el) => { sectionRefs.current['nes'] = el; }}
        className="space-y-6 border border-gray-200 dark:border-gray-700 p-6 rounded-lg"
      >
        <div>
          <h2 className="text-2xl font-semibold">Nintendo Entertainment System (NES)</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            NES/Famicom emulation via Nestopia core in RetroArch.
          </p>
        </div>

        {renderRunnerStatus(retroarchRunner, 'RetroArch Runner')}

        {retroarchRunner?.installed && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-medium mb-4">NES Settings</h3>
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Core
                </label>
                <select 
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  value={platformSettings.nes.core}
                  onChange={(e) => updatePlatformSetting('nes', 'core', e.target.value as NesSettings['core'])}
                >
                  <option value="nestopia">Nestopia UE (recommended)</option>
                  <option value="fceumm">FCEUmm</option>
                  <option value="mesen">Mesen (accuracy)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Nestopia offers excellent accuracy and performance balance</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Region
                </label>
                <select 
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  value={platformSettings.nes.region}
                  onChange={(e) => updatePlatformSetting('nes', 'region', e.target.value as NesSettings['region'])}
                >
                  <option value="auto">Auto-detect</option>
                  <option value="ntsc">NTSC (USA/Japan)</option>
                  <option value="pal">PAL (Europe)</option>
                </select>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <SaveIndicator show={!!savedSections['nes']} message={savedSections['nes'] || ''} />
              <button
                onClick={() => savePlatformSettings('nes')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Save NES Settings
              </button>
            </div>
          </div>
        )}

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <InformationCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-blue-800 dark:text-blue-200">Supported Formats</h4>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                .nes, .unf, .unif, .fds (Famicom Disk System), .zip, .7z
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSnesSection = () => {
    const retroarchRunner = runners.find(r => r.id === 'retroarch');
    
    return (
      <div 
        id="snes"
        ref={(el) => { sectionRefs.current['snes'] = el; }}
        className="space-y-6 border border-gray-200 dark:border-gray-700 p-6 rounded-lg"
      >
        <div>
          <h2 className="text-2xl font-semibold">Super Nintendo (SNES)</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            SNES/Super Famicom emulation via Snes9x core in RetroArch.
          </p>
        </div>

        {renderRunnerStatus(retroarchRunner, 'RetroArch Runner')}

        {retroarchRunner?.installed && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-medium mb-4">SNES Settings</h3>
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Core
                </label>
                <select 
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  value={platformSettings.snes.core}
                  onChange={(e) => updatePlatformSetting('snes', 'core', e.target.value as SnesSettings['core'])}
                >
                  <option value="snes9x">Snes9x (recommended)</option>
                  <option value="bsnes">bsnes (accuracy)</option>
                  <option value="bsnes_hd">bsnes HD (widescreen)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Snes9x provides great accuracy with excellent performance</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Region
                </label>
                <select 
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  value={platformSettings.snes.region}
                  onChange={(e) => updatePlatformSetting('snes', 'region', e.target.value as SnesSettings['region'])}
                >
                  <option value="auto">Auto-detect</option>
                  <option value="ntsc">NTSC (USA/Japan)</option>
                  <option value="pal">PAL (Europe)</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-gray-700 dark:text-gray-300">SuperFX Overclock</label>
                  <p className="text-sm text-gray-500">Improve performance in Star Fox, Yoshi&apos;s Island, etc.</p>
                </div>
                <input 
                  type="checkbox" 
                  className="w-5 h-5 rounded border-gray-300"
                  checked={platformSettings.snes.superfxOverclock}
                  onChange={(e) => updatePlatformSetting('snes', 'superfxOverclock', e.target.checked)}
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <SaveIndicator show={!!savedSections['snes']} message={savedSections['snes'] || ''} />
              <button
                onClick={() => savePlatformSettings('snes')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Save SNES Settings
              </button>
            </div>
          </div>
        )}

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <InformationCircleIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-blue-800 dark:text-blue-200">Supported Formats</h4>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                .sfc, .smc, .swc, .fig, .bs (BS-X Satellaview), .st, .zip, .7z
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full">
      {/* Sidebar Navigation */}
      <nav className="w-56 flex-shrink-0 pr-4 h-full overflow-y-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Platforms</h2>
          <ul className="space-y-1">
            {PLATFORM_SECTIONS.map((section) => (
              <li key={section.id}>
                <button
                  onClick={() => scrollToSection(section.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                    activeSection === section.id
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <span>{section.icon}</span>
                  <span>{section.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 h-full overflow-y-auto pl-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h1 className="text-4xl font-bold mb-8">Platform Settings</h1>

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

          {/* All sections in a single scrollable view */}
          <div className="space-y-8">
            {loadingSettings ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600 dark:text-gray-400">Loading platform settings...</span>
              </div>
            ) : (
              <>
                {renderRunnersSection()}
                {renderWineSection()}
                {renderNesSection()}
                {renderSnesSection()}
                {renderArcadeSection()}
                {renderC64Section()}
                {renderAmigaSection()}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
