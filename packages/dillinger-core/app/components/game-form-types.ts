import type {
  GamePlatformConfig,
  RetroarchMameSettings,
  RetroarchMameAspect,
  WineGamePhase,
} from '@dillinger/shared';

export interface GameFormData {
  id?: string;
  title: string;
  slug?: string;
  platformId: string;
  platforms: GamePlatformConfig[];
  filePath?: string;
  tags: string;
  metadata: {
    description?: string;
    genre?: string;
    developer?: string;
    publisher?: string;
    releaseDate?: string;
    rating?: number;
    igdbId?: number;
    primaryImage?: string;
    backdropImage?: string;
  };
  settings?: {
    wine?: {
      version?: string;
      umuGameId?: string;
      arch?: 'win32' | 'win64';
      useDxvk?: boolean;
      dxvkVersion?: string;
      useVkd3dProton?: boolean;
      vkd3dVersion?: string;
      renderer?: 'vulkan' | 'opengl' | 'gdi';
      compatibilityMode?: 'none' | 'legacy' | 'win98' | 'winxp' | 'win7' | 'win10';
      dlls?: Record<string, string>;
      dllOverrides?: string;
      winetricks?: string[];
      registrySettings?: Array<{
        path: string;
        name: string;
        type: 'REG_SZ' | 'REG_DWORD' | 'REG_BINARY' | 'REG_MULTI_SZ' | 'REG_EXPAND_SZ';
        value: string;
      }>;
      debug?: {
        relay?: boolean;
        seh?: boolean;
        tid?: boolean;
        timestamp?: boolean;
        heap?: boolean;
        file?: boolean;
        module?: boolean;
        win?: boolean;
        d3d?: boolean;
        opengl?: boolean;
        all?: boolean;
      };
    };
    launch?: {
      command?: string;
      arguments?: string[];
      environment?: Record<string, string>;
      workingDirectory?: string;
      fullscreen?: boolean;
      resolution?: string;
      useXrandr?: boolean;
      xrandrMode?: string;
      useGamescope?: boolean;
      gamescopeWidth?: number;
      gamescopeHeight?: number;
      gamescopeOutputWidth?: number;
      gamescopeOutputHeight?: number;
    };
    gamescope?: {
      enabled?: boolean;
      width?: number;
      height?: number;
      refreshRate?: number;
      fullscreen?: boolean;
      upscaler?: 'auto' | 'fsr' | 'nis' | 'linear' | 'nearest';
      inputWidth?: number;
      inputHeight?: number;
      borderless?: boolean;
      limitFps?: number;
    };
    mangohud?: {
      enabled?: boolean;
    };
    emulator?: {
      core?: string;
      settings?: {
        mame?: RetroarchMameSettings;
      };
    };
  };
  _originalGame?: {
    metadata?: {
      igdbId?: number;
      similarGames?: unknown[];
      [key: string]: unknown;
    };
    installation?: {
      status?: string;
      installPath?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
}

export interface GameFormProps {
  mode: 'add' | 'edit';
  gameId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export interface SavedGameMetadata {
  slug: string;
  localImages: {
    cover?: string;
    screenshots: string[];
    artworks: string[];
  };
}

export interface Screenshot {
  filename: string;
  path: string;
  size: number;
  modified: string;
  modifiedTimestamp: number;
}

export interface SaveFile {
  filename: string;
  type: 'sram' | 'state';
  size: number;
  modified: string;
  modifiedTimestamp: number;
  slot?: number;
}

export interface FormSection {
  id: string;
  label: string;
  icon: string;
  disabled?: boolean;
}

export interface MakeItRunCompatibilitySummary {
  suggestedUmuGameId?: string;
  winetricks: string[];
  hasComplexFixes: boolean;
  complexFixNotes?: string;
  protonfixScriptUrl?: string;
}

export type GameFormMameAspect = RetroarchMameAspect;
export type GameFormWinePhase = WineGamePhase;
