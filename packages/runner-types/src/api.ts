// API Types for Game Launch Requests
export interface GameLaunchRequest {
  gameId: string;           // UUID of the game to launch
  sessionId?: string;       // Optional session ID for resuming
  configuration?: LaunchConfiguration;
}

export interface LaunchConfiguration {
  display: DisplayConfiguration;
  resources: ResourceLimits;
  wine?: WineConfiguration;
  environment?: Record<string, string>;
}

export interface DisplayConfiguration {
  width: number;
  height: number;
  depth?: number;
  refreshRate?: number;
  method: 'x11' | 'wayland' | 'headless';
}

export interface ResourceLimits {
  cpu: number;              // CPU cores (e.g., 2.0)
  memory: string;           // Memory limit (e.g., "4g")
  gpuMemory?: string;       // GPU memory limit (e.g., "2g")
}

export interface WineConfiguration {
  version: string;          // Wine version to use
  prefix?: string;          // Wine prefix path
  dlls?: Record<string, string>; // DLL overrides
}

// Response Types
export interface LaunchResponse {
  success: boolean;
  sessionId: string;
  containerId?: string;
  streamUrl?: string;
  error?: string;
}

export interface SessionStatus {
  sessionId: string;
  status: SessionState;
  containerId?: string;
  streamUrl?: string;
  startTime: string;
  lastActivity?: string;
  resources?: ResourceUsage;
}

export type SessionState = 'starting' | 'running' | 'paused' | 'stopping' | 'stopped' | 'error';

export interface ResourceUsage {
  cpu: number;              // CPU usage percentage
  memory: number;           // Memory usage in bytes
  gpuMemory?: number;       // GPU memory usage in bytes
  network: {
    bytesIn: number;
    bytesOut: number;
  };
}