'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import FileExplorer from './FileExplorer';
import type { InstallGameRequest, InstallGameResponse } from '@dillinger/shared';
import ShortcutSelectorDialog, { type ShortcutInfo } from './ShortcutSelectorDialog';

interface WineInstallWizardProps {
  gameId: string;
}

const STEP_LABELS = [
  'Compatibility Intelligence',
  'Installation Method',
  'Installer File',
  'Wine Configuration',
  'Install Directory',
  'Review & Install',
  'Install Monitor',
  'Post-Install Configuration',
];

type InstallMethod = 'lutris' | 'standard' | 'manual';

interface CompatibilitySourceResult {
  name: 'umu' | 'protonfixes' | 'lutris' | 'protondb' | 'pcgamingwiki';
  found: boolean;
  message: string;
  url?: string;
  data?: unknown;
}

interface CompatibilityLutrisInstaller {
  id: number;
  slug: string;
  version: string;
  runner: string;
  arch?: 'win32' | 'win64';
  winetricksCount: number;
  dllOverrideCount: number;
}

interface CompatibilityReport {
  game: {
    id: string;
    title: string;
    slug?: string;
    gogId?: number;
  };
  generatedAt: string;
  sources: CompatibilitySourceResult[];
  suggestions: {
    installMethod: InstallMethod;
    lutrisInstallers: CompatibilityLutrisInstaller[];
    suggestedLutrisInstallerId?: number;
    suggestedUmuGameId?: string;
    recommendedArch?: 'win32' | 'win64';
    suggestedExe?: string;
    winetricks: string[];
  };
}

type RecommendationCategory =
  | 'method'
  | 'umu'
  | 'arch'
  | 'winetricks'
  | 'dll'
  | 'env'
  | 'flag'
  | 'exe';

interface RecommendationItem {
  key: string;
  category: RecommendationCategory;
  label: string;
  detail?: string;
  value: string;
}

interface InstalledWineVersion {
  id: string;
  type: 'system' | 'wine-staging' | 'ge-proton';
  version: string;
  displayName: string;
  path: string;
  installedAt: string;
  usesUmu: boolean;
}

interface CachedInstaller {
  filename: string;
  path: string;
  size: number;
}

interface GameSummary {
  id: string;
  title: string;
  slug?: string;
  tags?: string[];
}

interface InstalledMount {
  name: string;
  mountPath: string;
}

interface InstallSpaceInfo {
  path: string;
  filesystem: string;
  mountedOn: string;
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  usePercent: string;
}

type MonitorRunnerStatus = 'unknown' | 'starting' | 'running' | 'stopped' | 'error';
type MonitorActivityStatus = 'idle' | 'active' | 'quiet';

interface InstallStatusResponse {
  success: boolean;
  status?: string;
  isRunning?: boolean;
  error?: string;
  executables?: string[];
}

