// Session Management Types
import type { LaunchConfiguration, ResourceUsage } from './api.js';

export interface RunnerSession {
  id: string;               // UUID v4
  gameId: string;           // Reference to game being run
  containerId?: string;     // Docker container ID
  status: RunnerSessionStatus;
  configuration: LaunchConfiguration;
  startTime: string;        // ISO timestamp
  lastActivity: string;     // ISO timestamp
  endTime?: string;         // ISO timestamp when session ended
  resources: ResourceUsage;
  metadata: SessionMetadata;
}

export type RunnerSessionStatus = 
  | 'starting'    // Container is being created
  | 'running'     // Game is active
  | 'paused'      // Game is paused/suspended
  | 'stopping'    // Cleanup in progress
  | 'stopped'     // Session ended normally
  | 'error';      // Session failed

export interface SessionMetadata {
  clientIp?: string;
  userAgent?: string;
  streamingMethod: 'webrtc' | 'websocket' | 'direct';
  displayServer: 'x11' | 'wayland';
  audioMethod?: 'pulseaudio' | 'alsa' | 'none';
}

export interface SessionEvent {
  sessionId: string;
  type: SessionEventType;
  timestamp: string;
  data?: Record<string, any>;
}

export type SessionEventType =
  | 'session_created'
  | 'game_started'
  | 'game_paused'
  | 'game_resumed'
  | 'stream_connected'
  | 'stream_disconnected'
  | 'resource_warning'
  | 'session_timeout'
  | 'session_ended'
  | 'error_occurred';

// Re-export from api.ts for convenience
export type { LaunchConfiguration, DisplayConfiguration, ResourceLimits, ResourceUsage } from './api.js';