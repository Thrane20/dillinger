export function deriveWinePhase(game, platformConfig, options = {}) {
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
    const hasLegacyTweaks = Boolean(platformConfig.settings?.wine?.umuGameId) ||
        Boolean(platformConfig.settings?.wine?.dllOverrides) ||
        Boolean(platformConfig.settings?.wine?.winetricks?.length);
    if (!hasLegacyTweaks && game?.slug) {
        return 'needs_configuration';
    }
    return 'ready';
}
