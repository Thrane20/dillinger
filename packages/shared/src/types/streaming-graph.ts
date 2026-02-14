// Streaming graph types for node-based streaming

import type { VersionedData } from './schema-version.js';

export type GraphPortType =
  | 'video/raw'
  | 'video/encoded'
  | 'audio/raw'
  | 'audio/encoded'
  | 'input/events'
  | 'control'
  | 'clock'
  | 'timing';

export interface GraphPortContract {
  mediaType: GraphPortType;
  caps?: Record<string, unknown>;
}

export interface GraphPortDefinition {
  id: string;
  label?: string;
  contract: GraphPortContract;
  required?: boolean;
}

export interface GraphNodeRuntimeHints {
  location?: 'host' | 'sidecar' | 'runner';
  privileges?: string[];
  devices?: string[];
  network?: 'host' | 'bridge';
}

export interface GraphNodeDefinition {
  id: string;
  type: string;
  displayName: string;
  inputs?: GraphPortDefinition[];
  outputs?: GraphPortDefinition[];
  attributes?: Record<string, unknown>;
  runtime?: GraphNodeRuntimeHints;
}

export interface GraphEdgeDefinition {
  id: string;
  from: string;
  out: string;
  to: string;
  in: string;
}

export interface StreamingGraphDefinition {
  nodes: GraphNodeDefinition[];
  edges: GraphEdgeDefinition[];
}

export interface StreamingGraphValidationIssue {
  severity: 'warning' | 'blocking';
  message: string;
  nodeId?: string;
  edgeId?: string;
  suggestedFix?: string;
}

export interface StreamingGraphValidationCache {
  lastRunAt?: string;
  status: 'ok' | 'warning' | 'blocking' | 'unknown';
  issues: StreamingGraphValidationIssue[];
  deviceChecks?: Record<string, 'ok' | 'missing' | 'error'>;
}

export interface StreamingGraphPreset {
  id: string;
  name: string;
  description?: string;
  isFactory?: boolean;
  createdAt: string;
  updatedAt: string;
  graph: StreamingGraphDefinition;
}

export interface StreamingGraphStore extends VersionedData {
  nodeSchemaVersions: Record<string, string>;
  defaultPresetId: string;
  presets: StreamingGraphPreset[];
  validation: StreamingGraphValidationCache;
}

export const DEFAULT_STREAMING_GRAPH_STORE: StreamingGraphStore = {
  schemaVersion: '1.0',
  nodeSchemaVersions: {},
  defaultPresetId: 'preset-default',
  validation: {
    status: 'unknown',
    issues: [],
  },
  presets: [
    {
      id: 'preset-default',
      name: 'Moonlight Gaming',
      isFactory: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      graph: {
        nodes: [
          {
            id: 'launch',
            type: 'GameLaunch',
            displayName: 'Launch',
            outputs: [
              { id: 'control', label: 'Control', contract: { mediaType: 'control' } },
            ],
            attributes: {
              launchMode: 'auto',
              workingDir: '/games',
            },
          },
          {
            id: 'runner',
            type: 'RunnerContainer',
            displayName: 'Runner',
            inputs: [
              { id: 'control', label: 'Control', contract: { mediaType: 'control' }, required: true },
            ],
            outputs: [
              { id: 'video', label: 'Video', contract: { mediaType: 'video/raw' } },
              { id: 'audio', label: 'Audio', contract: { mediaType: 'audio/raw' } },
            ],
            attributes: {
              image: 'runner-base',
              gpu: 'auto',
            },
          },
          {
            id: 'comp',
            type: 'VirtualCompositor',
            displayName: 'Compositor',
            inputs: [
              { id: 'video', label: 'Video In', contract: { mediaType: 'video/raw' } },
            ],
            outputs: [
              { id: 'video', label: 'Video Out', contract: { mediaType: 'video/raw' } },
            ],
            attributes: {
              compositor: 'sway',
            },
          },
          {
            id: 'venc',
            type: 'VideoEncoder',
            displayName: 'Video Encode',
            inputs: [
              { id: 'video', label: 'Video In', contract: { mediaType: 'video/raw' }, required: true },
            ],
            outputs: [
              { id: 'video', label: 'Video Out', contract: { mediaType: 'video/encoded' } },
            ],
            attributes: {
              codec: 'h264',
              bitrateKbps: 30000,
              gopSeconds: 1,
              preset: 'quality',
            },
          },
          {
            id: 'aenc',
            type: 'AudioEncoder',
            displayName: 'Audio Encode',
            inputs: [
              { id: 'audio', label: 'Audio In', contract: { mediaType: 'audio/raw' }, required: true },
            ],
            outputs: [
              { id: 'audio', label: 'Audio Out', contract: { mediaType: 'audio/encoded' } },
            ],
            attributes: {
              codec: 'aac',
              bitrateKbps: 128,
              sampleRate: 48000,
              channels: 2,
            },
          },
          {
            id: 'moonlight',
            type: 'MoonlightSink',
            displayName: 'Moonlight',
            inputs: [
              { id: 'video', label: 'Video In', contract: { mediaType: 'video/encoded' }, required: true },
              { id: 'audio', label: 'Audio In', contract: { mediaType: 'audio/encoded' }, required: true },
            ],
            attributes: {
              port: 47984,
              protocol: 'moonlight',
            },
          },
        ],
        edges: [
          { id: 'edge-launch-runner', from: 'launch', out: 'control', to: 'runner', in: 'control' },
          { id: 'edge-runner-comp', from: 'runner', out: 'video', to: 'comp', in: 'video' },
          { id: 'edge-comp-venc', from: 'comp', out: 'video', to: 'venc', in: 'video' },
          { id: 'edge-runner-audio', from: 'runner', out: 'audio', to: 'aenc', in: 'audio' },
          { id: 'edge-venc-moonlight', from: 'venc', out: 'video', to: 'moonlight', in: 'video' },
          { id: 'edge-aenc-moonlight', from: 'aenc', out: 'audio', to: 'moonlight', in: 'audio' },
        ],
      },
    },
  ],
};
