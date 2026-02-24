import type { Game, GamePlatformConfig, WineGamePhase } from '../types/game.js';

export interface DeriveWinePhaseOptions {
  hasActiveSession?: boolean;
  hasMakeItRunConfig?: boolean;
}

export function deriveWinePhase(
  game: Partial<Game> | undefined,
  platformConfig: GamePlatformConfig | undefined,
  options: DeriveWinePhaseOptions = {}
): WineGamePhase {
  if (options.hasActiveSession) {
    return 'running';
  }

  if (!platformConfig || platformConfig.platformId !== 'windows-wine') {
    return 'needs_install';
  }

  const installStatus = platformConfig.installation?.status;

  if (installStatus === 'installing') {
    return 'installing';
  }

  if (installStatus === 'failed') {
    return 'install_failed';
  }

  if (installStatus !== 'installed') {
    return 'needs_install';
  }

  const launchCommand = platformConfig.settings?.launch?.command?.trim();
  if (!launchCommand) {
    return 'post_install';
  }

  if (options.hasMakeItRunConfig === false) {
    return 'needs_configuration';
  }

  if (options.hasMakeItRunConfig === true) {
    return 'ready';
  }

  const hasLegacyTweaks =
    Boolean(platformConfig.settings?.wine?.umuGameId) ||
    Boolean(platformConfig.settings?.wine?.dllOverrides) ||
    Boolean(platformConfig.settings?.wine?.winetricks?.length);

  if (!hasLegacyTweaks && game?.slug) {
    return 'needs_configuration';
  }

  return 'ready';
}
