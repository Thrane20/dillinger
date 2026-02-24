import type { GameFormData } from './game-form-types';

export const ROMS_BROWSE_PATH = '/roms';

export const applyShortcutSelection = (
  prev: GameFormData,
  shortcut: { target?: string; arguments?: string; workingDirectory?: string },
  stripNullTerminators: (value: string) => string,
  sanitizeStringArray: (values: unknown) => string[],
): GameFormData => ({
  ...prev,
  settings: {
    ...prev.settings,
    launch: {
      ...prev.settings?.launch,
      command: stripNullTerminators(shortcut.target || prev.settings?.launch?.command || ''),
      arguments: shortcut.arguments
        ? [stripNullTerminators(shortcut.arguments)]
        : sanitizeStringArray(prev.settings?.launch?.arguments),
      workingDirectory: stripNullTerminators(shortcut.workingDirectory || prev.settings?.launch?.workingDirectory || ''),
    },
  },
});

export const applyFileExplorerSelection = (prev: GameFormData, path: string): GameFormData => ({
  ...prev,
  settings: {
    ...prev.settings,
    launch: {
      ...prev.settings?.launch,
      command: path,
      workingDirectory: prev.settings?.launch?.workingDirectory || path.substring(0, path.lastIndexOf('/')) || '',
    },
  },
});

export const applyRomFileSelection = (prev: GameFormData, path: string): GameFormData => ({
  ...prev,
  filePath: path,
});
