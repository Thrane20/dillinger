// Streaming types for Dillinger streaming sidecar
/**
 * Default streaming settings
 */
export const DEFAULT_STREAMING_SETTINGS = {
    streamingMode: 'profiles',
    gpuType: 'auto',
    codec: 'h264',
    quality: 'high',
    idleTimeoutMinutes: 15,
    waylandSocketPath: '/run/dillinger/wayland-dillinger',
    defaultProfileId: '1080p60',
    autoStart: true,
    streamingGraphPath: '/data/storage/streaming-graph.json',
};
/**
 * Default streaming profiles shipped with Dillinger
 */
export const DEFAULT_STREAMING_PROFILES = [
    {
        id: '1080p60',
        name: '1080p @ 60Hz',
        description: 'Full HD, broad compatibility',
        width: 1920,
        height: 1080,
        refreshRate: 60,
        isDefault: true,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
    },
    {
        id: '1440p60',
        name: '1440p @ 60Hz',
        description: 'QHD, higher quality streaming',
        width: 2560,
        height: 1440,
        refreshRate: 60,
        isDefault: true,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
    },
    {
        id: '4k30',
        name: '4K @ 30Hz',
        description: '4K resolution, bandwidth limited',
        width: 3840,
        height: 2160,
        refreshRate: 30,
        isDefault: true,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
    },
    {
        id: 'ultrawide',
        name: 'Ultrawide @ 60Hz',
        description: '21:9 aspect ratio displays',
        width: 3440,
        height: 1440,
        refreshRate: 60,
        isDefault: true,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
    },
];
/**
 * Bitrate presets for quality levels (in Mbps)
 */
export const QUALITY_BITRATES = {
    low: 5,
    medium: 15,
    high: 30,
    ultra: 50,
};
