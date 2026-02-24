// Utility functions for multi-platform support
/**
 * Migrates a legacy game (single platform) to the new multi-platform format
 */
export function migrateGameToMultiPlatform(game) {
    // If already migrated (has platforms array), return as-is
    if (game.platforms && game.platforms.length > 0) {
        return game;
    }
    // Migrate from legacy format
    const platforms = [];
    if (game.platformId) {
        const platformConfig = {
            platformId: game.platformId,
        };
        if (game.filePath !== undefined)
            platformConfig.filePath = game.filePath;
        if (game.settings !== undefined)
            platformConfig.settings = game.settings;
        if (game.installation !== undefined)
            platformConfig.installation = game.installation;
        platforms.push(platformConfig);
    }
    const migratedGame = {
        ...game,
        platforms,
    };
    // Only set defaultPlatformId if we have a platformId
    if (game.platformId) {
        migratedGame.defaultPlatformId = game.platformId;
    }
    return migratedGame;
}
/**
 * Gets platform configuration for a specific platform ID
 */
export function getPlatformConfig(game, platformId) {
    const migratedGame = migrateGameToMultiPlatform(game);
    return migratedGame.platforms.find(p => p.platformId === platformId);
}
/**
 * Gets the default platform configuration
 */
export function getDefaultPlatformConfig(game) {
    const migratedGame = migrateGameToMultiPlatform(game);
    if (migratedGame.defaultPlatformId) {
        const config = migratedGame.platforms.find(p => p.platformId === migratedGame.defaultPlatformId);
        if (config)
            return config;
    }
    // Fall back to first platform if no default set
    return migratedGame.platforms[0];
}
/**
 * Gets all configured platform IDs for a game
 */
export function getConfiguredPlatforms(game) {
    const migratedGame = migrateGameToMultiPlatform(game);
    return migratedGame.platforms
        .filter(p => {
        // A platform is configured if it has a filePath or launch command
        return p.filePath || p.settings?.launch?.command;
    })
        .map(p => p.platformId);
}
/**
 * Checks if a game has a platform configured
 */
export function hasPlatformConfigured(game, platformId) {
    return getConfiguredPlatforms(game).includes(platformId);
}
/**
 * Adds or updates a platform configuration
 */
export function setPlatformConfig(game, platformId, config) {
    const migratedGame = migrateGameToMultiPlatform(game);
    const existingIndex = migratedGame.platforms.findIndex(p => p.platformId === platformId);
    if (existingIndex >= 0) {
        // Update existing platform
        migratedGame.platforms[existingIndex] = {
            ...migratedGame.platforms[existingIndex],
            ...config,
            platformId, // Ensure platformId doesn't change
        };
    }
    else {
        // Add new platform
        migratedGame.platforms.push({
            platformId,
            ...config,
        });
    }
    // Set as default if it's the first platform
    if (!migratedGame.defaultPlatformId && migratedGame.platforms.length === 1) {
        migratedGame.defaultPlatformId = platformId;
    }
    migratedGame.updated = new Date().toISOString();
    return migratedGame;
}
/**
 * Removes a platform configuration
 */
export function removePlatformConfig(game, platformId) {
    const migratedGame = migrateGameToMultiPlatform(game);
    migratedGame.platforms = migratedGame.platforms.filter(p => p.platformId !== platformId);
    // If we removed the default platform, set a new default
    if (migratedGame.defaultPlatformId === platformId) {
        if (migratedGame.platforms.length > 0 && migratedGame.platforms[0]) {
            migratedGame.defaultPlatformId = migratedGame.platforms[0].platformId;
        }
        else {
            delete migratedGame.defaultPlatformId;
        }
    }
    migratedGame.updated = new Date().toISOString();
    return migratedGame;
}
