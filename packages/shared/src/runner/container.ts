// Container Management Types
import type { ResourceLimits } from './api.js';

export interface ContainerConfiguration {
  image: string;            // Docker image to use
  command?: string[];       // Override command
  environment: Record<string, string>;
  volumes: VolumeMount[];
  ports: PortMapping[];
  resources: ResourceLimits;
  network?: NetworkConfiguration;
  devices?: DeviceMapping[];
}

export interface VolumeMount {
  source: string;           // Host path or volume name
  target: string;           // Container path
  readonly?: boolean;
}

export interface PortMapping {
  host: number;
  container: number;
  protocol?: 'tcp' | 'udp';
}

export interface NetworkConfiguration {
  mode: 'bridge' | 'host' | 'none';
  extraHosts?: Record<string, string>;
}

export interface DeviceMapping {
  host: string;             // Host device path
  container: string;        // Container device path
  permissions?: string;     // Device permissions (e.g., 'rwm')
}

// Re-export from api.ts
export type { ResourceLimits, DisplayConfiguration, WineConfiguration } from './api.js';