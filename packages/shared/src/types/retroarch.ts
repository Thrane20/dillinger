export type RetroarchMameAspect = 'auto' | '4:3' | '3:4' | '2:3' | '5:8' | '1:1' | '16:15' | '8:7' | '16:9';

export interface RetroarchMameSettings {
  aspect?: RetroarchMameAspect;
  integerScale?: boolean;
  borderlessFullscreen?: boolean;
}

export interface RetroarchSettings {
  mame?: RetroarchMameSettings;
}
