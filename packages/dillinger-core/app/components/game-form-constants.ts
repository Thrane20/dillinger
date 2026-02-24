import type { FormSection } from './game-form-types';

export const RETROARCH_PLATFORMS = ['nes', 'snes', 'psx', 'mame'];

export const ROM_PLATFORMS = [
  ...RETROARCH_PLATFORMS,
  'c64', 'c128', 'vic20', 'plus4', 'pet',
  'amiga', 'amiga500', 'amiga500plus', 'amiga600', 'amiga1200', 'amiga3000', 'amiga4000', 'cd32',
];

export const COMMON_WINETRICKS_VERBS = [
  'vcrun2008',
  'vcrun2010',
  'vcrun2012',
  'vcrun2013',
  'vcrun2015',
  'vcrun2019',
  'd3dx9',
  'd3dcompiler_43',
  'd3dcompiler_47',
  'dxvk',
  'vkd3d',
  'physx',
  'xact',
  'xinput',
  'dotnet48',
  'corefonts',
  'faudio',
  'quartz',
  'wmp11',
  'win10',
];

const DEFAULT_SECTIONS: FormSection[] = [
  { id: 'basic', label: 'Basic Information', icon: '📋' },
  { id: 'install', label: 'Configuration', icon: '⚙️' },
  { id: 'game-info', label: 'Game Information', icon: '📖' },
];

export const buildWineSections = (isInstalled: boolean, canAccessWineAdvanced: boolean): FormSection[] => [
  { id: 'basic', label: 'Basic Information', icon: '📋' },
  {
    id: 'install',
    label: isInstalled ? '✅ Installed' : 'Installation',
    icon: '📦',
  },
  {
    id: 'rendering',
    label: 'Rendering',
    icon: '🎨',
    disabled: !isInstalled,
  },
  {
    id: 'makeitrun-config',
    label: 'MakeItRun Config',
    icon: '🔧',
    disabled: !canAccessWineAdvanced,
  },
  {
    id: 'performance',
    label: 'Performance',
    icon: '⚡',
    disabled: !canAccessWineAdvanced,
  },
  { id: 'game-info', label: 'Game Information', icon: '📖' },
];

export const getFormSections = (
  platformId: string,
  installationStatus: string | undefined,
  canAccessWineAdvanced: boolean,
): FormSection[] => {
  if (platformId !== 'windows-wine') {
    return DEFAULT_SECTIONS;
  }

  return buildWineSections(installationStatus === 'installed', canAccessWineAdvanced);
};
