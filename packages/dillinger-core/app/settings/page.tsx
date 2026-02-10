'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  addEdge,
  useEdgesState,
  useNodesState,
  Handle,
  MarkerType,
  Position,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  DEFAULT_STREAMING_GRAPH_STORE,
} from '@dillinger/shared';
import type {
  GetScraperSettingsResponse,
  UpdateScraperSettingsRequest,
  ScraperType,
  SwayProfile,
  TestPattern,
  TestStreamStatus,
  StreamingGraphPreset,
  StreamingGraphStore,
  StreamingGraphValidationCache,
  StreamingGraphDefinition,
  GraphNodeDefinition,
  GraphPortDefinition,
} from '@dillinger/shared';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Settings sections for navigation
const SETTINGS_SECTIONS = [
  { id: 'igdb', label: 'IGDB', icon: '🎮' },
  { id: 'scrapers', label: 'Other Scrapers', icon: '🔍' },
  { id: 'ai', label: 'AI Assistant', icon: '🤖' },
  { id: 'audio', label: 'Audio', icon: '🔊' },
  { id: 'platforms', label: 'Platforms', icon: '🎯' },
  { id: 'docker', label: 'Docker', icon: '🐳' },
  { id: 'gpu', label: 'GPU', icon: '💻' },
  { id: 'streaming', label: 'Streaming', icon: '📺' },
  { id: 'downloads', label: 'Downloads', icon: '📥' },
  { id: 'maintenance', label: 'Maintenance', icon: '🔧' },
  { id: 'ui', label: 'UI Settings', icon: '🎨' },
  { id: 'danger', label: 'Danger Zone', icon: '⚠️' },
];

// Per-section save success indicator component
function SaveIndicator({ show, message }: { show: boolean; message: string }) {
  if (!show) return null;
  return (
    <div className="absolute top-2 right-2 flex items-center gap-2 bg-green-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow-lg animate-pulse">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      {message}
    </div>
  );
}

type GraphNodeData = {
  label: string;
  type: string;
  attributes?: Record<string, unknown>;
  inputs?: GraphPortDefinition[];
  outputs?: GraphPortDefinition[];
};

