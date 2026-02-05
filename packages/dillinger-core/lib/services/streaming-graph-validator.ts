import fs from 'fs';
import type {
  StreamingGraphDefinition,
  StreamingGraphPreset,
  StreamingGraphStore,
  StreamingGraphValidationCache,
  StreamingGraphValidationIssue,
} from '@dillinger/shared';

const REQUIRED_ATTRIBUTES: Record<string, string[]> = {
  VirtualMonitor: ['width', 'height', 'refreshRate'],
  VideoEncoder: ['codec', 'bitrate'],
  AudioEncoder: ['codec', 'bitrate'],
  SunshineSink: ['ports'],
  WebRTCSink: ['whipUrl'],
  RTMPTwitchSink: ['endpoint', 'streamKeyRef'],
  FileRecordingSink: ['path', 'container'],
};

function getNodeById(graph: StreamingGraphDefinition, id: string) {
  return graph.nodes.find((node) => node.id === id);
}

function validatePreset(preset: StreamingGraphPreset): StreamingGraphValidationIssue[] {
  const issues: StreamingGraphValidationIssue[] = [];
  const graph = preset.graph;

  const nodeIds = new Set<string>();
  for (const node of graph.nodes) {
    if (nodeIds.has(node.id)) {
      issues.push({
        severity: 'blocking',
        nodeId: node.id,
        message: `Duplicate node id: ${node.id}`,
      });
    }
    nodeIds.add(node.id);

    const required = REQUIRED_ATTRIBUTES[node.type];
    if (required && required.length > 0) {
      const attrs = node.attributes ?? {};
      for (const key of required) {
        if (!(key in attrs)) {
          issues.push({
            severity: 'blocking',
            nodeId: node.id,
            message: `Missing required attribute "${key}" for ${node.type}`,
            suggestedFix: `Provide ${key} in node attributes.`,
          });
        }
      }
    }
  }

  const edgeIds = new Set<string>();
  for (const edge of graph.edges) {
    if (edgeIds.has(edge.id)) {
      issues.push({
        severity: 'blocking',
        edgeId: edge.id,
        message: `Duplicate edge id: ${edge.id}`,
      });
    }
    edgeIds.add(edge.id);

    const fromNode = getNodeById(graph, edge.from);
    const toNode = getNodeById(graph, edge.to);
    if (!fromNode) {
      issues.push({
        severity: 'blocking',
        edgeId: edge.id,
        message: `Edge references missing source node: ${edge.from}`,
      });
    }
    if (!toNode) {
      issues.push({
        severity: 'blocking',
        edgeId: edge.id,
        message: `Edge references missing target node: ${edge.to}`,
      });
    }

    if (fromNode?.outputs?.length && toNode?.inputs?.length) {
      const fromPort = fromNode.outputs.find((port) => port.id === edge.out);
      const toPort = toNode.inputs.find((port) => port.id === edge.in);
      if (!fromPort) {
        issues.push({
          severity: 'blocking',
          edgeId: edge.id,
          message: `Edge references missing output port: ${edge.out}`,
        });
      }
      if (!toPort) {
        issues.push({
          severity: 'blocking',
          edgeId: edge.id,
          message: `Edge references missing input port: ${edge.in}`,
        });
      }
      if (fromPort && toPort && fromPort.contract.mediaType !== toPort.contract.mediaType) {
        issues.push({
          severity: 'blocking',
          edgeId: edge.id,
          message: `Port type mismatch: ${fromPort.contract.mediaType} → ${toPort.contract.mediaType}`,
        });
      }
    }
  }

  return issues;
}

function runDeviceChecks(): Record<string, 'ok' | 'missing' | 'error'> {
  const checks: Record<string, 'ok' | 'missing' | 'error'> = {
    drm: fs.existsSync('/dev/dri') ? 'ok' : 'missing',
    uinput: fs.existsSync('/dev/uinput') ? 'ok' : 'missing',
    pulse: fs.existsSync('/run/dillinger/pulse-socket') ? 'ok' : 'missing',
  };
  return checks;
}

export function validateGraphStore(store: StreamingGraphStore): StreamingGraphValidationCache {
  const issues: StreamingGraphValidationIssue[] = [];
  const ids = new Set<string>();
  for (const preset of store.presets) {
    if (ids.has(preset.id)) {
      issues.push({
        severity: 'blocking',
        message: `Duplicate preset id: ${preset.id}`,
      });
    }
    ids.add(preset.id);
    issues.push(...validatePreset(preset));
  }

  if (!store.defaultPresetId || !ids.has(store.defaultPresetId)) {
    issues.push({
      severity: 'blocking',
      message: 'defaultPresetId must reference an existing preset',
      suggestedFix: 'Set defaultPresetId to a valid preset id.',
    });
  }

  const deviceChecks = runDeviceChecks();
  if (deviceChecks.drm !== 'ok') {
    issues.push({ severity: 'blocking', message: 'DRM devices not available (/dev/dri)' });
  }
  if (deviceChecks.uinput !== 'ok') {
    issues.push({ severity: 'blocking', message: 'uinput device not available (/dev/uinput)' });
  }

  const status = issues.some((issue) => issue.severity === 'blocking')
    ? 'blocking'
    : issues.length > 0
      ? 'warning'
      : 'ok';

  return {
    lastRunAt: new Date().toISOString(),
    status,
    issues,
    deviceChecks,
  };
}
