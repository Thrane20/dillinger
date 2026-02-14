export type RetroarchMameAspect = '4:3' | 'auto';

export interface RetroarchMameSettings {
  aspect?: RetroarchMameAspect;
  integerScale?: boolean;
  borderlessFullscreen?: boolean;
}

export interface RetroarchSettings {
  mame?: RetroarchMameSettings;
}