function GraphNodeCard({ data }: NodeProps<GraphNodeData>) {
  const inputs = data.inputs ?? [];
  const outputs = data.outputs ?? [];
  const maxPorts = Math.max(inputs.length, outputs.length);
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 shadow-sm min-w-[180px]">
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{data.type}</div>
      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{data.label}</div>
      <div className="mt-2 text-[10px] text-gray-500">
        <div className="grid grid-cols-2 gap-2">
          <div className="uppercase tracking-wide text-[9px] text-gray-400">Inputs</div>
          <div className="uppercase tracking-wide text-[9px] text-gray-400 text-right">Outputs</div>
        </div>
        <div className="mt-1 space-y-1">
          {maxPorts === 0 && (
            <div className="text-[9px] text-gray-400">No ports</div>
          )}
          {Array.from({ length: maxPorts }).map((_, index) => {
            const input = inputs[index];
            const output = outputs[index];
            return (
              <div key={`port-row-${index}`} className="grid grid-cols-2 gap-2 items-center">
                <div className="relative h-4 pr-2">
                  {input && (
                    <>
                      <Handle
                        id={input.id}
                        type="target"
                        position={Position.Left}
                        className="!bg-blue-500"
                        style={{
                          top: '50%',
                          width: 10,
                          height: 10,
                          border: '2px solid white',
                        }}
                      />
                      <div className="truncate pl-3">{input.label || input.id}</div>
                    </>
                  )}
                </div>
                <div className="relative h-4 pl-2 text-right">
                  {output && (
                    <>
                      <Handle
                        id={output.id}
                        type="source"
                        position={Position.Right}
                        className="!bg-emerald-500"
                        style={{
                          top: '50%',
                          width: 10,
                          height: 10,
                          border: '2px solid white',
                        }}
                      />
                      <div className="truncate pr-3">{output.label || output.id}</div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<GetScraperSettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Per-section save indicators
  const [savedSections, setSavedSections] = useState<Record<string, string>>({});

  // Section refs for scrolling
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Active section for sidebar highlight
  const [activeSection, setActiveSection] = useState('igdb');

  const [igdbClientId, setIgdbClientId] = useState('');
  const [igdbClientSecret, setIgdbClientSecret] = useState('');
  
  // Audio settings
  const [availableAudioSinks, setAvailableAudioSinks] = useState<Array<{ id: string; name: string; description: string }>>([]);
  const [selectedAudioSink, setSelectedAudioSink] = useState('');
  
  // Docker settings
  const [autoRemoveContainers, setAutoRemoveContainers] = useState(false);

  // GPU settings
  const [gpuVendor, setGpuVendor] = useState<'auto' | 'amd' | 'nvidia'>('auto');
  
  // Download settings
  const [maxConcurrentDownloads, setMaxConcurrentDownloads] = useState(2);
  const [installerCacheMode, setInstallerCacheMode] = useState<'with_game' | 'custom_volume'>('with_game');
  const [installerCacheVolumeId, setInstallerCacheVolumeId] = useState<string>('');
  const [availableVolumes, setAvailableVolumes] = useState<Array<{ id: string; name: string; hostPath: string }>>([]);
  
  // Joystick settings
  const [joysticks, setJoysticks] = useState<Array<{ id: string; name: string; path: string }>>([]);
  const [joystickSettings, setJoystickSettings] = useState<Record<string, { deviceId: string; deviceName: string }>>({});
  const [selectedJoystickPlatform, setSelectedJoystickPlatform] = useState('arcade');

  // Maintenance
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);

  // Factory Reset (Danger Zone)
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  
  // UI Settings
  const [backdropFadeDuration, setBackdropFadeDuration] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseFloat(localStorage.getItem('backdropFadeDuration') || '0.5');
    }
    return 0.5;
  });

  // AI Settings
  const [aiOpenaiApiKey, setAiOpenaiApiKey] = useState('');
  const [aiOpenaiModel, setAiOpenaiModel] = useState('gpt-4o');
  const [aiConfigured, setAiConfigured] = useState(false);

  // Streaming Settings
  const [streamingGpuType, setStreamingGpuType] = useState<'auto' | 'amd' | 'nvidia'>('auto');
  const [streamingCodec, setStreamingCodec] = useState<'h264' | 'h265' | 'av1'>('h264');
  const [streamingQuality, setStreamingQuality] = useState<'low' | 'medium' | 'high' | 'ultra'>('high');
  const [streamingIdleTimeout, setStreamingIdleTimeout] = useState(15);
  const [streamingDefaultProfileId, setStreamingDefaultProfileId] = useState('1080p60');
  const [streamingMode, setStreamingMode] = useState<'profiles' | 'graph'>('profiles');
  const [swayProfiles, setSwayProfiles] = useState<SwayProfile[]>([]);
  const [graphStore, setGraphStore] = useState<StreamingGraphStore | null>(null);
  const [graphPresets, setGraphPresets] = useState<StreamingGraphPreset[]>([]);
  const [graphDefaultPresetId, setGraphDefaultPresetId] = useState('');
  const [graphValidation, setGraphValidation] = useState<StreamingGraphValidationCache | null>(null);
  const [showGraphEditor, setShowGraphEditor] = useState(false);
  const [graphEditorMode, setGraphEditorMode] = useState<'create' | 'edit'>('create');
  const [graphEditorPreset, setGraphEditorPreset] = useState<StreamingGraphPreset | null>(null);
  const [graphEditorError, setGraphEditorError] = useState<string | null>(null);
  const [graphEditorTab, setGraphEditorTab] = useState<'canvas' | 'json'>('canvas');
  const [graphEditorGraph, setGraphEditorGraph] = useState<StreamingGraphDefinition | null>(null);
  const [graphEditorNodes, setGraphEditorNodes, onGraphNodesChange] = useNodesState<GraphNodeData>([]);
  const [graphEditorEdges, setGraphEditorEdges, onGraphEdgesChange] = useEdgesState<Edge>([]);
  const [graphEditorSelectedNodeId, setGraphEditorSelectedNodeId] = useState<string | null>(null);
  const [graphEditorFlowInstance, setGraphEditorFlowInstance] = useState<
    ReactFlowInstance | null
  >(null);
  const [nodeDocsOpen, setNodeDocsOpen] = useState(false);
  const [showNodeContextMenu, setShowNodeContextMenu] = useState(false);
  const [nodeContextMenuTarget, setNodeContextMenuTarget] = useState<string | null>(null);
  const [nodeContextMenuPosition, setNodeContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const graphCanvasRef = useRef<HTMLDivElement | null>(null);
  const [showAddNodeModal, setShowAddNodeModal] = useState(false);
  const [addNodePosition, setAddNodePosition] = useState<{ x: number; y: number } | null>(null);
  const [addNodeType, setAddNodeType] = useState('');
  const [graphEditorForm, setGraphEditorForm] = useState({
    id: '',
    name: '',
    description: '',
    graphJson: '',
  });

  const hasActiveGraphPreset = graphEditorMode === 'create' || !!graphEditorPreset;
  const [testStreamStatus, setTestStreamStatus] = useState<TestStreamStatus>({ running: false });
  const [testPattern, setTestPattern] = useState<TestPattern>('smpte');
  const [testProfileId, setTestProfileId] = useState('1080p60');
  const [testLoading, setTestLoading] = useState(false);
  const [pairingPin, setPairingPin] = useState('');
  const [pairingLoading, setPairingLoading] = useState(false);
  const [pairingMessage, setPairingMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pairingStatus, setPairingStatus] = useState<{ ready: boolean; message?: string } | null>(null);
  const [pairingStatusLoading, setPairingStatusLoading] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<SwayProfile | null>(null);
  const streamingSettingsLoadedRef = useRef(false);
  const streamingSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [streamingAutoSaveStatus, setStreamingAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [profileFormData, setProfileFormData] = useState({
    id: '',
    name: '',
    description: '',
    width: 1920,
    height: 1080,
    refreshRate: 60,
    customConfig: '',
  });

  // Helper to show save indicator for a section
  const showSaveIndicator = (sectionId: string, message: string = 'Saved!') => {
    setSavedSections(prev => ({ ...prev, [sectionId]: message }));
    setTimeout(() => {
      setSavedSections(prev => {
        const newState = { ...prev };
        delete newState[sectionId];
        return newState;
      });
    }, 2000);
  };

  // Scroll to section when clicking sidebar
  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const element = sectionRefs.current[sectionId];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Intersection observer for active section tracking
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.3, rootMargin: '-100px 0px -50% 0px' }
    );

    Object.values(sectionRefs.current).forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, [loading]);

  useEffect(() => {
    loadSettings();
    loadAudioSettings();
    loadDockerSettings();
    loadGpuSettings();
    loadDownloadSettings();
    loadJoystickSettings();
    loadAiSettings();
    loadStreamingSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/settings/scrapers`);
      if (!response.ok) {
        throw new Error('Failed to load settings');
      }
      const data: GetScraperSettingsResponse = await response.json();
      setSettings(data);
      
      // Populate IGDB credentials if they exist
      if (data.settings?.igdb) {
        setIgdbClientId(data.settings.igdb.clientId || '');
        setIgdbClientSecret(data.settings.igdb.clientSecret || '');
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const loadAudioSettings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/settings/audio`);
      if (!response.ok) {
        throw new Error('Failed to load audio settings');
      }
      const data = await response.json();
      setAvailableAudioSinks(data.availableSinks || []);
      setSelectedAudioSink(data.settings?.defaultSink || '');
    } catch (error) {
      console.error('Failed to load audio settings:', error);
    }
  };

  const saveIgdbSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!igdbClientId || !igdbClientSecret) {
      setMessage({ type: 'error', text: 'Please fill in all fields' });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);

      const payload: UpdateScraperSettingsRequest = {
        scraperType: 'igdb' as ScraperType,
        credentials: {
          clientId: igdbClientId,
          clientSecret: igdbClientSecret,
        },
      };

      const response = await fetch(`${API_BASE_URL}/api/settings/scrapers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      showSaveIndicator('igdb', 'IGDB settings saved!');
      setIgdbClientId('');
      setIgdbClientSecret('');
      
      // Reload settings to update UI
      await loadSettings();
    } catch (error) {
      console.error('Failed to save settings:', error);
      setMessage({ type: 'error', text: 'Failed to save IGDB settings' });
    } finally {
      setSaving(false);
    }
  };

  const loadDockerSettings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/settings/docker`);
      if (!response.ok) {
        throw new Error('Failed to load Docker settings');
      }
      const data = await response.json();
      setAutoRemoveContainers(data.settings?.autoRemoveContainers || false);
    } catch (error) {
      console.error('Failed to load Docker settings:', error);
    }
  };

  const loadGpuSettings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/settings/gpu`);
      if (!response.ok) {
        throw new Error('Failed to load GPU settings');
      }
      const data = await response.json();
      const vendor = data.settings?.vendor;
      if (vendor === 'amd' || vendor === 'nvidia' || vendor === 'auto') {
        setGpuVendor(vendor);
      } else {
        setGpuVendor('auto');
      }
    } catch (error) {
      console.error('Failed to load GPU settings:', error);
    }
  };

  const loadDownloadSettings = async () => {
    try {
      // Load download settings
      const response = await fetch(`${API_BASE_URL}/api/settings/downloads`);
      if (!response.ok) {
        throw new Error('Failed to load download settings');
      }
      const data = await response.json();
      setMaxConcurrentDownloads(data.settings?.maxConcurrent || 2);
      setInstallerCacheMode(data.settings?.installerCacheMode || 'with_game');
      setInstallerCacheVolumeId(data.settings?.installerCacheVolumeId || '');
      
      // Load available volumes for the dropdown
      const volumesResponse = await fetch(`${API_BASE_URL}/api/volumes`);
      if (volumesResponse.ok) {
        const volumesData = await volumesResponse.json();
        setAvailableVolumes(volumesData.data || []);
      }
    } catch (error) {
      console.error('Failed to load download settings:', error);
    }
  };

  const loadAiSettings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/settings/ai`);
      if (!response.ok) {
        throw new Error('Failed to load AI settings');
      }
      const data = await response.json();
      setAiConfigured(data.configured || false);
      if (data.settings?.openai) {
        setAiOpenaiApiKey(data.settings.openai.apiKey || '');
        setAiOpenaiModel(data.settings.openai.model || 'gpt-4o');
      }
    } catch (error) {
      console.error('Failed to load AI settings:', error);
    }
  };

  const saveAiSettings = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const response = await fetch(`${API_BASE_URL}/api/settings/ai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: 'openai',
          openaiApiKey: aiOpenaiApiKey,
          openaiModel: aiOpenaiModel,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save AI settings');
      }

      showSaveIndicator('ai', 'AI settings saved!');
      await loadAiSettings();
    } catch (error) {
      console.error('Failed to save AI settings:', error);
      setMessage({ type: 'error', text: 'Failed to save AI settings' });
    } finally {
      setSaving(false);
    }
  };

  // ============================================================================
  // Streaming Settings Functions
  // ============================================================================

  const graphNodeTypes = useMemo(() => ({ graphNode: GraphNodeCard }), []);
  
  type NodeDefaults = {
    inputs: GraphPortDefinition[];
    outputs: GraphPortDefinition[];
    attributes: Record<string, unknown>;
  };
  
  const nodeDefaultsByType = useMemo<Record<string, NodeDefaults>>(
    () => ({
      SessionRoot: {
        inputs: [],
        outputs: [
          { id: 'control', label: 'Control', contract: { mediaType: 'control' }, required: true },
          { id: 'clock', label: 'Clock', contract: { mediaType: 'clock' } },
        ],
        attributes: {},
      },
      RunnerContainer: {
        inputs: [
          { id: 'control', label: 'Control', contract: { mediaType: 'control' }, required: true },
        ],
        outputs: [
          { id: 'control', label: 'Control', contract: { mediaType: 'control' } },
          { id: 'video', label: 'Video', contract: { mediaType: 'video/raw' } },
          { id: 'audio', label: 'Audio', contract: { mediaType: 'audio/raw' } },
        ],
        attributes: {
          image: 'runner-base',
          gpu: 'auto',
        },
      },
      GameLaunch: {
        inputs: [],
        outputs: [
          { id: 'control', label: 'Control', contract: { mediaType: 'control' } },
        ],
        attributes: {
          launchMode: 'auto',
          workingDir: '/games',
        },
      },
      VirtualCompositor: {
        inputs: [{ id: 'video', label: 'Video In', contract: { mediaType: 'video/raw' } }],
        outputs: [{ id: 'video', label: 'Video Out', contract: { mediaType: 'video/raw' } }],
        attributes: { compositor: 'sway' },
      },
      VirtualMonitor: {
        inputs: [{ id: 'video', label: 'Video In', contract: { mediaType: 'video/raw' } }],
        outputs: [{ id: 'video', label: 'Video Out', contract: { mediaType: 'video/raw' } }],
        attributes: { width: 1920, height: 1080, refreshRate: 60 },
      },
      VideoCapture: {
        inputs: [{ id: 'video', label: 'Video In', contract: { mediaType: 'video/raw' } }],
        outputs: [{ id: 'video', label: 'Video Out', contract: { mediaType: 'video/raw' } }],
        attributes: { source: 'monitor', fps: 60 },
      },
      VideoEncoder: {
        inputs: [
          { id: 'video', label: 'Video In', contract: { mediaType: 'video/raw' }, required: true },
        ],
        outputs: [{ id: 'video', label: 'Video Out', contract: { mediaType: 'video/encoded' } }],
        attributes: { codec: 'h264', bitrateKbps: 30000, gopSeconds: 1, preset: 'quality' },
      },
      AudioEncoder: {
        inputs: [
          { id: 'audio', label: 'Audio In', contract: { mediaType: 'audio/raw' }, required: true },
        ],
        outputs: [{ id: 'audio', label: 'Audio Out', contract: { mediaType: 'audio/encoded' } }],
        attributes: { codec: 'aac', bitrateKbps: 128, sampleRate: 48000, channels: 2 },
      },
      VideoTee: {
        inputs: [
          { id: 'video', label: 'Video In', contract: { mediaType: 'video/raw' }, required: true },
        ],
        outputs: [
          { id: 'stream', label: 'Stream Out', contract: { mediaType: 'video/raw' } },
          { id: 'preview', label: 'Preview Out', contract: { mediaType: 'video/raw' } },
        ],
        attributes: {},
      },
      AudioTee: {
        inputs: [
          { id: 'audio', label: 'Audio In', contract: { mediaType: 'audio/raw' }, required: true },
        ],
        outputs: [
          { id: 'stream', label: 'Stream Out', contract: { mediaType: 'audio/raw' } },
          { id: 'monitor', label: 'Monitor Out', contract: { mediaType: 'audio/raw' } },
        ],
        attributes: {},
      },
      SunshineSink: {
        inputs: [
          { id: 'video', label: 'Video In', contract: { mediaType: 'video/encoded' }, required: true },
          { id: 'audio', label: 'Audio In', contract: { mediaType: 'audio/encoded' }, required: true },
          { id: 'input', label: 'Input In', contract: { mediaType: 'input/events' } },
        ],
        outputs: [],
        attributes: { port: 47984, protocol: 'moonlight' },
      },
      InputSource: {
        inputs: [],
        outputs: [{ id: 'input', label: 'Input Out', contract: { mediaType: 'input/events' } }],
        attributes: { source: 'moonlight' },
      },
      InputMapper: {
        inputs: [
          { id: 'input', label: 'Input In', contract: { mediaType: 'input/events' }, required: true },
        ],
        outputs: [{ id: 'input', label: 'Input Out', contract: { mediaType: 'input/events' } }],
        attributes: { layout: 'xinput' },
      },
      InputInjector: {
        inputs: [
          { id: 'input', label: 'Input In', contract: { mediaType: 'input/events' }, required: true },
        ],
        outputs: [],
        attributes: { target: 'runner' },
      },
      CustomNode: {
        inputs: [],
        outputs: [],
        attributes: {},
      },
    }),
    []
  );

  const availableGraphNodeTypes = useMemo(() => {
    const types = new Set<string>();
    graphStore?.presets.forEach((preset) => {
      preset.graph.nodes.forEach((node) => types.add(node.type));
    });
    if (types.size === 0) {
      [
        'SessionRoot',
        'RunnerContainer',
        'GameLaunch',
        'VirtualCompositor',
        'VirtualMonitor',
        'VideoCapture',
        'VideoEncoder',
        'AudioEncoder',
        'VideoTee',
        'AudioTee',
        'SunshineSink',
        'InputSource',
        'InputMapper',
        'InputInjector',
      ].forEach((type) => types.add(type));
    }
    return Array.from(types).sort();
  }, [graphStore]);

  const nodeDocsByType: Record<string, string> = useMemo(
    () => ({
      SessionRoot: 'Entry point for a streaming session. Coordinates the overall graph lifecycle.',
      RunnerContainer: 'Represents the game runner container and its runtime configuration.',
      GameLaunch: 'Launches the selected game process in the runner environment.',
      VirtualCompositor: 'Creates a compositor surface for game rendering in the streaming stack.',
      VirtualMonitor: 'Defines the virtual display target used for capture and encoding.',
      VideoCapture: 'Captures frames from the compositor/monitor for encoding.',
      VideoEncoder: 'Encodes video frames using the configured codec/GPU pipeline.',
      AudioEncoder: 'Encodes audio samples for streaming.',
      VideoTee: 'Splits video frames to multiple sinks/outputs.',
      AudioTee: 'Splits audio samples to multiple sinks/outputs.',
      SunshineSink: 'Publishes encoded streams to the Sunshine/Moonlight endpoint.',
      InputSource: 'Receives input events from streaming clients.',
      InputMapper: 'Maps/normalizes input events for the target runner.',
      InputInjector: 'Injects input events into the runner/container.',
      CustomNode: 'Generic node placeholder for custom integrations.',
    }),
    []
  );

  const buildFlowFromGraph = (graph: StreamingGraphDefinition): { nodes: Node<GraphNodeData>[]; edges: Edge[] } => {
    const nodes: Node<GraphNodeData>[] = graph.nodes.map((node, index) => {
      const defaults = nodeDefaultsByType[node.type] || nodeDefaultsByType.CustomNode;
      const mergedAttributes: Record<string, unknown> = {
        ...(defaults?.attributes ?? {}),
        ...(node.attributes ?? {}),
      };
      const position =
        (mergedAttributes as { position?: { x: number; y: number } }).position ?? {
          x: (index % 4) * 220,
          y: Math.floor(index / 4) * 140,
        };
      
      const inputs: GraphPortDefinition[] = node.inputs && node.inputs.length > 0 
        ? node.inputs 
        : (defaults?.inputs ?? []);
      const outputs: GraphPortDefinition[] = node.outputs && node.outputs.length > 0 
        ? node.outputs 
        : (defaults?.outputs ?? []);

      return {
        id: node.id,
        type: 'graphNode',
        data: {
          label: node.displayName,
          type: node.type,
          attributes: mergedAttributes,
          inputs,
          outputs,
        },
        position,
      };
    });

    const edges = graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.from,
      target: edge.to,
      sourceHandle: edge.out,
      targetHandle: edge.in,
      markerEnd: { type: MarkerType.ArrowClosed },
    })) satisfies Edge[];

    return { nodes, edges };
  };

  const hydrateGraphFromFlow = (
    graph: StreamingGraphDefinition,
    nodes: Node<GraphNodeData>[],
    edges: Edge[]
  ): StreamingGraphDefinition => {
    const nodeLookup = new Map<string, GraphNodeDefinition>();
    graph.nodes.forEach((node) => nodeLookup.set(node.id, node));

    const nextNodes: GraphNodeDefinition[] = nodes.map((node) => {
      const existing = nodeLookup.get(node.id);
      const data = node.data as GraphNodeData;
      const defaults = nodeDefaultsByType[data.type || existing?.type || 'CustomNode'] ||
        nodeDefaultsByType.CustomNode;
      const mergedAttributes = {
        ...(defaults?.attributes ?? {}),
        ...(existing?.attributes ?? {}),
        ...(data.attributes ?? {}),
        position: node.position,
      };
      return {
        id: node.id,
        type: data.type || existing?.type || 'Node',
        displayName: data.label || existing?.displayName || node.id,
        inputs: (data.inputs && data.inputs.length > 0 ? data.inputs : defaults?.inputs) ??
          existing?.inputs,
        outputs: (data.outputs && data.outputs.length > 0 ? data.outputs : defaults?.outputs) ??
          existing?.outputs,
        runtime: existing?.runtime,
        attributes: mergedAttributes,
      };
    });

    const nextEdges = edges.map((edge) => ({
      id: edge.id,
      from: edge.source,
      out: edge.sourceHandle || 'out',
      to: edge.target,
      in: edge.targetHandle || 'in',
    }));

    return {
      nodes: nextNodes,
      edges: nextEdges,
    };
  };

  const loadStreamingSettings = async () => {
    try {
      // Load streaming settings
      const settingsResponse = await fetch(`${API_BASE_URL}/api/settings/streaming`);
      if (settingsResponse.ok) {
        const data = await settingsResponse.json();
        if (data.settings) {
          setStreamingMode(data.settings.streamingMode || 'profiles');
          setStreamingGpuType(data.settings.gpuType || 'auto');
          setStreamingCodec(data.settings.codec || 'h264');
          setStreamingQuality(data.settings.quality || 'high');
          setStreamingIdleTimeout(data.settings.idleTimeoutMinutes ?? 15);
          setStreamingDefaultProfileId(data.settings.defaultProfileId || '1080p60');
        }
      }

      // Load Sway profiles
      const profilesResponse = await fetch(`${API_BASE_URL}/api/settings/sway-configs`);
      if (profilesResponse.ok) {
        const data = await profilesResponse.json();
        setSwayProfiles(data.profiles || []);
        if (data.profiles?.length > 0 && !testProfileId) {
          setTestProfileId(data.profiles[0].id);
        }
      }

      // Load test stream status
      const testResponse = await fetch(`${API_BASE_URL}/api/streaming/test`);
      if (testResponse.ok) {
        const data = await testResponse.json();
        setTestStreamStatus(data.status || { running: false });
      }

      // Load streaming graph store
      const graphResponse = await fetch(`${API_BASE_URL}/api/streaming/graph`);
      if (graphResponse.ok) {
        const data = await graphResponse.json();
        if (data.store) {
          setGraphStore(data.store);
          setGraphPresets(data.store.presets || []);
          setGraphDefaultPresetId(data.store.defaultPresetId || '');
          setGraphValidation(data.store.validation || null);
        }
      }

      streamingSettingsLoadedRef.current = true;
    } catch (error) {
      console.error('Failed to load streaming settings:', error);
    }
  };

  const saveStreamingSettings = async () => {
    try {
      setSaving(true);
      setMessage(null);
      setStreamingAutoSaveStatus('saving');

      const response = await fetch(`${API_BASE_URL}/api/settings/streaming`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          streamingMode,
          gpuType: streamingGpuType,
          codec: streamingCodec,
          quality: streamingQuality,
          idleTimeoutMinutes: streamingIdleTimeout,
          defaultProfileId: streamingDefaultProfileId,
        }),
      });

      if (!response.ok) throw new Error('Failed to save streaming settings');
      showSaveIndicator('streaming', 'Streaming settings saved!');
      setStreamingAutoSaveStatus('saved');
      setTimeout(() => setStreamingAutoSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save streaming settings:', error);
      setMessage({ type: 'error', text: 'Failed to save streaming settings' });
      setStreamingAutoSaveStatus('error');
      setTimeout(() => setStreamingAutoSaveStatus('idle'), 3000);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!streamingSettingsLoadedRef.current) return;
    if (streamingSaveTimeoutRef.current) {
      clearTimeout(streamingSaveTimeoutRef.current);
    }
    streamingSaveTimeoutRef.current = setTimeout(() => {
      saveStreamingSettings();
    }, 500);

    return () => {
      if (streamingSaveTimeoutRef.current) {
        clearTimeout(streamingSaveTimeoutRef.current);
      }
    };
  }, [
    streamingMode,
    streamingGpuType,
    streamingCodec,
    streamingQuality,
    streamingIdleTimeout,
    streamingDefaultProfileId,
  ]);

  const saveStreamingGraphDefaults = async (presetId?: string) => {
    if (!graphStore) return;
    try {
      setSaving(true);
      setMessage(null);

      const nextDefaultId = presetId ?? graphDefaultPresetId;
      if (presetId) {
        setGraphDefaultPresetId(presetId);
      }

      const nextStore: StreamingGraphStore = {
        ...graphStore,
        defaultPresetId: nextDefaultId,
      };

      const response = await fetch(`${API_BASE_URL}/api/streaming/graph`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextStore),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to save streaming graph defaults');
      }

      setGraphStore(nextStore);
      showSaveIndicator('streaming', 'Streaming graph defaults saved!');
    } catch (error) {
      console.error('Failed to save streaming graph defaults:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to save streaming graph defaults' });
    } finally {
      setSaving(false);
    }
  };

  const validateStreamingGraph = async () => {
    try {
      setSaving(true);
      const response = await fetch(`${API_BASE_URL}/api/streaming/graph/validate`, {
        method: 'POST',
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to validate streaming graph');
      }

      setGraphValidation(data.validation || null);
      showSaveIndicator('streaming', 'Graph validation updated');
    } catch (error) {
      console.error('Failed to validate streaming graph:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to validate streaming graph' });
    } finally {
      setSaving(false);
    }
  };

  const resetStreamingGraphDefaults = async () => {
    if (!confirm('Reset streaming graph presets to defaults? This will overwrite custom presets.')) {
      return;
    }

    try {
      setSaving(true);
      setMessage(null);

      const now = new Date().toISOString();
      const nextStore: StreamingGraphStore = {
        ...DEFAULT_STREAMING_GRAPH_STORE,
        presets: DEFAULT_STREAMING_GRAPH_STORE.presets.map((preset) => ({
          ...preset,
          createdAt: now,
          updatedAt: now,
        })),
      };

      const response = await fetch(`${API_BASE_URL}/api/streaming/graph`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextStore),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to reset streaming graph presets');
      }

      await refreshGraphStore();
      if (showGraphEditor) {
        const defaultPreset = nextStore.presets.find(
          (preset) => preset.id === nextStore.defaultPresetId
        );
        openGraphEditor(defaultPreset || nextStore.presets[0]);
      }
      showSaveIndicator('streaming', 'Streaming graph reset to defaults');
    } catch (error) {
      console.error('Failed to reset streaming graph:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to reset streaming graph',
      });
    } finally {
      setSaving(false);
    }
  };

  const refreshGraphStore = async () => {
    const graphResponse = await fetch(`${API_BASE_URL}/api/streaming/graph`);
    if (!graphResponse.ok) return;
    const data = await graphResponse.json();
    if (data.store) {
      setGraphStore(data.store);
      setGraphPresets(data.store.presets || []);
      setGraphDefaultPresetId(data.store.defaultPresetId || '');
      setGraphValidation(data.store.validation || null);
    }
  };

  const openGraphEditor = (preset?: StreamingGraphPreset) => {
    if (!preset) {
      setGraphEditorMode('create');
    }
    const baseGraph =
      preset?.graph ||
      graphStore?.presets.find((entry) => entry.id === graphDefaultPresetId)?.graph ||
      graphStore?.presets[0]?.graph ||
      { nodes: [], edges: [] };

    const normalizedGraph: StreamingGraphDefinition = {
      ...baseGraph,
      nodes: baseGraph.nodes.map((node) => {
        const defaults = nodeDefaultsByType[node.type] || nodeDefaultsByType.CustomNode;
        return {
          ...node,
          inputs: node.inputs && node.inputs.length > 0 ? node.inputs : defaults?.inputs,
          outputs: node.outputs && node.outputs.length > 0 ? node.outputs : defaults?.outputs,
          attributes: {
            ...(defaults?.attributes ?? {}),
            ...(node.attributes ?? {}),
          },
        };
      }),
    };

    setGraphEditorMode(preset ? 'edit' : 'create');
    setGraphEditorPreset(preset || null);
    setGraphEditorError(null);
    setGraphEditorTab('canvas');
    setGraphEditorGraph(normalizedGraph);
    const { nodes, edges } = buildFlowFromGraph(normalizedGraph);
    setGraphEditorNodes(nodes);
    setGraphEditorEdges(edges);
    setGraphEditorSelectedNodeId(null);
    setGraphEditorForm({
      id: preset?.id || '',
      name: preset?.name || '',
      description: preset?.description || '',
      graphJson: JSON.stringify(normalizedGraph, null, 2),
    });
    setShowGraphEditor(true);
  };

  const openGraphEditorShell = () => {
    setGraphEditorMode('edit');
    setGraphEditorPreset(null);
    setGraphEditorError(null);
    setGraphEditorTab('canvas');
    setGraphEditorGraph(null);
    setGraphEditorNodes([]);
    setGraphEditorEdges([]);
    setGraphEditorSelectedNodeId(null);
    setGraphEditorForm({
      id: '',
      name: '',
      description: '',
      graphJson: '',
    });
    setShowGraphEditor(true);
  };

  const cloneGraphPreset = (preset: StreamingGraphPreset) => {
    const baseId = `${preset.id}-copy`;
    const existingIds = new Set(graphPresets.map((entry) => entry.id));
    let suffix = 1;
    let nextId = baseId;
    while (existingIds.has(nextId)) {
      suffix += 1;
      nextId = `${baseId}-${suffix}`;
    }
    const normalizedGraph: StreamingGraphDefinition = {
      ...preset.graph,
      nodes: preset.graph.nodes.map((node) => {
        const defaults = nodeDefaultsByType[node.type] || nodeDefaultsByType.CustomNode;
        return {
          ...node,
          inputs: node.inputs && node.inputs.length > 0 ? node.inputs : defaults?.inputs,
          outputs: node.outputs && node.outputs.length > 0 ? node.outputs : defaults?.outputs,
          attributes: {
            ...(defaults?.attributes ?? {}),
            ...(node.attributes ?? {}),
          },
        };
      }),
    };

    setGraphEditorMode('create');
    setGraphEditorPreset(null);
    setGraphEditorError(null);
    setGraphEditorTab('canvas');
    setGraphEditorGraph(normalizedGraph);
    const { nodes, edges } = buildFlowFromGraph(normalizedGraph);
    setGraphEditorNodes(nodes);
    setGraphEditorEdges(edges);
    setGraphEditorSelectedNodeId(null);
    setGraphEditorForm({
      id: nextId,
      name: `${preset.name} (Copy)`,
      description: preset.description || '',
      graphJson: JSON.stringify(normalizedGraph, null, 2),
    });
    setShowGraphEditor(true);
  };

  const saveGraphPreset = async () => {
    try {
      setSaving(true);
      setGraphEditorError(null);

      if (!graphEditorForm.name || (!graphEditorForm.id && graphEditorMode === 'create')) {
        setGraphEditorError('Preset id and name are required.');
        return;
      }

      let graph;
      try {
        graph = JSON.parse(graphEditorForm.graphJson);
      } catch (err) {
        setGraphEditorError('Graph JSON is invalid.');
        return;
      }

      if (graphEditorMode === 'create') {
        const response = await fetch(`${API_BASE_URL}/api/streaming/graph/presets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: graphEditorForm.id,
            name: graphEditorForm.name,
            description: graphEditorForm.description,
            graph,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || 'Failed to create preset');
        }
      } else if (graphEditorPreset) {
        const response = await fetch(`${API_BASE_URL}/api/streaming/graph/presets/${graphEditorPreset.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: graphEditorForm.name,
            description: graphEditorForm.description,
            graph,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || 'Failed to update preset');
        }
      }

      await refreshGraphStore();
      setShowGraphEditor(false);
      showSaveIndicator('streaming', 'Graph preset saved');
    } catch (error) {
      console.error('Failed to save graph preset:', error);
      setGraphEditorError(error instanceof Error ? error.message : 'Failed to save preset');
    } finally {
      setSaving(false);
    }
  };

  const deleteGraphPreset = async (preset: StreamingGraphPreset) => {
    if (preset.isFactory) {
      setGraphEditorError('Factory presets cannot be deleted.');
      return;
    }
    if (!confirm(`Delete preset “${preset.name}”? This cannot be undone.`)) return;

    try {
      setSaving(true);
      setGraphEditorError(null);
      const response = await fetch(`${API_BASE_URL}/api/streaming/graph/presets/${preset.id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete preset');
      }
      await refreshGraphStore();
      showSaveIndicator('streaming', 'Graph preset deleted');
    } catch (error) {
      console.error('Failed to delete graph preset:', error);
      setGraphEditorError(error instanceof Error ? error.message : 'Failed to delete preset');
    } finally {
      setSaving(false);
    }
  };

  const onGraphConnect = (connection: Connection) => {
    setGraphEditorEdges((edges) =>
      addEdge({ ...connection, markerEnd: { type: MarkerType.ArrowClosed } }, edges)
    );
  };

  const switchGraphEditorTab = (tab: 'canvas' | 'json') => {
    if (tab === graphEditorTab) return;
    if (tab === 'canvas') {
      try {
        const parsed = JSON.parse(graphEditorForm.graphJson || '{}') as StreamingGraphDefinition;
        setGraphEditorGraph(parsed);
        const { nodes, edges } = buildFlowFromGraph(parsed);
        setGraphEditorNodes(nodes);
        setGraphEditorEdges(edges);
        setGraphEditorError(null);
      } catch (error) {
        setGraphEditorError('Graph JSON is invalid.');
        return;
      }
    }

    if (tab === 'json' && graphEditorGraph) {
      setGraphEditorForm((prev) => ({
        ...prev,
        graphJson: JSON.stringify(graphEditorGraph, null, 2),
      }));
    }

    setGraphEditorTab(tab);
  };

  const updateSelectedNodeAttributes = (nextAttributes: Record<string, unknown>) => {
    if (!graphEditorSelectedNodeId || !graphEditorGraph) return;
    setGraphEditorGraph((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        nodes: prev.nodes.map((node) =>
          node.id === graphEditorSelectedNodeId ? { ...node, attributes: nextAttributes } : node
        ),
      };
    });
    setGraphEditorNodes((nodes) =>
      nodes.map((node) =>
        node.id === graphEditorSelectedNodeId
          ? { ...node, data: { ...node.data, attributes: nextAttributes } }
          : node
      )
    );
    setGraphEditorError(null);
  };

  const updateSelectedNodeDisplayName = (value: string) => {
    if (!graphEditorSelectedNodeId || !graphEditorGraph) return;
    setGraphEditorGraph((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        nodes: prev.nodes.map((node) =>
          node.id === graphEditorSelectedNodeId ? { ...node, displayName: value } : node
        ),
      };
    });
    setGraphEditorNodes((nodes) =>
      nodes.map((node) =>
        node.id === graphEditorSelectedNodeId
          ? { ...node, data: { ...node.data, label: value } }
          : node
      )
    );
  };

  const addGraphNode = (typeOverride?: string, positionOverride?: { x: number; y: number }) => {
    if (!graphEditorGraph) return;
    const existingIds = new Set(graphEditorGraph.nodes.map((node) => node.id));
    let index = graphEditorGraph.nodes.length + 1;
    let id = `node-${index}`;
    while (existingIds.has(id)) {
      index += 1;
      id = `node-${index}`;
    }

    const nodeType = typeOverride || 'CustomNode';
    const displayName = nodeType.replace(/([a-z])([A-Z])/g, '$1 $2');
    const position = positionOverride || { x: index * 40, y: index * 40 };

    const defaults = nodeDefaultsByType[nodeType] || nodeDefaultsByType.CustomNode;
    const nextGraph: StreamingGraphDefinition = {
      ...graphEditorGraph,
      nodes: [
        ...graphEditorGraph.nodes,
        {
          id,
          type: nodeType,
          displayName: displayName || `Node ${index}`,
          inputs: defaults?.inputs,
          outputs: defaults?.outputs,
          attributes: {
            ...(defaults?.attributes ?? {}),
            position,
          },
        },
      ],
    };

    const { nodes, edges } = buildFlowFromGraph(nextGraph);
    setGraphEditorGraph(nextGraph);
    setGraphEditorNodes(nodes);
    setGraphEditorEdges(edges);
    setGraphEditorSelectedNodeId(id);
  };

  const deleteGraphNode = (nodeId: string) => {
    if (!graphEditorGraph) return;
    const targetNode = graphEditorGraph.nodes.find((node) => node.id === nodeId);
    if (!targetNode) return;
    if (targetNode.type === 'GameLaunch') {
      setGraphEditorError('Game Launch is required and cannot be deleted.');
      return;
    }

    setGraphEditorGraph((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        nodes: prev.nodes.filter((node) => node.id !== nodeId),
        edges: prev.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId),
      };
    });
    setGraphEditorNodes((nodes) => nodes.filter((node) => node.id !== nodeId));
    setGraphEditorEdges((edges) =>
      edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
    );
    if (graphEditorSelectedNodeId === nodeId) {
      setGraphEditorSelectedNodeId(null);
    }
    setShowNodeContextMenu(false);
    setNodeContextMenuTarget(null);
  };

  const isPortCompatible = (sourcePort?: GraphPortDefinition, targetPort?: GraphPortDefinition) => {
    if (!sourcePort || !targetPort) return true;
    const sourceType = sourcePort.contract?.mediaType;
    const targetType = targetPort.contract?.mediaType;
    if (!sourceType || !targetType) return true;
    return sourceType === targetType;
  };

  const isValidGraphConnection = (connection: Connection) => {
    if (!connection.source || !connection.target) return false;
    const sourceNode = graphEditorNodes.find((node) => node.id === connection.source);
    const targetNode = graphEditorNodes.find((node) => node.id === connection.target);
    if (!sourceNode || !targetNode) return false;

    const sourcePorts = (sourceNode.data as GraphNodeData)?.outputs ?? [];
    const targetPorts = (targetNode.data as GraphNodeData)?.inputs ?? [];
    const sourcePort = sourcePorts.find((port) => port.id === connection.sourceHandle);
    const targetPort = targetPorts.find((port) => port.id === connection.targetHandle);

    return isPortCompatible(sourcePort, targetPort);
  };

  useEffect(() => {
    if (!showGraphEditor || graphEditorTab !== 'canvas' || !graphEditorGraph) return;
    const nextGraph = hydrateGraphFromFlow(graphEditorGraph, graphEditorNodes, graphEditorEdges);
    setGraphEditorGraph(nextGraph);
    setGraphEditorForm((prev) => ({
      ...prev,
      graphJson: JSON.stringify(nextGraph, null, 2),
    }));
  }, [graphEditorNodes, graphEditorEdges, graphEditorTab, showGraphEditor]);

  useEffect(() => {
    setNodeDocsOpen(false);
  }, [graphEditorSelectedNodeId]);

  const startTestStream = async (mode: 'stream' | 'x11') => {
    try {
      setTestLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/streaming/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          profileId: testProfileId,
          pattern: testPattern,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to start test stream');
      }
      setTestStreamStatus(data.status || { running: true });
    } catch (error) {
      console.error('Failed to start test stream:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to start test stream' });
    } finally {
      setTestLoading(false);
    }
  };

  const stopTestStream = async () => {
    try {
      setTestLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/streaming/test`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to stop test stream');
      setTestStreamStatus({ running: false });
    } catch (error) {
      console.error('Failed to stop test stream:', error);
    } finally {
      setTestLoading(false);
    }
  };

  const submitPairingPin = async () => {
    const normalizedPin = pairingPin.replace(/\D/g, '').slice(0, 4);
    if (normalizedPin.length !== 4) {
      setPairingMessage({ type: 'error', text: 'PIN must be 4 digits.' });
      return;
    }

    try {
      setPairingLoading(true);
      setPairingMessage(null);

      const response = await fetch(`${API_BASE_URL}/api/streaming/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pair', pin: normalizedPin }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || 'Pairing failed');
      }

      setPairingMessage({ type: 'success', text: 'Pairing successful! You can connect in Moonlight now.' });
      setPairingPin('');
      setPairingStatus({ ready: true, message: 'Moonlight client paired and ready to connect.' });
    } catch (error) {
      setPairingMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Pairing failed',
      });
    } finally {
      setPairingLoading(false);
    }
  };

  const refreshPairingStatus = async () => {
    try {
      setPairingStatusLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/streaming/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status' }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to check pairing status');
      }

      setPairingStatus({ ready: !!data.ready, message: data.message });
    } catch (error) {
      setPairingStatus({
        ready: false,
        message: error instanceof Error ? error.message : 'Failed to check pairing status',
      });
    } finally {
      setPairingStatusLoading(false);
    }
  };

  const createSwayProfile = async () => {
    try {
      setSaving(true);
      const response = await fetch(`${API_BASE_URL}/api/settings/sway-configs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileFormData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create profile');
      }

      setShowProfileModal(false);
      setProfileFormData({ id: '', name: '', description: '', width: 1920, height: 1080, refreshRate: 60, customConfig: '' });
      await loadStreamingSettings();
      showSaveIndicator('streaming', 'Profile created!');
    } catch (error) {
      console.error('Failed to create profile:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to create profile' });
    } finally {
      setSaving(false);
    }
  };

  const updateSwayProfile = async () => {
    if (!editingProfile) return;
    try {
      setSaving(true);
      const response = await fetch(`${API_BASE_URL}/api/settings/sway-configs/${editingProfile.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileFormData.name,
          description: profileFormData.description,
          width: profileFormData.width,
          height: profileFormData.height,
          refreshRate: profileFormData.refreshRate,
          customConfig: profileFormData.customConfig,
        }),
      });

      if (!response.ok) throw new Error('Failed to update profile');

      setShowProfileModal(false);
      setEditingProfile(null);
      await loadStreamingSettings();
      showSaveIndicator('streaming', 'Profile updated!');
    } catch (error) {
      console.error('Failed to update profile:', error);
      setMessage({ type: 'error', text: 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  const openProfileModal = (profile?: SwayProfile) => {
    if (profile) {
      setEditingProfile(profile);
      setProfileFormData({
        id: profile.id,
        name: profile.name,
        description: profile.description || '',
        width: profile.width,
        height: profile.height,
        refreshRate: profile.refreshRate,
        customConfig: profile.customConfig || '',
      });
    } else {
      setEditingProfile(null);
      setProfileFormData({ id: '', name: '', description: '', width: 1920, height: 1080, refreshRate: 60, customConfig: '' });
    }
    setShowProfileModal(true);
  };

  const saveDockerSettings = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const response = await fetch(`${API_BASE_URL}/api/settings/docker`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ autoRemoveContainers }),
      });

      if (!response.ok) {
        throw new Error('Failed to save Docker settings');
      }

      showSaveIndicator('docker', 'Docker settings saved!');
    } catch (error) {
      console.error('Failed to save Docker settings:', error);
      setMessage({ type: 'error', text: 'Failed to save Docker settings' });
    } finally {
      setSaving(false);
    }
  };

  const saveGpuSettings = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const response = await fetch(`${API_BASE_URL}/api/settings/gpu`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ vendor: gpuVendor }),
      });

      if (!response.ok) {
        throw new Error('Failed to save GPU settings');
      }

      showSaveIndicator('gpu', 'GPU settings saved!');
    } catch (error) {
      console.error('Failed to save GPU settings:', error);
      setMessage({ type: 'error', text: 'Failed to save GPU settings' });
    } finally {
      setSaving(false);
    }
  };

  const saveDownloadSettings = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const response = await fetch(`${API_BASE_URL}/api/settings/downloads`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          maxConcurrent: maxConcurrentDownloads,
          installerCacheMode,
          installerCacheVolumeId: installerCacheMode === 'custom_volume' ? installerCacheVolumeId : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save download settings');
      }

      showSaveIndicator('downloads', 'Download settings saved!');
    } catch (error) {
      console.error('Failed to save download settings:', error);
      setMessage({ type: 'error', text: 'Failed to save download settings' });
    } finally {
      setSaving(false);
    }
  };

  const cleanupContainers = async () => {
    try {
      setCleanupLoading(true);
      setCleanupMessage(null);

      const response = await fetch(`${API_BASE_URL}/api/settings/maintenance/cleanup-containers`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to cleanup containers');
      }

      const data = await response.json();
      setCleanupMessage(data.message);
    } catch (error) {
      console.error('Failed to cleanup containers:', error);
      setCleanupMessage('Failed to cleanup containers');
    } finally {
      setCleanupLoading(false);
    }
  };

  const cleanupVolumes = async () => {
    try {
      setCleanupLoading(true);
      setCleanupMessage(null);

      const response = await fetch(`${API_BASE_URL}/api/settings/maintenance/cleanup-volumes`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to cleanup volumes');
      }

      const data = await response.json();
      setCleanupMessage(data.message);
    } catch (error) {
      console.error('Failed to cleanup volumes:', error);
      setCleanupMessage('Failed to cleanup volumes');
    } finally {
      setCleanupLoading(false);
    }
  };

  const saveUISettings = () => {
    localStorage.setItem('backdropFadeDuration', backdropFadeDuration.toString());
    showSaveIndicator('ui', 'UI settings saved!');
    
    // Dispatch custom event to notify games page
    window.dispatchEvent(new CustomEvent('backdropSettingsChanged'));
  };

  const performFactoryReset = async () => {
    if (resetConfirmText !== 'DELETE EVERYTHING') {
      return;
    }

    try {
      setResetLoading(true);

      const response = await fetch(`${API_BASE_URL}/api/settings/maintenance/factory-reset`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to perform factory reset');
      }

      // Reset successful - redirect to home page to show setup wizard
      window.location.href = '/';
    } catch (error) {
      console.error('Factory reset failed:', error);
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to perform factory reset' 
      });
      setResetLoading(false);
      setShowResetConfirm(false);
      setResetConfirmText('');
    }
  };

  const saveAudioSettings = async () => {
    if (!selectedAudioSink) {
      setMessage({ type: 'error', text: 'Please select an audio output' });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);

      const response = await fetch(`${API_BASE_URL}/api/settings/audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ defaultSink: selectedAudioSink }),
      });

      if (!response.ok) {
        throw new Error('Failed to save audio settings');
      }

      showSaveIndicator('audio', 'Audio settings saved!');
      await loadAudioSettings();
    } catch (error) {
      console.error('Failed to save audio settings:', error);
      setMessage({ type: 'error', text: 'Failed to save audio settings' });
    } finally {
      setSaving(false);
    }
  };

  const loadJoystickSettings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/settings/joysticks`);
      if (!response.ok) {
        throw new Error('Failed to load joystick settings');
      }
      const data = await response.json();
      setJoysticks(data.available || []);
      setJoystickSettings(data.settings || {});
    } catch (error) {
      console.error('Failed to load joystick settings:', error);
    }
  };

  const saveJoystickSettings = async (platform: string, deviceId: string) => {
    try {
      setSaving(true);
      setMessage(null);

      const device = joysticks.find(j => j.id === deviceId);
      const deviceName = device?.name || 'Unknown Device';

      const response = await fetch(`${API_BASE_URL}/api/settings/joysticks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform,
          deviceId,
          deviceName
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save joystick settings');
      }

      showSaveIndicator('platforms', `Joystick for ${platform} saved!`);
      await loadJoystickSettings();
    } catch (error) {
      console.error('Failed to save joystick settings:', error);
      setMessage({ type: 'error', text: 'Failed to save joystick settings' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-xl">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Sidebar Navigation */}
      <nav className="w-56 flex-shrink-0 pr-4 h-full overflow-y-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <h2 className="text-lg font-semibold mb-4 text-text">Settings</h2>
          <ul className="space-y-1">
            {SETTINGS_SECTIONS.map((section) => (
              <li key={section.id}>
                <button
                  onClick={() => scrollToSection(section.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                    activeSection === section.id
                      ? 'bg-primary text-white'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-text'
                  }`}
                >
                  <span>{section.icon}</span>
                  <span>{section.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 h-full overflow-y-auto pl-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          {message && (
            <div
              className={`mb-6 p-4 rounded-lg ${
                message.type === 'success'
                  ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100'
                  : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100'
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Single column layout for settings sections */}
          <div className="space-y-6">
            {/* IGDB Settings */}
            <div 
              id="igdb" 
              ref={(el) => { sectionRefs.current['igdb'] = el; }}
              className="relative border border-gray-200 dark:border-gray-700 p-6 rounded-lg"
            >
            <SaveIndicator show={!!savedSections['igdb']} message={savedSections['igdb'] || ''} />
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">🎮 IGDB</h2>
              <span
                className={`px-3 py-1 rounded-full text-sm ${
                  (settings?.settings as any)?.igdb?.configured
                    ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                }`}
              >
                {(settings?.settings as any)?.igdb?.configured
                  ? 'Configured'
                  : 'Not Configured'}
              </span>
            </div>

          <p className="text-gray-600 dark:text-gray-400 mb-4">
            IGDB provides comprehensive game metadata including screenshots, descriptions, release
            dates, and more. You will need to register for a free API key at{' '}
            <a
              href="https://api-docs.igdb.com/#account-creation"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              api-docs.igdb.com
            </a>
          </p>

          <form onSubmit={saveIgdbSettings} className="space-y-4">
            <div>
              <label htmlFor="igdbClientId" className="block text-sm font-medium mb-1">
                Client ID
              </label>
              <input
                type="text"
                id="igdbClientId"
                value={igdbClientId}
                onChange={(e) => setIgdbClientId(e.target.value)}
                placeholder="Enter your IGDB Client ID"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="igdbClientSecret" className="block text-sm font-medium mb-1">
                Client Secret
              </label>
              <input
                type="password"
                id="igdbClientSecret"
                value={igdbClientSecret}
                onChange={(e) => setIgdbClientSecret(e.target.value)}
                placeholder="Enter your IGDB Client Secret"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {igdbClientSecret && igdbClientSecret.startsWith('*') && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Existing secret is hidden. Enter a new value to update it.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save IGDB Settings'}
            </button>
          </form>
          </div>

          {/* Future scrapers can be added here */}
          <div 
            id="scrapers" 
            ref={(el) => { sectionRefs.current['scrapers'] = el; }}
            className="relative border border-gray-200 dark:border-gray-700 p-6 rounded-lg"
          >
            <h2 className="text-xl font-semibold mb-4">🔍 Other Scrapers</h2>
            <p className="text-gray-600 dark:text-gray-400">
              Additional scraper integrations (SteamGridDB, Giant Bomb, etc.) will be available in
              future updates.
            </p>
          </div>

          {/* AI Assistant Settings */}
          <div 
            id="ai" 
            ref={(el) => { sectionRefs.current['ai'] = el; }}
            className="relative border border-gray-200 dark:border-gray-700 p-6 rounded-lg"
          >
            <SaveIndicator show={!!savedSections['ai']} message={savedSections['ai'] || ''} />
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">🤖 AI Assistant</h2>
              <span
                className={`px-3 py-1 rounded-full text-sm ${
                  aiConfigured
                    ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                }`}
              >
                {aiConfigured ? 'Configured' : 'Not Configured'}
              </span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Configure AI assistance for debugging Wine games. Dillinger AI can analyze container logs
              and provide recommendations for DLL overrides, winetricks, and registry settings.
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="aiOpenaiApiKey" className="block text-sm font-medium mb-1">
                  OpenAI API Key
                </label>
                <input
                  type="password"
                  id="aiOpenaiApiKey"
                  value={aiOpenaiApiKey}
                  onChange={(e) => setAiOpenaiApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Get your API key from{' '}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    platform.openai.com
                  </a>
                </p>
              </div>

              <div>
                <label htmlFor="aiOpenaiModel" className="block text-sm font-medium mb-1">
                  Model
                </label>
                <select
                  id="aiOpenaiModel"
                  value={aiOpenaiModel}
                  onChange={(e) => setAiOpenaiModel(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="gpt-4o">GPT-4o (Recommended)</option>
                  <option value="gpt-4o-mini">GPT-4o Mini (Faster/Cheaper)</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Cheapest)</option>
                </select>
              </div>

              <button
                onClick={saveAiSettings}
                disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save AI Settings'}
              </button>
            </div>
          </div>

          {/* Audio Settings */}
          <div 
            id="audio" 
            ref={(el) => { sectionRefs.current['audio'] = el; }}
            className="relative border border-gray-200 dark:border-gray-700 p-6 rounded-lg"
          >
            <SaveIndicator show={!!savedSections['audio']} message={savedSections['audio'] || ''} />
            <h2 className="text-xl font-semibold mb-4">🔊 Audio Settings</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Select the default audio output device for games. This setting will be used by all game containers.
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="audioSink" className="block text-sm font-medium mb-2">
                  Audio Output Device
                </label>
                {availableAudioSinks.length > 0 ? (
                  <select
                    id="audioSink"
                    value={selectedAudioSink}
                    onChange={(e) => setSelectedAudioSink(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                  <option value="">Select an audio output...</option>
                  {availableAudioSinks.map((sink) => (
                    <option key={sink.id} value={sink.id}>
                      {sink.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      <strong>No audio outputs detected.</strong> This can happen when:
                    </p>
                    <ul className="text-sm text-yellow-700 dark:text-yellow-300 list-disc ml-5 mt-1">
                      <li>PulseAudio/PipeWire is not running on the host</li>
                      <li>The PulseAudio socket is not mounted into the container</li>
                      <li>Running in a dev container without host audio access</li>
                    </ul>
                  </div>
                  <div>
                    <label htmlFor="manualAudioSink" className="block text-sm font-medium mb-1">
                      Manual Sink Name (optional)
                    </label>
                    <input
                      type="text"
                      id="manualAudioSink"
                      value={selectedAudioSink}
                      onChange={(e) => setSelectedAudioSink(e.target.value)}
                      placeholder="e.g., alsa_output.pci-0000_00_1f.3.analog-stereo"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Run <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">pactl list sinks short</code> on your host to find sink names.
                    </p>
                  </div>
                </div>
              )}
            </div>

              {(availableAudioSinks.length > 0 || selectedAudioSink) && (
                <button
                  onClick={saveAudioSettings}
                  disabled={saving || !selectedAudioSink}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Audio Settings'}
                </button>
              )}
            </div>
          </div>

          {/* Configure Platforms */}
          <div 
            id="platforms" 
            ref={(el) => { sectionRefs.current['platforms'] = el; }}
            className="relative border border-gray-200 dark:border-gray-700 p-6 rounded-lg"
          >
            <SaveIndicator show={!!savedSections['platforms']} message={savedSections['platforms'] || ''} />
            <h2 className="text-xl font-semibold mb-4">🎯 Configure Platforms</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Manage platform-specific settings, including joystick mapping and configuration files.
            </p>

            <div className="space-y-6">
              {/* Platform Selector */}
              <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 pb-4">
                {[
                  { id: 'arcade', label: 'Arcade' },
                  { id: 'nes', label: 'NES' },
                  { id: 'snes', label: 'SNES' },
                  { id: 'psx', label: 'PlayStation 1' },
                  { id: 'console', label: 'Console' },
                  { id: 'computer', label: 'Computer' },
                ].map((platform) => (
                  <button
                    key={platform.id}
                    onClick={() => setSelectedJoystickPlatform(platform.id)}
                    className={`px-4 py-2 rounded-lg ${
                      selectedJoystickPlatform === platform.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {platform.label}
                  </button>
                ))}
              </div>

              {/* Joystick Section */}
              <div>
                <h3 className="text-lg font-medium mb-3">Joystick Mapping</h3>
                <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">
                      Select Joystick
                    </label>
                    {joysticks.length > 0 ? (
                    <select
                      value={joystickSettings[selectedJoystickPlatform]?.deviceId || ''}
                      onChange={(e) => saveJoystickSettings(selectedJoystickPlatform, e.target.value)}
                      disabled={saving}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select a joystick...</option>
                      {joysticks.map((joystick) => (
                        <option key={joystick.id} value={joystick.id}>
                          {joystick.name} ({joystick.id})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No joysticks detected. Connect a controller and refresh the page.
                    </p>
                  )}
                </div>
                
                {joystickSettings[selectedJoystickPlatform] && (
                  <div className="text-sm text-green-600 dark:text-green-400">
                    ✓ Configured: {joystickSettings[selectedJoystickPlatform].deviceName}
                  </div>
                )}
              </div>
            </div>
            </div>
          </div>

          {/* Docker Settings */}
          <div 
            id="docker" 
            ref={(el) => { sectionRefs.current['docker'] = el; }}
            className="relative border border-gray-200 dark:border-gray-700 p-6 rounded-lg"
          >
            <SaveIndicator show={!!savedSections['docker']} message={savedSections['docker'] || ''} />
            <h2 className="text-xl font-semibold mb-4">🐳 Docker Settings</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Configure how Docker containers are managed for game sessions.
            </p>

            <div className="space-y-4">
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="autoRemove"
                    type="checkbox"
                    checked={autoRemoveContainers}
                    onChange={(e) => setAutoRemoveContainers(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="autoRemove" className="font-medium text-gray-900 dark:text-gray-100">
                    Auto-remove containers
                  </label>
                  <p className="text-gray-600 dark:text-gray-400">
                    Automatically remove game containers when they stop. Disable this to keep containers for debugging.
                  </p>
                </div>
              </div>

              <button
                onClick={saveDockerSettings}
                disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Docker Settings'}
              </button>
            </div>
          </div>

          {/* GPU Settings */}
          <div 
            id="gpu" 
            ref={(el) => { sectionRefs.current['gpu'] = el; }}
            className="relative border border-gray-200 dark:border-gray-700 p-6 rounded-lg"
          >
            <SaveIndicator show={!!savedSections['gpu']} message={savedSections['gpu'] || ''} />
            <h2 className="text-xl font-semibold mb-4">💻 GPU Settings</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Select which GPU vendor stack to prefer inside game containers. Use <span className="font-medium">Auto</span> unless you have a specific multi-GPU setup.
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="gpuVendor" className="block text-sm font-medium mb-2">
                  Preferred GPU Vendor
                </label>
                <select
                  id="gpuVendor"
                  value={gpuVendor}
                  onChange={(e) => setGpuVendor(e.target.value as any)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="auto">Auto</option>
                  <option value="amd">AMD</option>
                  <option value="nvidia">NVIDIA</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  AMD sets Vulkan ICD selection to RADV. NVIDIA support will require the NVIDIA container runtime and device nodes.
                </p>
              </div>

              <button
                onClick={saveGpuSettings}
                disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save GPU Settings'}
              </button>
            </div>
          </div>

          {/* Streaming Settings */}
          <div 
            id="streaming" 
            ref={(el) => { sectionRefs.current['streaming'] = el; }}
            className="relative border border-gray-200 dark:border-gray-700 p-6 rounded-lg"
          >
            <SaveIndicator show={!!savedSections['streaming']} message={savedSections['streaming'] || ''} />
            <h2 className="text-xl font-semibold mb-4">📺 Streaming Settings</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Configure the Dillinger streaming sidecar for Moonlight game streaming. Games can be streamed to any Moonlight-compatible client.
            </p>

            <div className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Streaming Control Mode</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Choose between basic profiles or the graph-based pipeline.
                  </p>
                </div>
                <div className="inline-flex rounded-full border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setStreamingMode('profiles')}
                    className={`px-4 py-2 text-xs font-semibold ${
                      streamingMode === 'profiles'
                        ? 'bg-gray-900 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    Profiles
                  </button>
                  <button
                    type="button"
                    onClick={() => setStreamingMode('graph')}
                    className={`px-4 py-2 text-xs font-semibold ${
                      streamingMode === 'graph'
                        ? 'bg-gray-900 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    Graphs
                  </button>
                </div>
              </div>
              {streamingAutoSaveStatus !== 'idle' && (
                <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  {streamingAutoSaveStatus === 'saving' && 'Saving streaming settings...'}
                  {streamingAutoSaveStatus === 'saved' && 'Streaming settings saved.'}
                  {streamingAutoSaveStatus === 'error' && 'Failed to save streaming settings.'}
                </div>
              )}
            </div>

            <div className="space-y-6">
              {/* GPU and Encoder Settings */}
              {streamingMode === 'profiles' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="streamingGpuType" className="block text-sm font-medium mb-2">
                    GPU for Encoding
                  </label>
                  <select
                    id="streamingGpuType"
                    value={streamingGpuType}
                    onChange={(e) => setStreamingGpuType(e.target.value as any)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="auto">Auto Detect</option>
                    <option value="amd">AMD (VA-API)</option>
                    <option value="nvidia">NVIDIA (NVENC)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="streamingCodec" className="block text-sm font-medium mb-2">
                    Video Codec
                  </label>
                  <select
                    id="streamingCodec"
                    value={streamingCodec}
                    onChange={(e) => setStreamingCodec(e.target.value as any)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="h264">H.264 (Best Compatibility)</option>
                    <option value="h265">H.265/HEVC (Better Quality)</option>
                    <option value="av1">AV1 (Best Quality, New GPUs)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="streamingQuality" className="block text-sm font-medium mb-2">
                    Quality Preset
                  </label>
                  <select
                    id="streamingQuality"
                    value={streamingQuality}
                    onChange={(e) => setStreamingQuality(e.target.value as any)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">Low (5 Mbps)</option>
                    <option value="medium">Medium (15 Mbps)</option>
                    <option value="high">High (30 Mbps)</option>
                    <option value="ultra">Ultra (50 Mbps)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="streamingIdleTimeout" className="block text-sm font-medium mb-2">
                    Auto-stop After Idle (minutes)
                  </label>
                  <input
                    type="number"
                    id="streamingIdleTimeout"
                    min="0"
                    max="1440"
                    value={streamingIdleTimeout}
                    onChange={(e) => setStreamingIdleTimeout(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    0 = never auto-stop
                  </p>
                </div>
              </div>
              )}

              {/* Default Profile */}
              {streamingMode === 'profiles' && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label htmlFor="streamingDefaultProfile" className="block text-sm font-medium">
                      Default Streaming Profile
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openProfileModal()}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg transition-colors"
                      >
                        + New Profile
                      </button>
                      <button
                        onClick={() => {
                          const profile = swayProfiles.find((item) => item.id === streamingDefaultProfileId);
                          if (profile) {
                            openProfileModal(profile);
                          }
                        }}
                        disabled={!swayProfiles.find((item) => item.id === streamingDefaultProfileId)}
                        className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs rounded-lg transition-colors disabled:opacity-50"
                      >
                        Edit Profile
                      </button>
                    </div>
                  </div>
                  <div className="mt-3">
                    <select
                      id="streamingDefaultProfile"
                      value={streamingDefaultProfileId}
                      onChange={(e) => setStreamingDefaultProfileId(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                    >
                      {swayProfiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name} ({profile.width}×{profile.height} @ {profile.refreshRate}Hz)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Streaming Graph Presets */}
              {streamingMode === 'graph' && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <h3 className="text-lg font-medium">Streaming Graph Presets</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={openGraphEditorShell}
                      className="px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-sm rounded-lg transition-colors"
                    >
                      Open Graph Editor
                    </button>
                    {graphValidation && (
                      <span
                        className={`text-xs px-2 py-1 rounded-full border ${
                          graphValidation.status === 'ok'
                            ? 'border-green-300 text-green-600 bg-green-50 dark:bg-green-900/20'
                            : graphValidation.status === 'warning'
                              ? 'border-yellow-300 text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20'
                              : 'border-red-300 text-red-600 bg-red-50 dark:bg-red-900/20'
                        }`}
                      >
                        {graphValidation.status.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Select the default streaming graph preset. Games can override this preset individually.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label htmlFor="graphDefaultPreset" className="block text-sm font-medium mb-2">
                      Default Graph Preset
                    </label>
                    <select
                      id="graphDefaultPreset"
                      value={graphDefaultPresetId}
                      onChange={(e) => {
                        const nextValue = e.target.value;
                        setGraphDefaultPresetId(nextValue);
                        saveStreamingGraphDefaults(nextValue);
                      }}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                    >
                      {graphPresets.length === 0 && (
                        <option value="">No presets available</option>
                      )}
                      {graphPresets.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.name}{preset.isFactory ? ' (Factory)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                </div>

                {graphValidation?.lastRunAt && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Last validated: {new Date(graphValidation.lastRunAt).toLocaleString()}
                  </p>
                )}
              </div>
              )}

              {/* Test Streaming Section */}
              {streamingMode === 'profiles' && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="text-lg font-medium mb-4">Test Streaming</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Verify your streaming setup with a test pattern before launching games.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label htmlFor="testProfile" className="block text-sm font-medium mb-2">
                      Profile
                    </label>
                    <select
                      id="testProfile"
                      value={testProfileId}
                      onChange={(e) => setTestProfileId(e.target.value)}
                      disabled={testStreamStatus.running}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {swayProfiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="testPattern" className="block text-sm font-medium mb-2">
                      Test Pattern
                    </label>
                    <select
                      id="testPattern"
                      value={testPattern}
                      onChange={(e) => setTestPattern(e.target.value as TestPattern)}
                      disabled={testStreamStatus.running}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="smpte">SMPTE Bars (Standard TV Test)</option>
                      <option value="bar">Color Bars</option>
                      <option value="checkerboard">Checkerboard (Motion Test)</option>
                      <option value="ball">Bouncing Ball</option>
                      <option value="snow">Snow (Random Noise)</option>
                    </select>
                  </div>
                </div>

                {testStreamStatus.running ? (
                  <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium mb-2">
                      <span className="animate-pulse">●</span>
                      Test Stream Running
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {testStreamStatus.instructions}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Mode: {testStreamStatus.mode === 'x11' ? 'Host Display' : 'Moonlight Stream'} • 
                      Pattern: {testStreamStatus.pattern} • 
                      Profile: {testStreamStatus.profileId}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Audio: 440Hz sine wave tone
                  </p>
                )}

                <div className="flex gap-3">
                  {testStreamStatus.running ? (
                    <button
                      onClick={stopTestStream}
                      disabled={testLoading}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400"
                    >
                      {testLoading ? 'Stopping...' : '■ Stop Test'}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => startTestStream('stream')}
                        disabled={testLoading}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400"
                      >
                        {testLoading ? 'Starting...' : '▶ Test to Moonlight'}
                      </button>
                      <button
                        onClick={() => startTestStream('x11')}
                        disabled={testLoading}
                        className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400"
                      >
                        {testLoading ? 'Starting...' : '▶ Test to Host Display'}
                      </button>
                    </>
                  )}
                </div>

                <div className="mt-5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Moonlight Pairing PIN</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Enter the 4-digit PIN shown in Moonlight to approve pairing without opening Sunshine.
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        Devcontainer note: pairing checks use host networking (host.docker.internal).
                      </p>
                    </div>
                    <button
                      onClick={refreshPairingStatus}
                      disabled={pairingStatusLoading}
                      className="text-xs px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-60"
                    >
                      {pairingStatusLoading ? 'Checking...' : 'Check Ready'}
                    </button>
                  </div>
                  {pairingStatus && (
                    <div className={`mb-3 text-xs ${pairingStatus.ready ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {pairingStatus.message || (pairingStatus.ready ? 'Sidecar is ready for pairing.' : 'Sidecar is not ready for pairing.')}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder="1234"
                      value={pairingPin}
                      onChange={(e) => setPairingPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      className="w-28 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={submitPairingPin}
                      disabled={pairingLoading || pairingPin.length !== 4}
                      className="bg-gray-900 hover:bg-gray-800 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400"
                    >
                      {pairingLoading ? 'Pairing...' : 'Pair Now'}
                    </button>
                  </div>
                  {pairingMessage && (
                    <div className={`mt-3 rounded-md px-3 py-2 text-sm ${pairingMessage.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-200' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-200'}`} role="status" aria-live="polite">
                      {pairingMessage.text}
                    </div>
                  )}
                </div>
              </div>
              )}
            </div>
          </div>

          {/* Streaming Graph Editor Modal */}
          {showGraphEditor && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-6xl mx-4 h-[85vh] flex flex-col border border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
                  <div>
                    <h3 className="text-xl font-semibold">Streaming Graph Editor</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Manage graph presets. This is a scaffolded JSON editor for now.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowGraphEditor(false)}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    Close
                  </button>
                </div>

                <div className="flex-1 flex flex-col min-h-0 px-6 py-5 gap-6">
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 min-h-[220px] flex flex-col">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Presets</h4>
                        <button
                          onClick={() => openGraphEditor()}
                          className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded"
                        >
                          + New Preset
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto pr-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {graphPresets.length === 0 && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              No presets yet. Create your first one.
                            </div>
                          )}
                          {graphPresets.map((preset) => (
                            <div
                              key={preset.id}
                              className={`rounded-xl border p-3 ${
                                graphEditorPreset?.id === preset.id
                                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                  : 'border-gray-200 dark:border-gray-800'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    {preset.name}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {preset.id}
                                  </div>
                                  {preset.isFactory && (
                                    <span className="mt-1 inline-flex text-[10px] px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                      Factory
                                    </span>
                                  )}
                                </div>
                                {graphDefaultPresetId === preset.id && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                                    Default
                                  </span>
                                )}
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                  onClick={() => openGraphEditor(preset)}
                                  className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-800 rounded hover:bg-gray-300 dark:hover:bg-gray-700"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => cloneGraphPreset(preset)}
                                  className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-800 rounded hover:bg-gray-300 dark:hover:bg-gray-700"
                                >
                                  Clone
                                </button>
                                <button
                                  onClick={() => saveStreamingGraphDefaults(preset.id)}
                                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                >
                                  Make Default
                                </button>
                                <button
                                  onClick={() => deleteGraphPreset(preset)}
                                  disabled={preset.isFactory}
                                  className="px-2 py-1 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 min-h-[220px] flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                          {graphEditorMode === 'create' ? 'Create Preset' : 'Edit Preset'}
                        </h4>
                        {graphEditorMode === 'edit' && graphEditorPreset?.updatedAt && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Last updated {new Date(graphEditorPreset.updatedAt).toLocaleString()}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Graph actions
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={validateStreamingGraph}
                            disabled={saving || !graphStore}
                            className="px-3 py-1.5 text-xs bg-gray-900 hover:bg-gray-800 text-white rounded"
                          >
                            {saving ? 'Validating...' : 'Run Validation'}
                          </button>
                          <button
                            onClick={resetStreamingGraphDefaults}
                            disabled={saving}
                            className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
                          >
                            {saving ? 'Resetting...' : 'Reset Graph'}
                          </button>
                        </div>
                      </div>

                      {graphEditorError && (
                        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-900/30 dark:text-red-200 px-3 py-2 text-sm">
                          {graphEditorError}
                        </div>
                      )}

                      <div className={
                        `grid grid-cols-1 md:grid-cols-2 gap-4 ${!hasActiveGraphPreset ? 'opacity-50 pointer-events-none' : ''}`
                      }>
                        <div>
                          <label className="block text-xs font-semibold mb-1">Preset ID</label>
                          <input
                            type="text"
                            value={graphEditorForm.id}
                            onChange={(e) => setGraphEditorForm({ ...graphEditorForm, id: e.target.value })}
                            disabled={graphEditorMode === 'edit'}
                            placeholder="e.g. ultra-stream"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm disabled:opacity-60"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1">Name</label>
                          <input
                            type="text"
                            value={graphEditorForm.name}
                            onChange={(e) => setGraphEditorForm({ ...graphEditorForm, name: e.target.value })}
                            placeholder="Preset name"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
                          />
                        </div>
                      </div>

                      <div className={
                        `mt-4 ${!hasActiveGraphPreset ? 'opacity-50 pointer-events-none' : ''}`
                      }>
                        <label className="block text-xs font-semibold mb-1">Description</label>
                        <input
                          type="text"
                          value={graphEditorForm.description}
                          onChange={(e) => setGraphEditorForm({ ...graphEditorForm, description: e.target.value })}
                          placeholder="Optional description"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
                        />
                      </div>

                      <div className={
                        `mt-4 flex items-center justify-between gap-3 ${!hasActiveGraphPreset ? 'opacity-50 pointer-events-none' : ''}`
                      }>
                        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => switchGraphEditorTab('canvas')}
                            className={`px-3 py-1.5 text-sm ${
                              graphEditorTab === 'canvas'
                                ? 'bg-gray-900 text-white'
                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            Canvas
                          </button>
                          <button
                            type="button"
                            onClick={() => switchGraphEditorTab('json')}
                            className={`px-3 py-1.5 text-sm ${
                              graphEditorTab === 'json'
                                ? 'bg-gray-900 text-white'
                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            JSON
                          </button>
                        </div>
                        {graphEditorTab === 'canvas' && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Right-click the canvas to add a node.
                          </div>
                        )}
                      </div>

                      <div className={
                        `mt-4 flex items-center justify-end gap-3 ${!hasActiveGraphPreset ? 'opacity-50 pointer-events-none' : ''}`
                      }>
                        <button
                          onClick={() => setShowGraphEditor(false)}
                          className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveGraphPreset}
                          disabled={saving}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm disabled:bg-gray-400"
                        >
                          {saving ? 'Saving...' : 'Save Preset'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-h-0 flex flex-col">
                    {!hasActiveGraphPreset ? (
                      <div className="mt-4 flex-1 min-h-0 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
                        <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
                          Select a preset to edit, or click “New Preset”.
                        </div>
                      </div>
                    ) : graphEditorTab === 'canvas' ? (
                      <div className="mt-4 flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[3fr,1fr] gap-4">
                        <div
                          ref={graphCanvasRef}
                          className="relative rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 h-full"
                        >
                          <ReactFlow
                            nodes={graphEditorNodes}
                            edges={graphEditorEdges}
                            onNodesChange={onGraphNodesChange}
                            onEdgesChange={onGraphEdgesChange}
                            onConnect={onGraphConnect}
                            isValidConnection={isValidGraphConnection}
                            nodeTypes={graphNodeTypes}
                            fitView
                            onNodeClick={(_, node) => setGraphEditorSelectedNodeId(node.id)}
                            onNodeContextMenu={(event, node) => {
                              event.preventDefault();
                              const container = graphCanvasRef.current;
                              if (!container) return;
                              const rect = container.getBoundingClientRect();
                              setNodeContextMenuPosition({
                                x: event.clientX - rect.left,
                                y: event.clientY - rect.top,
                              });
                              setNodeContextMenuTarget(node.id);
                              setShowNodeContextMenu(true);
                            }}
                            onPaneClick={() => {
                              setGraphEditorSelectedNodeId(null);
                              setShowNodeContextMenu(false);
                              setNodeContextMenuTarget(null);
                              setNodeContextMenuPosition(null);
                            }}
                            onPaneContextMenu={(event) => {
                              event.preventDefault();
                              setShowNodeContextMenu(false);
                              setNodeContextMenuTarget(null);
                              setNodeContextMenuPosition(null);
                              if (!graphEditorFlowInstance) return;
                              const bounds = (event.target as HTMLElement).getBoundingClientRect();
                              const position = graphEditorFlowInstance.project({
                                x: event.clientX - bounds.left,
                                y: event.clientY - bounds.top,
                              });
                              setAddNodePosition(position);
                              setAddNodeType(availableGraphNodeTypes[0] || 'CustomNode');
                              setShowAddNodeModal(true);
                            }}
                            onInit={(instance) => setGraphEditorFlowInstance(instance)}
                          >
                            <Background gap={24} size={1} color="#cbd5f5" />
                            <Controls />
                          </ReactFlow>
                          {showNodeContextMenu && nodeContextMenuTarget && (
                            <div
                              className="absolute z-20 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-lg p-2 text-sm"
                              style={{
                                left: nodeContextMenuPosition?.x ?? 0,
                                top: nodeContextMenuPosition?.y ?? 0,
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => deleteGraphNode(nodeContextMenuTarget)}
                                className="w-full text-left px-3 py-2 rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                              >
                                Delete node
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowNodeContextMenu(false);
                                  setNodeContextMenuTarget(null);
                                }}
                                className="w-full text-left px-3 py-2 rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 h-full overflow-y-auto overflow-x-hidden">
                          {(() => {
                            const selectedNode = graphEditorGraph?.nodes.find(
                              (node) => node.id === graphEditorSelectedNodeId
                            );

                            if (!selectedNode) {
                              return (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  Select a node to edit its details.
                                </div>
                              );
                            }

                            const attributes = selectedNode.attributes ?? {};
                            const entries = Object.entries(attributes);
                            const docsText = nodeDocsByType[selectedNode.type] ||
                              'No documentation available for this node type yet.';

                            return (
                              <div className="space-y-4">
                                <div>
                                  <div className="text-xs uppercase tracking-wide text-gray-400">
                                    Node ID
                                  </div>
                                  <div className="font-mono text-xs text-gray-700 dark:text-gray-200">
                                    {selectedNode.id}
                                  </div>
                                </div>
                                <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
                                  <button
                                    type="button"
                                    onClick={() => setNodeDocsOpen((prev) => !prev)}
                                    className="w-full flex items-center justify-between text-xs font-semibold text-gray-700 dark:text-gray-200"
                                  >
                                    <span>Node Docs</span>
                                    <span className="text-gray-400">
                                      {nodeDocsOpen ? '▲' : '▼'}
                                    </span>
                                  </button>
                                  {nodeDocsOpen && (
                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                      {docsText}
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <label className="block text-xs font-semibold mb-1">Display Name</label>
                                  <input
                                    type="text"
                                    value={selectedNode.displayName}
                                    onChange={(e) => updateSelectedNodeDisplayName(e.target.value)}
                                    className="w-full min-w-0 px-2 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
                                  />
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  Type: <span className="font-semibold">{selectedNode.type}</span>
                                </div>
                                <div>
                                  <div className="text-xs font-semibold mb-2">Attributes</div>
                                  <div className="space-y-2">
                                    {entries.length === 0 && (
                                      <div className="text-xs text-gray-400">No attributes yet.</div>
                                    )}
                                    {entries.map(([key, value]) => (
                                      <div
                                        key={key}
                                        className="grid grid-cols-[1fr,1fr,24px] gap-2 items-center min-w-0"
                                      >
                                        <input
                                          type="text"
                                          value={key}
                                          onChange={(e) => {
                                            const nextKey = e.target.value;
                                            const nextAttributes = { ...attributes } as Record<string, unknown>;
                                            delete nextAttributes[key];
                                            nextAttributes[nextKey] = value;
                                            updateSelectedNodeAttributes(nextAttributes);
                                          }}
                                          className="w-full min-w-0 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-lg text-xs bg-white dark:bg-gray-800"
                                        />
                                        <input
                                          type="text"
                                          value={typeof value === 'string' ? value : JSON.stringify(value)}
                                          onChange={(e) => {
                                            const nextAttributes = {
                                              ...attributes,
                                              [key]: e.target.value,
                                            } as Record<string, unknown>;
                                            updateSelectedNodeAttributes(nextAttributes);
                                          }}
                                          className="w-full min-w-0 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-lg text-xs bg-white dark:bg-gray-800"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const nextAttributes = { ...attributes } as Record<string, unknown>;
                                            delete nextAttributes[key];
                                            updateSelectedNodeAttributes(nextAttributes);
                                          }}
                                          className="text-xs text-red-500 hover:text-red-600"
                                        >
                                          ×
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextKey = `attr_${entries.length + 1}`;
                                      const nextAttributes = {
                                        ...attributes,
                                        [nextKey]: '',
                                      } as Record<string, unknown>;
                                      updateSelectedNodeAttributes(nextAttributes);
                                    }}
                                    className="mt-3 w-full px-2 py-1 text-xs bg-gray-200 dark:bg-gray-800 rounded hover:bg-gray-300 dark:hover:bg-gray-700"
                                  >
                                    + Add Attribute
                                  </button>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 flex-1 flex flex-col">
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-semibold">Graph JSON</label>
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                const parsed = JSON.parse(graphEditorForm.graphJson || '{}');
                                setGraphEditorForm({
                                  ...graphEditorForm,
                                  graphJson: JSON.stringify(parsed, null, 2),
                                });
                              } catch (err) {
                                setGraphEditorError('Graph JSON is invalid.');
                              }
                            }}
                            className="text-xs text-blue-600 hover:text-blue-700"
                          >
                            Format JSON
                          </button>
                        </div>
                        <textarea
                          value={graphEditorForm.graphJson}
                          onChange={(e) => setGraphEditorForm({ ...graphEditorForm, graphJson: e.target.value })}
                          className="flex-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 font-mono text-xs"
                        />
                      </div>
                    )}

                    {showAddNodeModal && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md mx-4 p-6 border border-gray-200 dark:border-gray-800">
                          <h4 className="text-lg font-semibold mb-3">Add Node</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                            Choose a node type to add at the selected position.
                          </p>
                          <label className="block text-xs font-semibold mb-2">Node Type</label>
                          <select
                            value={addNodeType}
                            onChange={(e) => setAddNodeType(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
                          >
                            {availableGraphNodeTypes.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                          <div className="mt-6 flex items-center justify-end gap-3">
                            <button
                              onClick={() => setShowAddNodeModal(false)}
                              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => {
                                if (!addNodePosition) return;
                                addGraphNode(addNodeType, addNodePosition);
                                setShowAddNodeModal(false);
                              }}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
                            >
                              Add Node
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Profile Edit Modal */}
          {showProfileModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
                <h3 className="text-lg font-semibold mb-4">
                  {editingProfile ? 'Edit Streaming Profile' : 'Create Streaming Profile'}
                </h3>
                
                <div className="space-y-4">
                  {!editingProfile && (
                    <div>
                      <label className="block text-sm font-medium mb-1">Profile ID</label>
                      <input
                        type="text"
                        value={profileFormData.id}
                        onChange={(e) => setProfileFormData({ ...profileFormData, id: e.target.value })}
                        placeholder="e.g., my-custom-profile"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                      />
                      <p className="text-xs text-gray-500 mt-1">Unique identifier (lowercase, hyphens allowed)</p>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Name</label>
                    <input
                      type="text"
                      value={profileFormData.name}
                      onChange={(e) => setProfileFormData({ ...profileFormData, name: e.target.value })}
                      placeholder="e.g., 1080p @ 60Hz"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Description (optional)</label>
                    <input
                      type="text"
                      value={profileFormData.description}
                      onChange={(e) => setProfileFormData({ ...profileFormData, description: e.target.value })}
                      placeholder="e.g., Good for most games"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Width</label>
                      <input
                        type="number"
                        value={profileFormData.width}
                        onChange={(e) => setProfileFormData({ ...profileFormData, width: parseInt(e.target.value) || 1920 })}
                        min="640"
                        max="7680"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Height</label>
                      <input
                        type="number"
                        value={profileFormData.height}
                        onChange={(e) => setProfileFormData({ ...profileFormData, height: parseInt(e.target.value) || 1080 })}
                        min="480"
                        max="4320"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Hz</label>
                      <input
                        type="number"
                        value={profileFormData.refreshRate}
                        onChange={(e) => setProfileFormData({ ...profileFormData, refreshRate: parseInt(e.target.value) || 60 })}
                        min="24"
                        max="360"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => setProfileFormData({ ...profileFormData, width: 1920, height: 1080, refreshRate: 60 })}
                      className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded"
                    >
                      1080p60
                    </button>
                    <button
                      onClick={() => setProfileFormData({ ...profileFormData, width: 2560, height: 1440, refreshRate: 60 })}
                      className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded"
                    >
                      1440p60
                    </button>
                    <button
                      onClick={() => setProfileFormData({ ...profileFormData, width: 3840, height: 2160, refreshRate: 30 })}
                      className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded"
                    >
                      4K30
                    </button>
                    <button
                      onClick={() => setProfileFormData({ ...profileFormData, width: 3440, height: 1440, refreshRate: 60 })}
                      className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded"
                    >
                      Ultrawide
                    </button>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Custom Sway Config (optional)</label>
                    <textarea
                      value={profileFormData.customConfig}
                      onChange={(e) => setProfileFormData({ ...profileFormData, customConfig: e.target.value })}
                      placeholder="# Additional Sway configuration directives..."
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 font-mono text-sm"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => { setShowProfileModal(false); setEditingProfile(null); }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={editingProfile ? updateSwayProfile : createSwayProfile}
                    disabled={saving || (!editingProfile && !profileFormData.id) || !profileFormData.name}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:bg-gray-400"
                  >
                    {saving ? 'Saving...' : (editingProfile ? 'Update' : 'Create')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Download Settings */}
          <div 
            id="downloads" 
            ref={(el) => { sectionRefs.current['downloads'] = el; }}
            className="relative border border-gray-200 dark:border-gray-700 p-6 rounded-lg"
          >
            <SaveIndicator show={!!savedSections['downloads']} message={savedSections['downloads'] || ''} />
            <h2 className="text-xl font-semibold mb-4">📥 Download Settings</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Configure download behavior for GOG installers and other content. Downloads run in separate worker threads to prevent blocking the UI.
            </p>

            <div className="space-y-4">
              <div>
                <label htmlFor="maxConcurrent" className="block text-sm font-medium mb-2">
                  Maximum Concurrent Downloads (1-10)
                </label>
                <input
                  type="number"
                  id="maxConcurrent"
                  min="1"
                  max="10"
                  value={maxConcurrentDownloads}
                  onChange={(e) => setMaxConcurrentDownloads(parseInt(e.target.value) || 2)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Higher values download more files simultaneously but use more system resources. Each download runs in its own worker thread.
                </p>
              </div>

              {/* Installer Cache Location */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <label className="block text-sm font-medium mb-2">
                  Downloaded Installer Storage
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Choose where to store downloaded game installers (GOG .exe files, etc.) after download completes.
                </p>
                
                <div className="space-y-3">
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
                    <input
                      type="radio"
                      name="installerCacheMode"
                      value="with_game"
                      checked={installerCacheMode === 'with_game'}
                      onChange={() => setInstallerCacheMode('with_game')}
                      className="mt-1 h-4 w-4 text-blue-600"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100">Store with game data</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Installers are stored in <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">dillinger_root/storage/games/&lt;game-id&gt;/installers/</code>
                      </div>
                      <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                        ✓ Recommended - Automatically found during installation
                      </div>
                    </div>
                  </label>
                  
                  <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
                    <input
                      type="radio"
                      name="installerCacheMode"
                      value="custom_volume"
                      checked={installerCacheMode === 'custom_volume'}
                      onChange={() => setInstallerCacheMode('custom_volume')}
                      className="mt-1 h-4 w-4 text-blue-600"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100">Use a separate volume</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Store installers in a dedicated volume (useful for keeping large files on a different drive)
                      </div>
                    </div>
                  </label>
                  
                  {installerCacheMode === 'custom_volume' && (
                    <div className="ml-7">
                      <label htmlFor="installerCacheVolume" className="block text-sm font-medium mb-2">
                        Select Volume
                      </label>
                      <select
                        id="installerCacheVolume"
                        value={installerCacheVolumeId}
                        onChange={(e) => setInstallerCacheVolumeId(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">-- Select a volume --</option>
                        {availableVolumes.map((volume) => (
                          <option key={volume.id} value={volume.id}>
                            {volume.name} ({volume.hostPath})
                          </option>
                        ))}
                      </select>
                      {availableVolumes.length === 0 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                          No volumes configured. Use the Volume Manager to add volumes first.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  💡 <strong>Tip:</strong> Default install locations for games are configured per-volume.
                  Use the Volume Manager in the left sidebar and click the pencil icon to configure a volume as the default for each purpose.
                </p>
              </div>

              <button
                onClick={saveDownloadSettings}
                disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Download Settings'}
              </button>
            </div>
          </div>

          {/* Maintenance */}
          <div 
            id="maintenance" 
            ref={(el) => { sectionRefs.current['maintenance'] = el; }}
            className="relative border border-gray-200 dark:border-gray-700 p-6 rounded-lg"
          >
            <h2 className="text-xl font-semibold mb-4">🔧 Maintenance</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Clean up stopped containers and orphaned volumes to free up disk space.
            </p>

            {cleanupMessage && (
              <div className="mb-4 p-4 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100">
                {cleanupMessage}
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={cleanupContainers}
                disabled={cleanupLoading}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {cleanupLoading ? 'Cleaning up...' : 'Clean Up Stopped Containers'}
              </button>

              <button
                onClick={cleanupVolumes}
                disabled={cleanupLoading}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {cleanupLoading ? 'Cleaning up...' : 'Clean Up Orphaned Volumes'}
              </button>

              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                ⚠️ System volumes (dillinger_root, dillinger_installers) are protected and will not be removed.
              </p>
            </div>
          </div>

          {/* UI Settings */}
          <div 
            id="ui" 
            ref={(el) => { sectionRefs.current['ui'] = el; }}
            className="relative border border-gray-200 dark:border-gray-700 p-6 rounded-lg"
          >
            <SaveIndicator show={!!savedSections['ui']} message={savedSections['ui'] || ''} />
            <h2 className="text-xl font-semibold mb-4">🎨 UI Settings</h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="backdropFade" className="block text-sm font-medium mb-2">
                Backdrop Fade Duration
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Controls how quickly the background image transitions when hovering over game tiles.
              </p>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  id="backdropFade"
                  min="0"
                  max="2"
                  step="0.1"
                  value={backdropFadeDuration}
                  onChange={(e) => setBackdropFadeDuration(parseFloat(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm font-medium w-16 text-right">
                  {backdropFadeDuration.toFixed(1)}s
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>Instant (0s)</span>
                <span>Slow (2s)</span>
              </div>
              </div>

              <button
                onClick={saveUISettings}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Save UI Settings
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div 
            id="danger" 
            ref={(el) => { sectionRefs.current['danger'] = el; }}
            className="relative p-6 rounded-lg border-2 border-red-500"
          >
            <h2 className="text-xl font-semibold mb-4 text-red-600 dark:text-red-400">⚠️ Danger Zone</h2>
            
            <div className="space-y-4">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <h3 className="font-semibold text-red-700 dark:text-red-300 mb-2">Factory Reset</h3>
                <p className="text-sm text-red-600 dark:text-red-400 mb-3">
                  This will permanently delete <strong>ALL</strong> your data including:
                </p>
                <ul className="text-sm text-red-600 dark:text-red-400 list-disc list-inside mb-4 space-y-1">
                  <li>All games and their metadata</li>
                  <li>All save files and states</li>
                  <li>All platform configurations</li>
                  <li>All settings and preferences</li>
                  <li>All downloaded content and BIOS files</li>
                </ul>
                <p className="text-sm text-red-700 dark:text-red-300 font-semibold">
                  This action cannot be undone!
                </p>
              </div>

              {!showResetConfirm ? (
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Delete Everything and Reset
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Type <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded font-mono">DELETE EVERYTHING</code> to confirm:
                  </p>
                  <input
                    type="text"
                    value={resetConfirmText}
                    onChange={(e) => setResetConfirmText(e.target.value)}
                    placeholder="Type DELETE EVERYTHING"
                    className="w-full px-4 py-2 border border-red-300 dark:border-red-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    disabled={resetLoading}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowResetConfirm(false);
                        setResetConfirmText('');
                      }}
                      disabled={resetLoading}
                      className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={performFactoryReset}
                      disabled={resetConfirmText !== 'DELETE EVERYTHING' || resetLoading}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {resetLoading ? 'Resetting...' : 'Confirm Reset'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
