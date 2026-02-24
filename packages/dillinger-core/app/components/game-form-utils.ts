import type { RetroarchMameSettings } from '@dillinger/shared';

const PLATFORM_NAMES: Record<string, string> = {
  'linux-native': 'Native (Linux)',
  'windows-wine': 'Wine (Windows)',
  'proton': 'Proton',
  'dosbox': 'DOSBox',
  'scummvm': 'ScummVM',
  'nes': 'Nintendo (NES)',
  'snes': 'Super Nintendo (SNES)',
  'psx': 'PlayStation 1',
  'c64': 'Commodore 64',
  'c128': 'Commodore 128',
  'vic20': 'VIC-20',
  'plus4': 'Plus/4',
  'pet': 'PET',
  'amiga': 'Amiga',
  'amiga500': 'Amiga 500',
  'amiga500plus': 'Amiga 500+',
  'amiga600': 'Amiga 600',
  'amiga1200': 'Amiga 1200',
  'amiga3000': 'Amiga 3000',
  'amiga4000': 'Amiga 4000',
  'cd32': 'Amiga CD32',
  'mame': 'Arcade (MAME)',
};

export const stripNullTerminators = (value: string): string => value.replace(/\u0000/g, '').trim();

export const sanitizeStringArray = (values: unknown): string[] => {
  if (!Array.isArray(values)) return [];
  return values
    .filter((value) => typeof value === 'string')
    .map((value) => stripNullTerminators(value as string));
};

export const formatRelativeTime = (isoDate: string): string => {
  const now = new Date();
  const date = new Date(isoDate);
  const diffMs = now.getTime() - date.getTime();

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffYears > 0) {
    const remainingMonths = Math.floor((diffDays % 365) / 30);
    const remainingDays = diffDays % 30;
    const parts = [`${diffYears} year${diffYears > 1 ? 's' : ''}`];
    if (remainingMonths > 0) parts.push(`${remainingMonths} month${remainingMonths > 1 ? 's' : ''}`);
    if (remainingDays > 0 && remainingMonths === 0) parts.push(`${remainingDays} day${remainingDays > 1 ? 's' : ''}`);
    return `${parts.join(', ')} ago`;
  }

  if (diffMonths > 0) {
    const remainingDays = diffDays % 30;
    const parts = [`${diffMonths} month${diffMonths > 1 ? 's' : ''}`];
    if (remainingDays > 0) parts.push(`${remainingDays} day${remainingDays > 1 ? 's' : ''}`);
    return `${parts.join(', ')} ago`;
  }

  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }

  if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  }

  if (diffMinutes > 0) {
    return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  }

  return 'Just now';
};

export const normalizeMameSettings = (settings: RetroarchMameSettings): RetroarchMameSettings => {
  const normalized: RetroarchMameSettings = {};
  if (settings.aspect) normalized.aspect = settings.aspect;
  if (typeof settings.integerScale === 'boolean') normalized.integerScale = settings.integerScale;
  if (typeof settings.borderlessFullscreen === 'boolean') {
    normalized.borderlessFullscreen = settings.borderlessFullscreen;
  }
  return normalized;
};

export const getPlatformName = (id: string): string => PLATFORM_NAMES[id] || id;
