// Streaming types for Dillinger streaming sidecar

/**
 * GPU type for hardware encoding
 */
export type StreamingGpuType = 'auto' | 'amd' | 'nvidia';

/**
 * Video codec for streaming
 */
export type StreamingCodec = 'h264' | 'h265' | 'av1';

/**
 * Quality preset for streaming
 */
export type StreamingQuality = 'low' | 'medium' | 'high' | 'ultra';

/**
 * Test apps for streaming test mode (GStreamer pipelines)
 */
export type TestApp = 'gst-video-test' | 'gst-av-test';

/**
 * Sidecar operating mode
 */
export type SidecarMode = 'game' | 'test';

/**
 * Job specification passed to the streaming sidecar
 */
export interface JobSpec {
  gameCommand: string[];
  resolution: { width: number; height: number };
  fps: number;
  bitrate: number | StreamingQuality;
  encoder: 'vaapi' | 'nvenc' | 'amf' | 'software' | 'auto';
  audio: { enabled: boolean };
  env: Record<string, string>;
  mounts: Array<{ source: string; target: string; readonly?: boolean }>;
  network: { ports: number[] };
  input: { enableController: boolean; enableMouse: boolean; enableKeyboard: boolean };
}

/**
 * Moonlight client info returned by the sidecar
 */
export interface MoonlightClientInfo {
  id?: string;
  name?: string;
  ip?: string;
  status?: string;
}

/**
 * A streaming compositor profile
 */
export interface StreamingProfile {
  /** Unique profile ID (e.g., "1080p60", "custom-ultrawide") */
  id: string;
  
  /** Display name for the profile */
  name: string;
  
  /** Profile description */
  description?: string;
  
  /** Resolution width in pixels */
  width: number;
  
  /** Resolution height in pixels */
  height: number;
  
  /** Refresh rate in Hz */
  refreshRate: number;
  
  /** Whether this is a system default profile (not user-deletable) */
  isDefault?: boolean;
  
  /** Custom compositor configuration directives (appended to generated config) */
  customConfig?: string;
  
  /** ISO timestamp when created */
  created: string;
  
  /** ISO timestamp when last modified */
  updated: string;
}

/**
 * Streaming settings stored in application settings
 */
export interface StreamingSettings {
  /** Which streaming control mode to use */
  streamingMode: 'profiles' | 'graph';

  /** GPU type for hardware encoding */
  gpuType: StreamingGpuType;
  
  /** Preferred video codec */
  codec: StreamingCodec;
  
  /** Quality preset (affects bitrate) */
  quality: StreamingQuality;
  
  /** Custom bitrate in Mbps (overrides quality preset if set) */
  customBitrate?: number;
  
  /** Idle timeout in minutes before sidecar auto-stops (0 = never) */
  idleTimeoutMinutes: number;
  
  /** Path for Wayland socket */
  waylandSocketPath: string;
  
  /** ID of the default streaming profile */
  defaultProfileId: string;
  
  /** Whether to auto-start sidecar when streaming is requested */
  autoStart: boolean;

  /** Path to streaming graph store JSON */
  streamingGraphPath: string;
}

/**
 * Default streaming settings
 */
export const DEFAULT_STREAMING_SETTINGS: StreamingSettings = {
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
export const DEFAULT_STREAMING_PROFILES: StreamingProfile[] = [
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
 * Sidecar container status
 */
export interface SidecarStatus {
  /** Whether the sidecar container is running */
  running: boolean;
  
  /** Container ID if running */
  containerId?: string;
  
  /** Current operating mode */
  mode?: SidecarMode;
  
  /** Currently loaded streaming profile */
  profileId?: string;
  
  /** Current resolution string (e.g., "1920x1080") */
  resolution?: string;
  
  /** GPU type being used */
  gpuType?: StreamingGpuType;

  /** Whether Wolf is running */
  wolfRunning?: boolean;
  
  /** Container start time */
  startedAt?: string;
  
  /** Number of connected Wayland clients */
  clientCount?: number;

  /** Paired Moonlight clients */
  pairedClients?: MoonlightClientInfo[];
}

/**
 * Request to start streaming test
 */
export interface StartTestStreamRequest {
  /** Test app to launch inside the sidecar */
  app: TestApp;
}

/**
 * Response from streaming test status
 */
export interface TestStreamStatus {
  /** Whether test is currently running */
  running: boolean;
  
  /** Test mode */
  mode?: 'stream';
  
  /** Active test app */
  app?: TestApp;

  /** Waiting for Moonlight connection */
  waiting?: boolean;

  /** Pairing required before launch */
  pairingRequired?: boolean;
  
  /** Container ID */
  containerId?: string;
  
  /** Instructions for user */
  instructions?: string;
}

/**
 * Bitrate presets for quality levels (in Mbps)
 */
export const QUALITY_BITRATES: Record<StreamingQuality, number> = {
  low: 5,
  medium: 15,
  high: 30,
  ultra: 50,
};
