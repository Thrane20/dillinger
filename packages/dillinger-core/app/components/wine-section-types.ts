import type { WineGamePhase } from '@dillinger/shared';

export interface WineInstallationState {
  status?: string;
  installPath?: string;
  error?: string;
  installerArgs?: string;
}

export interface WineSectionSharedProps<TFormData> {
  formData: TFormData;
  setFormData: React.Dispatch<React.SetStateAction<TFormData>>;
  activeInstallation?: WineInstallationState;
  phase?: WineGamePhase;
}
