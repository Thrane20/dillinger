import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import WineRenderingSection from '../../app/components/WineRenderingSection';
import WineMakeItRunSection from '../../app/components/WineMakeItRunSection';
import WinePerformanceSection from '../../app/components/WinePerformanceSection';

type ChangeHandler = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;

const noopSectionRef = () => undefined;
const noopChange: ChangeHandler = () => undefined;

type RenderingFormData = {
  settings?: {
    wine?: {
      renderer?: 'vulkan' | 'opengl' | 'gdi';
      version?: string;
      useDxvk?: boolean;
      dxvkVersion?: string;
      useVkd3dProton?: boolean;
      vkd3dVersion?: string;
    };
    launch?: {
      fullscreen?: boolean;
      resolution?: string;
      useXrandr?: boolean;
      xrandrMode?: string;
    };
  };
};

type MakeItRunFormData = {
  settings?: {
    wine?: {
      umuGameId?: string;
      dllOverrides?: string;
      winetricks?: string[];
      registrySettings?: Array<{
        path: string;
        name: string;
        type: 'REG_SZ' | 'REG_DWORD' | 'REG_BINARY' | 'REG_MULTI_SZ' | 'REG_EXPAND_SZ';
        value: string;
      }>;
    };
    launch?: {
      environment?: Record<string, string>;
    };
  };
};

type PerformanceFormData = {
  settings?: {
    gamescope?: {
      enabled?: boolean;
      width?: number;
      height?: number;
      refreshRate?: number;
      fullscreen?: boolean;
      upscaler?: 'auto' | 'fsr' | 'nis' | 'linear' | 'nearest';
      inputWidth?: number;
      inputHeight?: number;
      limitFps?: number;
    };
    mangohud?: {
      enabled?: boolean;
    };
  };
};

const renderingFormData: RenderingFormData = {
  settings: {
    wine: {
      renderer: 'opengl' as const,
    },
    launch: {
      fullscreen: false,
      resolution: '1920x1080',
      useXrandr: false,
      xrandrMode: '',
    },
  },
};

const makeItRunFormData: MakeItRunFormData = {
  settings: {
    wine: {
      umuGameId: '',
      dllOverrides: '',
      winetricks: [],
      registrySettings: [],
    },
    launch: {
      environment: {},
    },
  },
};

const performanceFormData: PerformanceFormData = {
  settings: {
    gamescope: {
      enabled: false,
      width: 1920,
      height: 1080,
      refreshRate: 60,
      fullscreen: false,
      upscaler: 'auto' as const,
    },
    mangohud: {
      enabled: false,
    },
  },
};

const noopSetRendering: React.Dispatch<React.SetStateAction<RenderingFormData>> = () => undefined;
const noopSetMakeItRun: React.Dispatch<React.SetStateAction<MakeItRunFormData>> = () => undefined;
const noopSetPerformance: React.Dispatch<React.SetStateAction<PerformanceFormData>> = () => undefined;
const noopAsync = async () => undefined;

test('Wine section components render lock placeholders for pre-install phases', async () => {
  const renderingLocked = renderToStaticMarkup(
    React.createElement(WineRenderingSection, {
      formData: renderingFormData,
      handleChange: noopChange,
      setFormData: noopSetRendering,
      phase: 'needs_install',
      sectionRef: noopSectionRef,
    })
  );

  const makeItRunLocked = renderToStaticMarkup(
    React.createElement(WineMakeItRunSection, {
      gameId: 'game-1',
      formData: makeItRunFormData,
      setFormData: noopSetMakeItRun,
      handleChange: noopChange,
      selectedLutrisInstallerId: undefined,
      makeItRunCompatLoading: false,
      makeItRunCompatSummary: null,
      makeItRunIoLoading: false,
      winetricksVerbQuery: '',
      setWinetricksVerbQuery: () => undefined,
      filteredWinetricksVerbs: [],
      commonWinetricksVerbs: [],
      applyDllQuickAdd: () => undefined,
      onAutoDetect: () => undefined,
      onExportToml: () => undefined,
      onImportFileSelected: () => undefined,
      onRunRegistrySetup: noopAsync,
      onApplyRegistrySettings: noopAsync,
      phase: 'needs_install',
      sectionRef: noopSectionRef,
    })
  );

  const performanceLocked = renderToStaticMarkup(
    React.createElement(WinePerformanceSection, {
      formData: performanceFormData,
      setFormData: noopSetPerformance,
      handleChange: noopChange,
      isLocked: false,
      phase: 'needs_install',
      sectionRef: noopSectionRef,
    })
  );

  assert.match(renderingLocked, /Install the game first to access rendering settings\./);
  assert.match(makeItRunLocked, /Install the game first to access MakeItRun configuration\./);
  assert.match(performanceLocked, /Install the game first to access performance settings\./);
});

test('Wine section components hide lock placeholders for unlocked phases', async () => {
  const renderingUnlocked = renderToStaticMarkup(
    React.createElement(WineRenderingSection, {
      formData: renderingFormData,
      handleChange: noopChange,
      setFormData: noopSetRendering,
      phase: 'ready',
      sectionRef: noopSectionRef,
    })
  );

  const makeItRunUnlocked = renderToStaticMarkup(
    React.createElement(WineMakeItRunSection, {
      gameId: 'game-1',
      formData: makeItRunFormData,
      setFormData: noopSetMakeItRun,
      handleChange: noopChange,
      selectedLutrisInstallerId: undefined,
      makeItRunCompatLoading: false,
      makeItRunCompatSummary: null,
      makeItRunIoLoading: false,
      winetricksVerbQuery: '',
      setWinetricksVerbQuery: () => undefined,
      filteredWinetricksVerbs: [],
      commonWinetricksVerbs: [],
      applyDllQuickAdd: () => undefined,
      onAutoDetect: () => undefined,
      onExportToml: () => undefined,
      onImportFileSelected: () => undefined,
      onRunRegistrySetup: noopAsync,
      onApplyRegistrySettings: noopAsync,
      phase: 'ready',
      sectionRef: noopSectionRef,
    })
  );

  const performanceUnlocked = renderToStaticMarkup(
    React.createElement(WinePerformanceSection, {
      formData: performanceFormData,
      setFormData: noopSetPerformance,
      handleChange: noopChange,
      isLocked: false,
      phase: 'ready',
      sectionRef: noopSectionRef,
    })
  );

  assert.doesNotMatch(renderingUnlocked, /Install the game first to access rendering settings\./);
  assert.doesNotMatch(makeItRunUnlocked, /Install the game first to access MakeItRun configuration\./);
  assert.doesNotMatch(performanceUnlocked, /Install the game first to access performance settings\./);

  assert.match(renderingUnlocked, /WineD3D Renderer/);
  assert.match(makeItRunUnlocked, /UMU Game ID/);
  assert.match(performanceUnlocked, /Use Gamescope compositor/);
});
