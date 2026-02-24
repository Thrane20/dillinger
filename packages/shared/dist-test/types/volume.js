export const FIRST_CLASS_VOLUMES = {
    core: {
        category: 'core',
        dockerVolumeName: 'dillinger_core',
        mountPath: '/data',
        icon: '🧠',
        description: 'Core Dillinger data (configs, saves, sessions, metadata)',
    },
    roms: {
        category: 'roms',
        dockerVolumeName: 'dillinger_roms',
        mountPath: '/roms',
        icon: '💾',
        description: 'ROM library root',
    },
    cache: {
        category: 'cache',
        dockerVolumeName: 'dillinger_cache',
        mountPath: '/cache',
        icon: '📦',
        description: 'Installer/download cache',
    },
    installed: {
        category: 'installed',
        dockerVolumeName: 'dillinger_installed_*',
        dockerVolumePattern: /^dillinger_installed_(.+)$/,
        mountPath: '/installed/<suffix>',
        icon: '🎮',
        description: 'Wine install roots mounted under /installed/<suffix>',
    },
};
export function parseFirstClassVolume(volumeName) {
    if (volumeName === FIRST_CLASS_VOLUMES.core.dockerVolumeName) {
        return {
            category: 'core',
            volumeName,
            mountPath: FIRST_CLASS_VOLUMES.core.mountPath,
        };
    }
    if (volumeName === FIRST_CLASS_VOLUMES.roms.dockerVolumeName) {
        return {
            category: 'roms',
            volumeName,
            mountPath: FIRST_CLASS_VOLUMES.roms.mountPath,
        };
    }
    if (volumeName === FIRST_CLASS_VOLUMES.cache.dockerVolumeName) {
        return {
            category: 'cache',
            volumeName,
            mountPath: FIRST_CLASS_VOLUMES.cache.mountPath,
        };
    }
    const installedMatch = volumeName.match(/^dillinger_installed_(.+)$/);
    if (installedMatch) {
        const suffix = installedMatch[1];
        const parsed = {
            category: 'installed',
            volumeName,
            mountPath: `/installed/${suffix}`,
        };
        if (suffix) {
            parsed.suffix = suffix;
        }
        return parsed;
    }
    return null;
}
