const REGISTRY_BASE = 'ghcr.io/thrane20/dillinger';

export type RunnerImageConfig = {
  repository: string;
  name: string;
  description: string;
  platforms: string[];
};

export const RUNNER_IMAGES: Record<string, RunnerImageConfig> = {
  base: {
    repository: `${REGISTRY_BASE}/runner-base`,
    name: 'Base Runner',
    description: 'Core infrastructure for all runners (X11, GPU, Audio)',
    platforms: [],
  },
  wine: {
    repository: `${REGISTRY_BASE}/runner-wine`,
    name: 'Wine Runner',
    description: 'Windows games via Wine compatibility layer',
    platforms: ['windows-wine'],
  },
  vice: {
    repository: `${REGISTRY_BASE}/runner-vice`,
    name: 'VICE Runner',
    description: 'Commodore 64/128/VIC-20/Plus4/PET emulation',
    platforms: ['c64', 'c128', 'vic20', 'plus4', 'pet'],
  },
  retroarch: {
    repository: `${REGISTRY_BASE}/runner-retroarch`,
    name: 'RetroArch Runner',
    description: 'Multi-system emulation including arcade (MAME), NES, SNES, PlayStation 1',
    platforms: ['arcade', 'mame', 'nes', 'snes', 'genesis', 'psx'],
  },
  'fs-uae': {
    repository: `${REGISTRY_BASE}/runner-fs-uae`,
    name: 'FS-UAE Runner',
    description: 'Amiga emulation via FS-UAE',
    platforms: ['amiga', 'amiga500', 'amiga1200', 'cd32'],
  },
  'linux-native': {
    repository: `${REGISTRY_BASE}/runner-linux-native`,
    name: 'Linux Native Runner',
    description: 'Native Linux games and applications',
    platforms: ['linux-native'],
  },
};
