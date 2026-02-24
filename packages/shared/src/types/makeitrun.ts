export type MakeItRunImportSource = 'manual' | 'compatibility' | 'lutris' | 'protonfixes';

export interface ProtonfixEntry {
  title: string;
  stores: string[];
  gog_ids: string[];
  winetricks: string[];
  dll_overrides: Record<string, string>;
  env_vars: Record<string, string>;
  del_env_vars: string[];
  command_replacements: Array<{ from: string; to: string }>;
  registry: Array<{ path: string; name: string; type: string; value: string }>;
  dxvk_options: Record<string, string>;
  flags: string[];
  has_complex_logic: boolean;
  script_path: string;
  notes: string;
}

export interface CompatibilitySource {
  name: 'protonfixes' | 'lutris' | 'protondb' | 'pcgamingwiki' | 'umu';
  found: boolean;
  url?: string;
  data?: unknown;
  error?: string;
}

export interface CompatibilityReport {
  game: {
    title: string;
    slug: string;
    gogId?: string;
    steamAppId?: string;
  };
  generatedAt: string;
  sources: CompatibilitySource[];
  merged: {
    umuGameId?: string;
    winetricks: string[];
    dllOverrides: Record<string, string>;
    envVars: Record<string, string>;
    delEnvVars: string[];
    commandReplacements: Array<{ from: string; to: string }>;
    registry: Array<{ path: string; name: string; type: string; value: string }>;
    flags: string[];
    dxvkOptions: Record<string, string>;
    recommendedDxvk: boolean;
    recommendedVkd3d: boolean;
    recommendedArch: 'win32' | 'win64';
    suggestedExe?: string;
    hasComplexFixes: boolean;
    complexFixNotes?: string;
  };
  protondbTier?: 'native' | 'platinum' | 'gold' | 'silver' | 'bronze' | 'borked';
  confidence: 'high' | 'medium' | 'low' | 'none';
}

export interface MakeItRunProtonfixEntry {
  scriptPath: string;
  winetricks: string[];
  dllOverrides: Record<string, string>;
  envVars: Record<string, string>;
  delEnvVars: string[];
  commandReplacements: Array<{ from: string; to: string }>;
  registry: Array<{ path: string; name: string; type: string; value: string }>;
  flags: string[];
  hasComplexLogic: boolean;
  notes?: string;
}

export interface MakeItRunConfig {
  schemaVersion: '1.0';
  slug: string;
  title?: string;
  createdAt: string;
  updatedAt: string;
  sources?: {
    importSource?: MakeItRunImportSource;
    generatedFromGameId?: string;
    compatibilityGeneratedAt?: string;
    protondbTier?: 'native' | 'platinum' | 'gold' | 'silver' | 'bronze' | 'borked';
    lutrisInstallerId?: number;
    lutrisInstallerSlug?: string;
    protonfixScriptPath?: string;
  };
  install?: {
    method?: 'lutris' | 'standard' | 'manual';
    installerPath?: string;
    installPath?: string;
    wineVersionId?: string;
    wineArch?: 'win32' | 'win64';
    umuGameId?: string;
  };
  protonfixes?: {
    enabled?: boolean;
    hasComplexLogic?: boolean;
    notes?: string;
    scriptPath?: string;
    commandReplacements?: Array<{ from: string; to: string }>;
    flags?: string[];
  };
  winetricks?: string[];
  dllOverrides?: Record<string, string>;
  registry?: Array<{ path: string; name: string; type: string; value: string }>;
  environment?: Record<string, string>;
  rendering?: {
    useDxvk?: boolean;
    useVkd3dProton?: boolean;
    renderer?: 'vulkan' | 'opengl' | 'gdi';
    compatibilityMode?: 'none' | 'legacy' | 'win98' | 'winxp' | 'win7' | 'win10';
    dxvkOptions?: Record<string, string>;
  };
  performance?: {
    gamescope?: {
      enabled?: boolean;
      width?: number;
      height?: number;
      refreshRate?: number;
      upscaler?: 'auto' | 'fsr' | 'nis' | 'linear' | 'nearest';
      fullscreen?: boolean;
      limitFps?: number;
      inputWidth?: number;
      inputHeight?: number;
    };
    mangohud?: {
      enabled?: boolean;
    };
  };
  launch?: {
    command?: string;
    arguments?: string[];
    workingDirectory?: string;
    environment?: Record<string, string>;
  };
  flags?: string[];
  notes?: string;
}

export interface MakeItRunConfigSummary {
  slug: string;
  title?: string;
  updatedAt: string;
  importSource?: MakeItRunImportSource;
  protondbTier?: 'native' | 'platinum' | 'gold' | 'silver' | 'bronze' | 'borked';
}