export default function WineInstallWizard({ gameId }: WineInstallWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [installMethod, setInstallMethod] = useState<InstallMethod>('standard');
  const [selectedLutrisInstallerId, setSelectedLutrisInstallerId] = useState<number | null>(null);
  const [autoCheckCompatibility, setAutoCheckCompatibility] = useState<boolean | null>(null);
  const [compatibilityReport, setCompatibilityReport] = useState<CompatibilityReport | null>(null);
  const [compatibilityLoading, setCompatibilityLoading] = useState(false);
  const [compatibilityError, setCompatibilityError] = useState<string | null>(null);
  const [useCompatibilityRecommendations, setUseCompatibilityRecommendations] = useState(true);
  const [customizeCompatibilityFixes, setCustomizeCompatibilityFixes] = useState(false);
  const [selectedFixMap, setSelectedFixMap] = useState<Record<string, boolean>>({});
  const [gameSummary, setGameSummary] = useState<GameSummary | null>(null);
  const [cachedInstallers, setCachedInstallers] = useState<CachedInstaller[]>([]);
  const [selectedInstallerPath, setSelectedInstallerPath] = useState('');
  const [showInstallerBrowser, setShowInstallerBrowser] = useState(false);
  const [installerLoading, setInstallerLoading] = useState(false);
  const [installerError, setInstallerError] = useState<string | null>(null);
  const [installedWineVersions, setInstalledWineVersions] = useState<InstalledWineVersion[]>([]);
  const [defaultWineVersionId, setDefaultWineVersionId] = useState('system');
  const [wineVersionId, setWineVersionId] = useState('default');
  const [wineArch, setWineArch] = useState<'win32' | 'win64'>('win64');
  const [umuGameId, setUmuGameId] = useState('');
  const [installedMounts, setInstalledMounts] = useState<InstalledMount[]>([]);
  const [selectedInstallRoot, setSelectedInstallRoot] = useState('');
  const [installPath, setInstallPath] = useState('');
  const [showInstallDirBrowser, setShowInstallDirBrowser] = useState(false);
  const [installSpaceInfo, setInstallSpaceInfo] = useState<InstallSpaceInfo | null>(null);
  const [installSpaceLoading, setInstallSpaceLoading] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [installStartMessage, setInstallStartMessage] = useState<string | null>(null);
  const [installContainerName, setInstallContainerName] = useState<string | null>(null);
  const [monitorLogs, setMonitorLogs] = useState('');
  const [monitorRunnerStatus, setMonitorRunnerStatus] = useState<MonitorRunnerStatus>('unknown');
  const [monitorActivityStatus, setMonitorActivityStatus] = useState<MonitorActivityStatus>('idle');
  const [monitorError, setMonitorError] = useState<string | null>(null);
  const [monitorLastLogLength, setMonitorLastLogLength] = useState(0);
  const [monitorLastActivityTs, setMonitorLastActivityTs] = useState(Date.now());
  const [installResultStatus, setInstallResultStatus] = useState<string | null>(null);
  const [executableCandidates, setExecutableCandidates] = useState<string[]>([]);
  const [selectedExecutable, setSelectedExecutable] = useState('');
  const [executablesLoading, setExecutablesLoading] = useState(false);
  const [executablesError, setExecutablesError] = useState<string | null>(null);
  const [showShortcutSelector, setShowShortcutSelector] = useState(false);
  const [showExecutableBrowser, setShowExecutableBrowser] = useState(false);
  const [savingExecutable, setSavingExecutable] = useState(false);
  const [stepContentVisible, setStepContentVisible] = useState(true);
  const [stepDirection, setStepDirection] = useState<'forward' | 'backward'>('forward');
  const previousStepRef = useRef(1);
  const [compatibilityContentVisible, setCompatibilityContentVisible] = useState(false);

  const currentStepLabel = useMemo(() => STEP_LABELS[currentStep - 1], [currentStep]);

  useEffect(() => {
    const previousStep = previousStepRef.current;

    if (currentStep === previousStep) {
      return;
    }

    setStepDirection(currentStep > previousStep ? 'forward' : 'backward');
    setStepContentVisible(false);

    const showTimeout = window.setTimeout(() => {
      setStepContentVisible(true);
    }, 20);

    previousStepRef.current = currentStep;

    return () => {
      window.clearTimeout(showTimeout);
    };
  }, [currentStep]);

  useEffect(() => {
    if (compatibilityLoading || !compatibilityReport) {
      setCompatibilityContentVisible(false);
      return;
    }

    const revealTimeout = window.setTimeout(() => {
      setCompatibilityContentVisible(true);
    }, 40);

    return () => {
      window.clearTimeout(revealTimeout);
    };
  }, [compatibilityLoading, compatibilityReport]);

  const getCompatibilitySource = useCallback(
    (name: CompatibilitySourceResult['name']) =>
      compatibilityReport?.sources.find((source) => source.name === name),
    [compatibilityReport]
  );

  const recommendationItems = useMemo<RecommendationItem[]>(() => {
    if (!compatibilityReport) return [];

    const items: RecommendationItem[] = [];
    const suggestions = compatibilityReport.suggestions;

    if (suggestions.installMethod === 'lutris' && suggestions.lutrisInstallers.length > 0) {
      items.push({
        key: 'method:lutris',
        category: 'method',
        label: 'Use Lutris installer',
        detail: 'Prefer community-tested Lutris installation path',
        value: 'lutris',
      });
    }

    if (suggestions.suggestedUmuGameId) {
      items.push({
        key: `umu:${suggestions.suggestedUmuGameId}`,
        category: 'umu',
        label: 'UMU Game ID',
        detail: suggestions.suggestedUmuGameId,
        value: suggestions.suggestedUmuGameId,
      });
    }

    if (suggestions.recommendedArch) {
      items.push({
        key: `arch:${suggestions.recommendedArch}`,
        category: 'arch',
        label: 'Recommended architecture',
        detail: suggestions.recommendedArch,
        value: suggestions.recommendedArch,
      });
    }

    for (const verb of suggestions.winetricks || []) {
      items.push({
        key: `winetricks:${verb}`,
        category: 'winetricks',
        label: `Winetricks: ${verb}`,
        value: verb,
      });
    }

    if (suggestions.suggestedExe) {
      items.push({
        key: `exe:${suggestions.suggestedExe}`,
        category: 'exe',
        label: 'Suggested executable',
        detail: suggestions.suggestedExe,
        value: suggestions.suggestedExe,
      });
    }

    const protonfixData = getCompatibilitySource('protonfixes')?.data as
      | {
          dll_overrides?: Record<string, string>;
          env_vars?: Record<string, string>;
          flags?: string[];
        }
      | undefined;

    const lutrisData = getCompatibilitySource('lutris')?.data as
      | Array<{
          script?: { wine?: { overrides?: Record<string, string> } };
        }>
      | undefined;

    const mergedDll: Record<string, string> = {
      ...(protonfixData?.dll_overrides || {}),
      ...(lutrisData?.[0]?.script?.wine?.overrides || {}),
    };

    for (const [dll, mode] of Object.entries(mergedDll)) {
      items.push({
        key: `dll:${dll}`,
        category: 'dll',
        label: `DLL override: ${dll}`,
        detail: mode,
        value: mode,
      });
    }

    for (const [envKey, envValue] of Object.entries(protonfixData?.env_vars || {})) {
      items.push({
        key: `env:${envKey}`,
        category: 'env',
        label: `Environment: ${envKey}`,
        detail: envValue,
        value: envValue,
      });
    }

    for (const flag of protonfixData?.flags || []) {
      items.push({
        key: `flag:${flag}`,
        category: 'flag',
        label: `Flag: ${flag}`,
        value: flag,
      });
    }

    return items;
  }, [compatibilityReport, getCompatibilitySource]);

  const selectedWinetricks = useMemo(
    () => recommendationItems
      .filter((item) => item.category === 'winetricks' && selectedFixMap[item.key])
      .map((item) => item.value),
    [recommendationItems, selectedFixMap]
  );

  const selectedRecommendedArch = useMemo<'win32' | 'win64' | undefined>(() => {
    const archItem = recommendationItems.find(
      (item) => item.category === 'arch' && selectedFixMap[item.key]
    );
    const value = archItem?.value;
    return value === 'win32' || value === 'win64' ? value : undefined;
  }, [recommendationItems, selectedFixMap]);

  const selectedRecommendedUmu = useMemo(() => {
    const umuItem = recommendationItems.find(
      (item) => item.category === 'umu' && selectedFixMap[item.key]
    );
    return umuItem?.value;
  }, [recommendationItems, selectedFixMap]);

  const selectedSuggestedExe = useMemo(() => {
    const exeItem = recommendationItems.find(
      (item) => item.category === 'exe' && selectedFixMap[item.key]
    );
    return exeItem?.value;
  }, [recommendationItems, selectedFixMap]);

  const selectedRecommendedMethod = useMemo<InstallMethod | undefined>(() => {
    const methodItem = recommendationItems.find(
      (item) => item.category === 'method' && selectedFixMap[item.key]
    );
    const value = methodItem?.value;
    return value === 'lutris' || value === 'standard' || value === 'manual' ? value : undefined;
  }, [recommendationItems, selectedFixMap]);

  const selectedRecommendationsCount = useMemo(
    () => recommendationItems.filter((item) => selectedFixMap[item.key]).length,
    [recommendationItems, selectedFixMap]
  );

  const applyAllRecommendations = () => {
    const nextSelected: Record<string, boolean> = {};
    for (const item of recommendationItems) {
      nextSelected[item.key] = true;
    }
    setSelectedFixMap(nextSelected);
    setUseCompatibilityRecommendations(true);
    setCustomizeCompatibilityFixes(false);
    setCurrentStep(2);
  };

  const skipRecommendations = () => {
    setUseCompatibilityRecommendations(false);
    setCustomizeCompatibilityFixes(false);
    setCurrentStep(2);
  };

  const nextStep = () => setCurrentStep((prev) => Math.min(STEP_LABELS.length, prev + 1));
  const goToPreviousStep = () => setCurrentStep((prev) => Math.max(1, prev - 1));

  const fetchCompatibility = useCallback(async () => {
    try {
      setCompatibilityError(null);
      setCompatibilityLoading(true);

      const response = await fetch(`/api/compatibility/${gameId}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to load compatibility report');
      }

      const report = result.data as CompatibilityReport;
      setCompatibilityReport(report);
      setUseCompatibilityRecommendations(true);
      setCustomizeCompatibilityFixes(false);

      const nextSelected: Record<string, boolean> = {};

      if (report.suggestions.installMethod === 'lutris' && report.suggestions.lutrisInstallers.length > 0) {
        nextSelected['method:lutris'] = true;
      }
      if (report.suggestions.suggestedUmuGameId) {
        nextSelected[`umu:${report.suggestions.suggestedUmuGameId}`] = true;
      }
      if (report.suggestions.recommendedArch) {
        nextSelected[`arch:${report.suggestions.recommendedArch}`] = true;
      }
      for (const verb of report.suggestions.winetricks || []) {
        nextSelected[`winetricks:${verb}`] = true;
      }
      if (report.suggestions.suggestedExe) {
        nextSelected[`exe:${report.suggestions.suggestedExe}`] = true;
      }

      const protonfixData = report.sources.find((source) => source.name === 'protonfixes')?.data as
        | {
            dll_overrides?: Record<string, string>;
            env_vars?: Record<string, string>;
            flags?: string[];
          }
        | undefined;
      const lutrisData = report.sources.find((source) => source.name === 'lutris')?.data as
        | Array<{ script?: { wine?: { overrides?: Record<string, string> } } }>
        | undefined;

      const mergedDll: Record<string, string> = {
        ...(protonfixData?.dll_overrides || {}),
        ...(lutrisData?.[0]?.script?.wine?.overrides || {}),
      };
      for (const dllKey of Object.keys(mergedDll)) {
        nextSelected[`dll:${dllKey}`] = true;
      }
      for (const envKey of Object.keys(protonfixData?.env_vars || {})) {
        nextSelected[`env:${envKey}`] = true;
      }
      for (const flag of protonfixData?.flags || []) {
        nextSelected[`flag:${flag}`] = true;
      }

      setSelectedFixMap(nextSelected);

      if (report.suggestions.installMethod === 'lutris') {
        setInstallMethod('lutris');
      }

      if (typeof report.suggestions.suggestedLutrisInstallerId === 'number') {
        setSelectedLutrisInstallerId(report.suggestions.suggestedLutrisInstallerId);
      }
    } catch (error) {
      setCompatibilityError(error instanceof Error ? error.message : 'Failed to load compatibility report');
    } finally {
      setCompatibilityLoading(false);
    }
  }, [gameId]);

  const loadCompatibilityPreference = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/downloads');
      if (!response.ok) {
        setAutoCheckCompatibility(true);
        return;
      }
      const data = await response.json();
      setAutoCheckCompatibility(data?.settings?.autoCheckCompatibilityDatabases ?? true);
    } catch {
      setAutoCheckCompatibility(true);
    }
  }, []);

  const detectInstallerType = (filename: string): string => {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.msi')) return 'MSI Package';
    if (lower.includes('setup') && lower.endsWith('.exe')) return 'GOG Setup EXE';
    if (lower.includes('inno') || lower.includes('unins')) return 'Inno Setup';
    if (lower.endsWith('.exe')) return 'Windows EXE';
    if (lower.endsWith('.bin')) return 'Binary Payload';
    return 'Installer File';
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / 1024 ** index;
    return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
  };

  const formatBytes = (bytes: number): string => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / 1024 ** index;
    return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
  };

  const suggestInstallPath = (root: string, slugOrId?: string): string => {
    const safe = (slugOrId || gameId).replace(/[^a-zA-Z0-9._-]/g, '-');
    return `${root}/${safe}`;
  };

  const isLikelyNonGameExecutable = (candidate: string): boolean => {
    const lower = candidate.toLowerCase();
    const blocked = [
      'unins',
      'uninstall',
      'setup',
      'installer',
      'dxsetup',
      'vcredist',
      'redist',
      'support',
      'configtool',
      'crashreport',
    ];
    return blocked.some((token) => lower.includes(token));
  };

  const groupExecutablesByDirectory = (items: string[]): Record<string, string[]> => {
    return items.reduce<Record<string, string[]>>((acc, executable) => {
      const parts = executable.split('/');
      const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '.';
      if (!acc[dir]) acc[dir] = [];
      acc[dir].push(executable);
      return acc;
    }, {});
  };

  const fetchExecutableCandidates = useCallback(async () => {
    try {
      setExecutablesLoading(true);
      setExecutablesError(null);

      const statusResponse = await fetch(`/api/games/${gameId}/install/status`);
      const statusData = (await statusResponse.json()) as InstallStatusResponse;

      const candidates = Array.isArray(statusData.executables) ? statusData.executables : [];
      setExecutableCandidates(candidates);

      const suggestedExe = useCompatibilityRecommendations
        ? selectedSuggestedExe || compatibilityReport?.suggestions.suggestedExe
        : undefined;
      if (suggestedExe && candidates.includes(suggestedExe)) {
        setSelectedExecutable(suggestedExe);
      } else if (!selectedExecutable && candidates[0]) {
        const preferred = candidates.find((candidate) => !isLikelyNonGameExecutable(candidate));
        setSelectedExecutable(preferred || candidates[0] || '');
      }
    } catch (error) {
      setExecutablesError(error instanceof Error ? error.message : 'Failed to load executable candidates');
    } finally {
      setExecutablesLoading(false);
    }
  }, [
    gameId,
    compatibilityReport?.suggestions.suggestedExe,
    selectedExecutable,
    selectedSuggestedExe,
    useCompatibilityRecommendations,
  ]);

  const saveExecutableAndFinish = async () => {
    if (!selectedExecutable) {
      setExecutablesError('Select an executable before finishing.');
      return;
    }

    try {
      setSavingExecutable(true);
      setExecutablesError(null);

      const launchWorkingDir = selectedExecutable.includes('/')
        ? selectedExecutable.split('/').slice(0, -1).join('/')
        : '';

      const payload = {
        filePath: installPath ? `${installPath}/${selectedExecutable}` : undefined,
        settings: {
          launch: {
            command: selectedExecutable,
            workingDirectory: launchWorkingDir || installPath || '',
          },
        },
      };

      const response = await fetch(`/api/games/${gameId}/platforms/windows-wine`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to save executable selection');
      }

      window.location.href = `/games/${gameId}/edit`;
    } catch (error) {
      setExecutablesError(error instanceof Error ? error.message : 'Failed to save executable selection');
    } finally {
      setSavingExecutable(false);
    }
  };

  const fetchGameAndInstallers = async () => {
    try {
      setInstallerError(null);
      setInstallerLoading(true);

      const gameResponse = await fetch(`/api/games/${gameId}`);
      const gameResult = await gameResponse.json();
      if (!gameResponse.ok || !gameResult.success) {
        throw new Error(gameResult.error || 'Failed to load game details');
      }

      const game = gameResult.data as GameSummary;
      setGameSummary(game);

      const cacheResponse = await fetch(`/api/gog/cache/${gameId}/files`);
      const cacheResult = await cacheResponse.json();
      if (cacheResponse.ok && cacheResult.success) {
        const installers = (cacheResult.files || []) as CachedInstaller[];
        setCachedInstallers(installers);
        if (!selectedInstallerPath && installers[0]) {
          setSelectedInstallerPath(installers[0].path);
        }
      }
    } catch (error) {
      setInstallerError(error instanceof Error ? error.message : 'Failed to load installers');
    } finally {
      setInstallerLoading(false);
    }
  };

  const fetchWineVersions = async () => {
    try {
      const response = await fetch('/api/wine-versions');
      const result = await response.json();
      if (!response.ok) {
        return;
      }
      const installed = (result.installed || []) as InstalledWineVersion[];
      setInstalledWineVersions(installed);
      setDefaultWineVersionId(result.defaultId || 'system');
    } catch {
      // ignore, keep fallback defaults
    }
  };

  const fetchInstalledMounts = async () => {
    try {
      const response = await fetch('/api/volumes/detected');
      const result = await response.json();
      if (!response.ok || !result.success) return;

      const mounts = (result.data?.firstClassStatus?.installed?.mounts || []) as Array<{
        dockerVolumeName: string;
        mountPath: string;
      }>;

      const seenMountPaths = new Set<string>();
      const normalized = mounts.reduce<InstalledMount[]>((acc, mount) => {
        const mountPath = mount.mountPath?.trim();
        if (!mountPath || seenMountPaths.has(mountPath)) {
          return acc;
        }

        seenMountPaths.add(mountPath);
        acc.push({
          name: mount.dockerVolumeName,
          mountPath,
        });
        return acc;
      }, []);

      setInstalledMounts(normalized);

      if (!selectedInstallRoot && normalized[0]) {
        const root = normalized[0].mountPath;
        setSelectedInstallRoot(root);
        setInstallPath(suggestInstallPath(root, gameSummary?.slug || gameSummary?.id));
      }
    } catch {
      // ignore mount loading failures
    }
  };

  const fetchInstallSpace = async (targetPath: string) => {
    if (!targetPath) {
      setInstallSpaceInfo(null);
      return;
    }

    try {
      setInstallSpaceLoading(true);
      const response = await fetch(`/api/filesystem/space?path=${encodeURIComponent(targetPath)}`);
      const result = await response.json();
      if (response.ok && result.success) {
        setInstallSpaceInfo(result.data as InstallSpaceInfo);
      } else {
        setInstallSpaceInfo(null);
      }
    } catch {
      setInstallSpaceInfo(null);
    } finally {
      setInstallSpaceLoading(false);
    }
  };

  const cancelInstallation = async () => {
    try {
      await fetch(`/api/games/${gameId}/install`, { method: 'DELETE' });
      setMonitorRunnerStatus('stopped');
      setInstallResultStatus('cancelled');
      setMonitorError('Installation cancelled.');
    } catch (error) {
      setMonitorError(error instanceof Error ? error.message : 'Failed to cancel installation');
    }
  };

  const startInstallation = async () => {
    if (!selectedInstallerPath || !installPath) {
      setInstallError('Installer file and install path are required.');
      return;
    }

    try {
      setInstalling(true);
      setInstallError(null);
      setInstallStartMessage(null);
      setInstallContainerName(null);

      const selectedLutrisInstaller = compatibilityReport?.suggestions.lutrisInstallers.find(
        (installer) => installer.id === selectedLutrisInstallerId
      );
      const effectiveWineArch =
        installMethod === 'lutris' ? selectedLutrisInstaller?.arch || wineArch : wineArch;

      const payload: InstallGameRequest = {
        installerPath: selectedInstallerPath,
        installPath,
        platformId: 'windows-wine',
        debugMode,
        wineVersionId: wineVersionId === 'default' ? defaultWineVersionId : wineVersionId,
        wineArch: effectiveWineArch,
        installMethod,
        selectedLutrisInstallerId: installMethod === 'lutris' ? selectedLutrisInstallerId || undefined : undefined,
      };

      const response = await fetch(`/api/games/${gameId}/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as InstallGameResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to start installation');
      }

      setInstallStartMessage(result.message || 'Installation started. Proceed to monitor logs.');
      setInstallContainerName(result.containerName || null);
      setCurrentStep(7);
    } catch (error) {
      setInstallError(error instanceof Error ? error.message : 'Failed to start installation');
    } finally {
      setInstalling(false);
    }
  };

  useEffect(() => {
    void loadCompatibilityPreference();
  }, [loadCompatibilityPreference]);

  useEffect(() => {
    if (autoCheckCompatibility !== true) {
      return;
    }
    void fetchCompatibility();
  }, [autoCheckCompatibility, fetchCompatibility]);

  useEffect(() => {
    fetchGameAndInstallers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  useEffect(() => {
    fetchWineVersions();
  }, []);

  useEffect(() => {
    fetchInstalledMounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameSummary?.id]);

  useEffect(() => {
    if (!compatibilityReport || !useCompatibilityRecommendations) return;

    const archToApply = selectedRecommendedArch || compatibilityReport.suggestions.recommendedArch;
    if (archToApply) {
      setWineArch(archToApply);
    }

    const umuToApply = selectedRecommendedUmu || compatibilityReport.suggestions.suggestedUmuGameId;
    if (umuToApply && !umuGameId) {
      setUmuGameId(umuToApply);
    }
  }, [
    compatibilityReport,
    umuGameId,
    selectedRecommendedArch,
    selectedRecommendedUmu,
    useCompatibilityRecommendations,
  ]);

  useEffect(() => {
    if (!compatibilityReport || !useCompatibilityRecommendations) {
      return;
    }
    if (selectedRecommendedMethod) {
      setInstallMethod(selectedRecommendedMethod);
    }
  }, [compatibilityReport, selectedRecommendedMethod, useCompatibilityRecommendations]);

  useEffect(() => {
    if (currentStep === 5) {
      fetchInstallSpace(installPath || selectedInstallRoot);
    }
  }, [currentStep, installPath, selectedInstallRoot]);

  useEffect(() => {
    if (currentStep !== 7) return;

    const QUIET_THRESHOLD = 30000;

    const poll = async () => {
      try {
        const logsResponse = await fetch(`/api/games/${gameId}/container-logs?type=install&tail=300`);
        const logsData = await logsResponse.json();

        if (logsResponse.ok && logsData.success && typeof logsData.logs === 'string') {
          const nextLogs = logsData.logs;
          setMonitorLogs(nextLogs);
          setMonitorRunnerStatus('running');
          setMonitorError(null);

          if (nextLogs.length !== monitorLastLogLength) {
            setMonitorActivityStatus('active');
            setMonitorLastActivityTs(Date.now());
            setMonitorLastLogLength(nextLogs.length);
          }
        } else if (logsData?.error?.includes('No container found')) {
          setMonitorRunnerStatus((prev) => (prev === 'running' ? 'stopped' : 'starting'));
        }

        const statusResponse = await fetch(`/api/games/${gameId}/install/status`);
        const statusData = (await statusResponse.json()) as InstallStatusResponse;

        if (statusResponse.ok && statusData.success) {
          const status = statusData.status || 'unknown';
          const isRunning = Boolean(statusData.isRunning);

          if (isRunning) {
            setMonitorRunnerStatus('running');
          } else if (status === 'installing') {
            setMonitorRunnerStatus('starting');
          } else {
            setMonitorRunnerStatus('stopped');
            setInstallResultStatus(status);
            if (Array.isArray(statusData.executables)) {
              setExecutableCandidates(statusData.executables);
              if (statusData.executables[0] && !selectedExecutable) {
                const preferred = statusData.executables.find((candidate) => !isLikelyNonGameExecutable(candidate));
                setSelectedExecutable(preferred || statusData.executables[0]);
              }
            }
            setCurrentStep(8);
          }
        }

        const inactivityMs = Date.now() - monitorLastActivityTs;
        if (inactivityMs > QUIET_THRESHOLD && monitorActivityStatus === 'active') {
          setMonitorActivityStatus('quiet');
        } else if (monitorLogs.length === 0 && monitorActivityStatus === 'idle') {
          setMonitorActivityStatus('idle');
        }
      } catch (error) {
        setMonitorError(error instanceof Error ? error.message : 'Failed to poll install monitor');
        setMonitorRunnerStatus('error');
      }
    };

    void poll();
    const interval = window.setInterval(poll, 2000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, gameId, monitorLastLogLength, monitorLastActivityTs, monitorActivityStatus, monitorLogs.length]);

  useEffect(() => {
    if (currentStep === 8) {
      void fetchExecutableCandidates();
    }
  }, [currentStep, fetchExecutableCandidates]);

  const renderStepContent = () => {
    if (currentStep === 1) {
      const umuSource = getCompatibilitySource('umu');
      const protonfixesSource = getCompatibilitySource('protonfixes');
      const lutrisSource = getCompatibilitySource('lutris');
      const protondbSource = getCompatibilitySource('protondb');
      const pcgwSource = getCompatibilitySource('pcgamingwiki');

      const protonfixData = (protonfixesSource?.data || {}) as {
        has_complex_logic?: boolean;
        notes?: string;
        dll_overrides?: Record<string, string>;
        env_vars?: Record<string, string>;
      };

      const protondbData = (protondbSource?.data || {}) as {
        tier?: string;
        confidence?: string;
        total?: number;
      };

      const pcgwRows = ((pcgwSource?.data as { rows?: Array<Record<string, string>> } | undefined)?.rows || []);
      const pcgwEntry = pcgwRows[0] || {};
      const pcgwApi = pcgwEntry.API || '';
      const pcgwDrm = pcgwEntry.DRM || pcgwEntry.Drm || '';
      const pcgwAnticheat = pcgwEntry.AntiCheat || pcgwEntry.Anti_cheat || pcgwEntry.Anticheat || pcgwEntry.anti_cheat || '';

      const selectedLutrisInstaller = compatibilityReport?.suggestions.lutrisInstallers.find(
        (installer) => installer.id === selectedLutrisInstallerId
      );

      const tierBadgeClass =
        protondbData.tier === 'native' || protondbData.tier === 'platinum'
          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200'
          : protondbData.tier === 'gold' || protondbData.tier === 'silver'
            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200'
            : protondbData.tier === 'bronze'
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-200'
              : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200';

      return (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-text">Step 1: Compatibility Intelligence</h2>
          <p className="text-sm text-muted">Checking community databases for known fixes and installer recommendations.</p>
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-100">
            This report is used to pre-fill install options. You can continue without applying any recommendation.
          </div>

          {autoCheckCompatibility === false && !compatibilityReport && !compatibilityLoading && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100">
              Auto-check is disabled in Settings. Click <strong>Check Compatibility</strong> to run this step manually.
            </div>
          )}

          {compatibilityLoading && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="animate-pulse rounded-md border border-gray-200 p-4 dark:border-gray-700">
                  <div className="h-4 w-1/3 rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="mt-3 h-3 w-5/6 rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="mt-2 h-3 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="mt-4 h-3 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
                </div>
              ))}
            </div>
          )}

          {compatibilityError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200">
              {compatibilityError}
            </div>
          )}

          {compatibilityReport && (
            <div
              className={`space-y-3 transition-opacity duration-300 ease-out ${
                compatibilityContentVisible ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <div className="text-xs text-muted">
                For: <span className="font-medium text-text">{compatibilityReport.game.title}</span>
                {compatibilityReport.game.gogId ? ` • GOG ID ${compatibilityReport.game.gogId}` : ' • No GOG ID detected'}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div
                  className={`rounded-md border p-4 ${
                    (umuSource?.found || protonfixesSource?.found)
                      ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                      : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-text">UMU + Protonfixes</div>
                    <span className="text-[11px] text-muted">{(umuSource?.found || protonfixesSource?.found) ? 'Found' : 'No match'}</span>
                  </div>
                  <div className="mt-2 text-xs text-muted">UMU Game ID: {compatibilityReport.suggestions.suggestedUmuGameId || '(none)'}</div>
                  <div className="mt-2 text-xs text-muted">Winetricks: {compatibilityReport.suggestions.winetricks.length}</div>
                  <div className="mt-1 text-xs text-muted">
                    DLL overrides: {Object.keys(protonfixData.dll_overrides || {}).length} • Env vars: {Object.keys(protonfixData.env_vars || {}).length}
                  </div>
                  {protonfixData.has_complex_logic && (
                    <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
                      Complex script logic detected. Validate behavior manually.
                      {protonfixData.notes ? ` ${protonfixData.notes}` : ''}
                    </div>
                  )}
                  {protonfixesSource?.url && (
                    <a
                      href={protonfixesSource.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs text-blue-700 underline dark:text-blue-300"
                    >
                      View protonfix script
                    </a>
                  )}
                </div>

                <div
                  className={`rounded-md border p-4 ${
                    lutrisSource?.found
                      ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                      : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-text">Lutris</div>
                    <span className="text-[11px] text-muted">{compatibilityReport.suggestions.lutrisInstallers.length} installers</span>
                  </div>
                  <div className="mt-2 text-xs text-muted">Best match: {selectedLutrisInstaller ? selectedLutrisInstaller.version : 'none selected'}</div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {compatibilityReport.suggestions.lutrisInstallers.slice(0, 3).map((installer) => (
                      <span
                        key={installer.id}
                        className="rounded-full border border-gray-300 px-2 py-0.5 text-[11px] text-muted dark:border-gray-600"
                      >
                        {installer.arch || 'auto'} • {installer.winetricksCount} wt • {installer.dllOverrideCount} dll
                      </span>
                    ))}
                    {compatibilityReport.suggestions.lutrisInstallers.length === 0 && (
                      <span className="text-xs text-muted">No Lutris installers available.</span>
                    )}
                  </div>
                  {lutrisSource?.url && (
                    <a
                      href={lutrisSource.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs text-blue-700 underline dark:text-blue-300"
                    >
                      Open Lutris search results
                    </a>
                  )}
                </div>

                <div
                  className={`rounded-md border p-4 ${
                    protondbSource?.found
                      ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                      : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-text">ProtonDB</div>
                    {protondbData.tier && (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tierBadgeClass}`}>
                        {protondbData.tier}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-xs text-muted">Confidence: {protondbData.confidence || 'n/a'}</div>
                  <div className="mt-1 text-xs text-muted">Reports: {typeof protondbData.total === 'number' ? protondbData.total : 'n/a'}</div>
                  <div className="mt-1 text-xs text-muted">
                    Tier guide: Native/Platinum = best compatibility, Gold/Silver = playable with tweaks, Bronze/Borked = significant issues expected.
                  </div>
                  {protondbSource?.url && (
                    <a
                      href={protondbSource.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs text-blue-700 underline dark:text-blue-300"
                    >
                      Open ProtonDB
                    </a>
                  )}
                </div>

                <div
                  className={`rounded-md border p-4 ${
                    pcgwSource?.found
                      ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                      : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/20'
                  }`}
                >
                  <div className="text-sm font-semibold text-text">PCGamingWiki</div>
                  <div className="mt-2 text-xs text-muted">DirectX/API: {pcgwApi || 'n/a'}</div>
                  {(pcgwDrm || pcgwAnticheat) ? (
                    <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
                      {pcgwDrm && <div>DRM: {pcgwDrm}</div>}
                      {pcgwAnticheat && <div>Anti-cheat: {pcgwAnticheat}</div>}
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-muted">No DRM/anti-cheat warnings reported.</div>
                  )}
                  {pcgwSource?.url && (
                    <a
                      href={pcgwSource.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs text-blue-700 underline dark:text-blue-300"
                    >
                      Open PCGamingWiki query
                    </a>
                  )}
                </div>
              </div>

              <div className="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-text">Merged Fixes Summary</div>
                  <div className="text-xs text-muted">{selectedRecommendationsCount} / {recommendationItems.length} selected</div>
                </div>
                <div className="mt-2 text-xs text-muted">
                  Method: {selectedRecommendedMethod || installMethod} • Arch: {selectedRecommendedArch || compatibilityReport.suggestions.recommendedArch || 'n/a'} • UMU: {selectedRecommendedUmu || compatibilityReport.suggestions.suggestedUmuGameId || 'n/a'}
                </div>
                <div className="mt-1 text-xs text-muted">Winetricks selected: {selectedWinetricks.length}</div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUseCompatibilityRecommendations(true);
                      setCustomizeCompatibilityFixes(false);
                    }}
                    className={`rounded-md border px-3 py-1.5 text-xs ${
                      useCompatibilityRecommendations && !customizeCompatibilityFixes
                        ? 'border-blue-500 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-200'
                        : 'border-gray-300 text-text dark:border-gray-600'
                    }`}
                  >
                    Apply All Recommendations
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUseCompatibilityRecommendations(true);
                      setCustomizeCompatibilityFixes(true);
                    }}
                    className={`rounded-md border px-3 py-1.5 text-xs ${
                      useCompatibilityRecommendations && customizeCompatibilityFixes
                        ? 'border-blue-500 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-200'
                        : 'border-gray-300 text-text dark:border-gray-600'
                    }`}
                  >
                    Customize
                  </button>
                </div>

                {useCompatibilityRecommendations && customizeCompatibilityFixes && (
                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                    {recommendationItems.map((item) => (
                      <label
                        key={item.key}
                        className="flex items-start gap-2 rounded border border-gray-200 bg-white px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-800"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(selectedFixMap[item.key])}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setSelectedFixMap((prev) => ({ ...prev, [item.key]: checked }));
                          }}
                          className="mt-0.5 h-4 w-4"
                        />
                        <span>
                          <span className="font-medium text-text">{item.label}</span>
                          {item.detail && <span className="ml-1 text-muted">({item.detail})</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchCompatibility}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-text hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                >
                  Re-check Compatibility
                </button>
                <button
                  type="button"
                  onClick={applyAllRecommendations}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white"
                >
                  Apply & Continue
                </button>
                <button
                  type="button"
                  onClick={skipRecommendations}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-text hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                >
                  Skip
                </button>
              </div>
            </div>
          )}

          {!compatibilityReport && !compatibilityLoading && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchCompatibility}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-text hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                Check Compatibility
              </button>
              <button
                type="button"
                onClick={skipRecommendations}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-text hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                Skip
              </button>
            </div>
          )}
        </div>
      );
    }

    if (currentStep === 6) {
      const selectedLutrisInstaller = compatibilityReport?.suggestions.lutrisInstallers.find(
        (installer) => installer.id === selectedLutrisInstallerId
      );

      return (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-text">Step 6: Review & Install</h2>
          <p className="text-sm text-muted">
            Review your selections and start installation. Debug mode keeps the container running after installation for troubleshooting.
          </p>

          {installError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200">
              {installError}
            </div>
          )}

          {installStartMessage && (
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-700 dark:bg-green-900/20 dark:text-green-200">
              {installStartMessage}
            </div>
          )}

          <div className="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
            <div className="text-sm font-semibold text-text">Install Summary</div>
            <div className="mt-3 space-y-2 text-xs text-muted">
              <div>
                Method: <span className="font-medium text-text">{installMethod}</span>
              </div>
              {selectedLutrisInstaller && (
                <div>
                  Lutris Installer: <span className="font-medium text-text">{selectedLutrisInstaller.version}</span>
                </div>
              )}
              <div>
                Installer File: <span className="font-medium break-all text-text">{selectedInstallerPath || '(not selected)'}</span>
              </div>
              <div>
                Install Path: <span className="font-medium break-all text-text">{installPath || '(not selected)'}</span>
              </div>
              <div>
                Wine Version: <span className="font-medium text-text">{wineVersionId === 'default' ? `default (${defaultWineVersionId})` : wineVersionId}</span>
              </div>
              <div>
                Architecture: <span className="font-medium text-text">{wineArch}</span>
              </div>
              <div>
                UMU Game ID: <span className="font-medium text-text">{umuGameId || '(none)'}</span>
              </div>
              <div>
                Compatibility Recommendations:{' '}
                <span className="font-medium text-text">
                  {useCompatibilityRecommendations ? (customizeCompatibilityFixes ? 'customized' : 'apply all') : 'skipped'}
                </span>
              </div>
              {useCompatibilityRecommendations && (
                <div>
                  Selected Fixes: <span className="font-medium text-text">{selectedRecommendationsCount}</span>
                </div>
              )}
              {useCompatibilityRecommendations && selectedWinetricks.length > 0 && (
                <div>
                  Winetricks: <span className="font-medium text-text">{selectedWinetricks.join(', ')}</span>
                </div>
              )}
              {installContainerName && (
                <div>
                  Container: <span className="font-medium text-text">{installContainerName}</span>
                </div>
              )}
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-md border border-gray-200 p-3 dark:border-gray-700">
            <input
              type="checkbox"
              checked={debugMode}
              onChange={(event) => setDebugMode(event.target.checked)}
              className="mt-1 h-4 w-4"
            />
            <div>
              <div className="text-sm font-medium text-text">Debug Mode</div>
              <div className="text-xs text-muted">
                Keeps the install container available after completion so you can inspect logs and files if install fails.
              </div>
            </div>
          </label>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={startInstallation}
              disabled={installing || !selectedInstallerPath || !installPath}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {installing ? 'Starting Install…' : 'Install'}
            </button>
          </div>
        </div>
      );
    }

    if (currentStep === 7) {
      const runnerIndicator =
        monitorRunnerStatus === 'running'
          ? 'bg-green-500'
          : monitorRunnerStatus === 'starting'
            ? 'bg-yellow-500'
            : monitorRunnerStatus === 'error'
              ? 'bg-red-500'
              : 'bg-gray-500';

      return (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-text">Step 7: Installation Monitor</h2>
          <p className="text-sm text-muted">Live monitor for installation progress and container activity.</p>

          {monitorError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200">
              {monitorError}
            </div>
          )}

          <div className="rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/30">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-text">
                <span className={`h-2.5 w-2.5 rounded-full ${runnerIndicator}`} />
                Runner: {monitorRunnerStatus}
              </div>
              <div className="text-sm text-muted">Activity: {monitorActivityStatus}</div>
              <div className="text-xs text-muted">Container: {installContainerName || 'install session'}</div>
            </div>
          </div>

          <div className="rounded-md border border-gray-200 dark:border-gray-700">
            <div className="border-b border-gray-200 bg-gray-100 px-3 py-2 text-xs text-muted dark:border-gray-700 dark:bg-gray-800">
              Runner Logs
            </div>
            <div className="max-h-80 overflow-auto bg-black p-3 text-xs text-green-400">
              {monitorLogs ? <pre className="whitespace-pre-wrap">{monitorLogs}</pre> : 'Waiting for logs...'}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs text-muted">Auto-advances to Step 8 when installation completes.</div>
            <button
              type="button"
              onClick={cancelInstallation}
              className="rounded-md border border-red-300 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20"
            >
              Cancel Installation
            </button>
          </div>
        </div>
      );
    }

    if (currentStep === 8) {
      const grouped = groupExecutablesByDirectory(executableCandidates);
      const suggestedExe = compatibilityReport?.suggestions.suggestedExe;

      return (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-text">Step 8: Post-Install Configuration</h2>
          <p className="text-sm text-muted">Installation finished with status: {installResultStatus || 'unknown'}.</p>

          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-100">
            Select the main game executable. Avoid files named setup/uninstall/redist when possible.
          </div>

          {executablesError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200">
              {executablesError}
            </div>
          )}

          {executablesLoading ? (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-muted dark:border-gray-700 dark:bg-gray-900/30">
              Scanning executables...
            </div>
          ) : (
            <div className="space-y-4">
              {Object.keys(grouped).length === 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                  No executable candidates were auto-detected. Use Shortcut Finder or Browse Install Folder.
                </div>
              )}

              {Object.entries(grouped).map(([directory, items]) => (
                <div key={directory} className="rounded-md border border-gray-200 p-3 dark:border-gray-700">
                  <div className="mb-2 text-xs font-semibold text-muted">{directory}</div>
                  <div className="space-y-2">
                    {items.map((candidate) => {
                      const selected = selectedExecutable === candidate;
                      const likelyBad = isLikelyNonGameExecutable(candidate);
                      const suggested = suggestedExe && suggestedExe === candidate;

                      return (
                        <button
                          key={candidate}
                          type="button"
                          onClick={() => setSelectedExecutable(candidate)}
                          className={`w-full rounded-md border p-2 text-left ${
                            selected
                              ? 'border-blue-500 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
                              : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm text-text">{candidate.split('/').pop()}</div>
                            <div className="flex gap-1">
                              {suggested && (
                                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] text-green-800 dark:bg-green-900/20 dark:text-green-200">
                                  Suggested
                                </span>
                              )}
                              {likelyBad && (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                                  Probably not game
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="mt-1 text-xs text-muted">{candidate}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowShortcutSelector(true)}
              className="rounded-md border border-gray-300 px-3 py-2 text-xs text-text hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              Shortcut Finder
            </button>
            <button
              type="button"
              onClick={() => setShowExecutableBrowser(true)}
              className="rounded-md border border-gray-300 px-3 py-2 text-xs text-text hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              Browse Install Folder
            </button>
            <button
              type="button"
              onClick={saveExecutableAndFinish}
              disabled={savingExecutable || !selectedExecutable}
              className="rounded-md bg-blue-600 px-3 py-2 text-xs text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {savingExecutable ? 'Saving…' : 'Done'}
            </button>
          </div>
        </div>
      );
    }

    if (currentStep === 2) {
      const hasLutrisInstallers = (compatibilityReport?.suggestions.lutrisInstallers.length || 0) > 0;

      return (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-text">Step 2: Choose Installation Method</h2>
          <p className="text-sm text-muted">
            Choose how Dillinger should install this game. Lutris is usually best when an installer is available.
          </p>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              {
                id: 'lutris' as const,
                title: 'Lutris Installer',
                description: 'Community-tested scripts with common fixes, dependencies, and launch setup.',
              },
              {
                id: 'standard' as const,
                title: 'Standard Installer',
                description: 'Run your installer directly and configure Wine settings manually afterward.',
              },
              {
                id: 'manual' as const,
                title: 'Manual (Advanced)',
                description: 'Use custom commands and environment setup for edge cases and custom workflows.',
              },
            ].map((method) => {
              const selected = installMethod === method.id;
              const disabled = method.id === 'lutris' && !hasLutrisInstallers;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setInstallMethod(method.id)}
                  disabled={disabled}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    disabled
                      ? 'cursor-not-allowed opacity-50 border-gray-200 dark:border-gray-700'
                      : ''
                  } ${
                    selected
                      ? 'border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-900/20'
                      : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-text">{method.title}</div>
                    {selected && <span className="text-xs text-blue-600 dark:text-blue-300">Selected</span>}
                  </div>
                  <p className="mt-2 text-xs text-muted">{method.description}</p>
                  {disabled && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">No Lutris installer found</p>}
                </button>
              );
            })}
          </div>

          {installMethod === 'lutris' && hasLutrisInstallers && compatibilityReport && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
              <div className="text-sm font-semibold text-text">Available Lutris Installers</div>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                {compatibilityReport.suggestions.lutrisInstallers.map((installer) => {
                  const selectedInstaller = selectedLutrisInstallerId === installer.id;
                  return (
                    <button
                      key={installer.id}
                      type="button"
                      onClick={() => {
                        setSelectedLutrisInstallerId(installer.id);
                        if (installer.arch === 'win32' || installer.arch === 'win64') {
                          setWineArch(installer.arch);
                        }
                      }}
                      className={`rounded-md border p-3 text-left ${
                        selectedInstaller
                          ? 'border-blue-500 bg-white dark:bg-blue-950/30'
                          : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium text-text">{installer.version}</div>
                        {selectedInstaller && <span className="text-xs text-blue-600 dark:text-blue-300">Selected</span>}
                      </div>
                      <div className="mt-1 text-xs text-muted">{installer.slug}</div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {installer.arch && (
                          <span className="rounded-full border border-gray-300 px-2 py-0.5 text-[11px] text-muted dark:border-gray-600">
                            {installer.arch}
                          </span>
                        )}
                        <span className="rounded-full border border-gray-300 px-2 py-0.5 text-[11px] text-muted dark:border-gray-600">
                          {installer.winetricksCount} winetricks
                        </span>
                        <span className="rounded-full border border-gray-300 px-2 py-0.5 text-[11px] text-muted dark:border-gray-600">
                          {installer.dllOverrideCount} DLL overrides
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (currentStep === 3) {
      return (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-text">Step 3: Select Installer File</h2>
          <p className="text-sm text-muted">
            Select the Windows installer (.exe, .msi) you downloaded. GOG installers from your cache are shown automatically.
          </p>

          {installerLoading && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-muted dark:border-gray-700 dark:bg-gray-900/30">
              Loading available installer files…
            </div>
          )}

          {installerError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-200">
              {installerError}
            </div>
          )}

          {gameSummary?.tags?.includes('gog') && cachedInstallers.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-text">Detected GOG Cache Installers</div>
              {cachedInstallers.map((installer) => {
                const selected = selectedInstallerPath === installer.path;
                return (
                  <button
                    key={installer.path}
                    type="button"
                    onClick={() => setSelectedInstallerPath(installer.path)}
                    className={`w-full rounded-md border p-3 text-left ${
                      selected
                        ? 'border-blue-500 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
                        : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium text-text">{installer.filename}</div>
                      {selected && <span className="text-xs text-blue-600 dark:text-blue-300">Selected</span>}
                    </div>
                    <div className="mt-1 text-xs text-muted">{installer.path}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted">
                      <span className="rounded-full border border-gray-300 px-2 py-0.5 dark:border-gray-600">
                        {formatFileSize(installer.size)}
                      </span>
                      <span className="rounded-full border border-gray-300 px-2 py-0.5 dark:border-gray-600">
                        {detectInstallerType(installer.filename)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="rounded-md border border-gray-200 p-3 dark:border-gray-700">
            <div className="text-sm font-medium text-text">Browse Manually</div>
            <p className="mt-1 text-xs text-muted">
              Use this when the installer is not in cache or you want to select a different file.
            </p>
            <button
              type="button"
              onClick={() => setShowInstallerBrowser(true)}
              className="mt-2 rounded-md border border-gray-300 px-3 py-1.5 text-xs text-text hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              Browse Installer Files
            </button>
          </div>

          {selectedInstallerPath && (
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-xs text-green-900 dark:border-green-800 dark:bg-green-900/20 dark:text-green-100">
              Selected installer: {selectedInstallerPath}
            </div>
          )}
        </div>
      );
    }

    if (currentStep === 4) {
      const effectiveSelectedWineVersionId = wineVersionId === 'default' ? defaultWineVersionId : wineVersionId;
      const selectedWineVersion = installedWineVersions.find((version) => version.id === effectiveSelectedWineVersionId);
      const selectedUsesUmu = Boolean(selectedWineVersion?.usesUmu);

      return (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-text">Step 4: Wine Configuration</h2>
          <p className="text-sm text-muted">
            GE-Proton includes community patches (protonfixes) that automatically fix known game issues. The UMU Game ID links your game to these fixes.
          </p>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted">Wine Version</label>
            <select
              value={wineVersionId}
              onChange={(event) => setWineVersionId(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
            >
              <option value="default">
                Use Default ({installedWineVersions.find((version) => version.id === defaultWineVersionId)?.displayName || 'System Wine'})
              </option>
              {installedWineVersions.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.displayName}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted">
              GE-Proton includes community fixes. System Wine is simpler but may have fewer game patches.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted">Architecture</label>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {(['win64', 'win32'] as const).map((arch) => {
                const selected = wineArch === arch;
                return (
                  <button
                    key={arch}
                    type="button"
                    onClick={() => setWineArch(arch)}
                    className={`rounded-md border p-3 text-left ${
                      selected
                        ? 'border-blue-500 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
                        : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="text-sm font-medium text-text">{arch === 'win64' ? '64-bit (win64)' : '32-bit (win32)'}</div>
                    <div className="mt-1 text-xs text-muted">
                      {arch === 'win64' ? 'Recommended for most modern games.' : 'Used by some older titles.'}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-muted">
              Most modern games use 64-bit. Some older games (pre-2010) require 32-bit.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted">UMU Game ID</label>
            <input
              type="text"
              value={umuGameId}
              onChange={(event) => setUmuGameId(event.target.value)}
              placeholder={compatibilityReport?.suggestions.suggestedUmuGameId || 'umu-your-game-id'}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
              disabled={!selectedUsesUmu}
            />
            <p className="mt-1 text-xs text-muted">
              Links your game to protonfixes. {selectedUsesUmu ? 'This Wine version supports UMU.' : 'Select a UMU-capable Wine version (e.g., GE-Proton) to use UMU Game ID.'}
            </p>
          </div>
        </div>
      );
    }

    if (currentStep === 5) {
      return (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-text">Step 5: Install Directory</h2>
          <p className="text-sm text-muted">
            Each game gets its own Wine prefix (a virtual Windows environment). Choose a Docker volume with enough space.
          </p>

          <div>
            <label className="mb-2 block text-sm font-medium text-muted">Volume Quick Select</label>
            <div className="flex flex-wrap gap-2">
              {installedMounts.length === 0 && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                  No /installed mount detected. Use custom path browser.
                </div>
              )}

              {installedMounts.map((mount) => {
                const selected = selectedInstallRoot === mount.mountPath;
                return (
                  <button
                    key={mount.mountPath}
                    type="button"
                    onClick={() => {
                      setSelectedInstallRoot(mount.mountPath);
                      setInstallPath(suggestInstallPath(mount.mountPath, gameSummary?.slug || gameSummary?.id));
                    }}
                    className={`rounded-md border px-3 py-2 text-xs ${
                      selected
                        ? 'border-blue-500 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-200'
                        : 'border-gray-300 text-text hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700'
                    }`}
                  >
                    {mount.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted">Install Path</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={installPath}
                onChange={(event) => setInstallPath(event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                placeholder="/installed/default/my-game"
              />
              <button
                type="button"
                onClick={() => setShowInstallDirBrowser(true)}
                className="rounded-md border border-gray-300 px-3 py-2 text-xs text-text hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                Browse
              </button>
            </div>
            <p className="mt-1 text-xs text-muted">Choose a target prefix directory for installation files and Wine prefix data.</p>
          </div>

          <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-muted dark:border-gray-700 dark:bg-gray-900/30">
            <div className="font-medium text-text">Estimated Space</div>
            {installSpaceLoading && <div className="mt-1">Checking available space…</div>}
            {!installSpaceLoading && installSpaceInfo && (
              <div className="mt-1 space-y-1">
                <div>Filesystem: {installSpaceInfo.filesystem}</div>
                <div>Mount: {installSpaceInfo.mountedOn}</div>
                <div>Available: {formatBytes(installSpaceInfo.availableBytes)} / {formatBytes(installSpaceInfo.totalBytes)}</div>
              </div>
            )}
            {!installSpaceLoading && !installSpaceInfo && (
              <div className="mt-1">Space estimate unavailable for this path.</div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-text">
          Step {currentStep}: {currentStepLabel}
        </h2>
        <p className="text-sm text-muted">
          This step is scaffolded and will be wired in upcoming implementation chunks.
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-text">Wine Installation Wizard</h1>
            <p className="mt-1 text-sm text-muted">
              Guided setup for installer selection, Wine configuration, and post-install executable selection.
            </p>
          </div>
          <Link
            href={`/games/${gameId}/edit`}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-text hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            Back to Edit Game
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <ol className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {STEP_LABELS.map((label, index) => (
            <li
              key={label}
              className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm dark:border-gray-700 ${
                index + 1 === currentStep
                  ? 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-100'
                  : 'border-gray-200 text-muted'
              }`}
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                {index + 1}
              </span>
              <span>{label}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div
          className={`transition-all duration-300 ease-out ${
            stepContentVisible
              ? 'opacity-100 translate-x-0'
              : stepDirection === 'forward'
                ? 'opacity-0 translate-x-3'
                : 'opacity-0 -translate-x-3'
          }`}
        >
          {renderStepContent()}
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-700">
          <button
            type="button"
            onClick={goToPreviousStep}
            disabled={currentStep === 1}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-text disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600"
          >
            Back
          </button>
          <button
            type="button"
            onClick={nextStep}
            disabled={
              currentStep === STEP_LABELS.length ||
              (currentStep === 3 && !selectedInstallerPath) ||
              (currentStep === 5 && !installPath.trim()) ||
              currentStep === 6 ||
              currentStep === 7
            }
            className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {showInstallerBrowser && (
        <FileExplorer
          isOpen
          onClose={() => setShowInstallerBrowser(false)}
          onSelect={(path) => {
            setSelectedInstallerPath(path);
            setShowInstallerBrowser(false);
          }}
          title="Select Installer File"
          selectMode="file"
          showVolumes
          initialPath="/cache"
        />
      )}

      {showInstallDirBrowser && (
        <FileExplorer
          isOpen
          onClose={() => setShowInstallDirBrowser(false)}
          onSelect={(path) => {
            setInstallPath(path);
            setShowInstallDirBrowser(false);
          }}
          title="Select Installation Directory"
          selectMode="directory"
          showVolumes
          initialPath={selectedInstallRoot || '/installed'}
        />
      )}

      {showExecutableBrowser && (
        <FileExplorer
          isOpen
          onClose={() => setShowExecutableBrowser(false)}
          onSelect={(path) => {
            const relative = installPath && path.startsWith(`${installPath}/`)
              ? path.substring(`${installPath}/`.length)
              : path.split('/').pop() || path;
            setSelectedExecutable(relative);
            if (!executableCandidates.includes(relative)) {
              setExecutableCandidates((prev) => [...prev, relative]);
            }
            setShowExecutableBrowser(false);
          }}
          title="Select Game Executable"
          selectMode="file"
          showVolumes
          initialPath={installPath || '/installed'}
        />
      )}

      {showShortcutSelector && installPath && (
        <ShortcutSelectorDialog
          gameId={gameId}
          installPath={installPath}
          isOpen={showShortcutSelector}
          onClose={() => setShowShortcutSelector(false)}
          onSelectShortcut={(shortcut: ShortcutInfo) => {
            const candidate = shortcut.target?.replace(/^.*?drive_c\//i, 'drive_c/').replace(/\\/g, '/') || shortcut.path;
            setSelectedExecutable(candidate);
            if (!executableCandidates.includes(candidate)) {
              setExecutableCandidates((prev) => [...prev, candidate]);
            }
            setShowShortcutSelector(false);
          }}
          onBrowseManually={() => {
            setShowShortcutSelector(false);
            setShowExecutableBrowser(true);
          }}
        />
      )}
    </div>
  );
}
