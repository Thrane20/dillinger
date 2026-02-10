import { NextRequest, NextResponse } from 'next/server';
import Docker from 'dockerode';
import { SettingsService } from '@/lib/services/settings';
import { SwayConfigService } from '@/lib/services/sway-config';
import type { StartTestStreamRequest, TestStreamStatus, TestPattern } from '@dillinger/shared';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const settingsService = SettingsService.getInstance();
const swayConfigService = SwayConfigService.getInstance();

const TEST_CONTAINER_NAME = 'dillinger-streaming-test';
// Version comes from DILLINGER_STREAMING_SIDECAR_VERSION env or falls back to 1.0.0
const SIDECAR_VERSION = process.env.DILLINGER_STREAMING_SIDECAR_VERSION || '1.0.0';
const SIDECAR_IMAGE = `ghcr.io/thrane20/dillinger/streaming-sidecar:${SIDECAR_VERSION}`;

// Valid test patterns
const VALID_PATTERNS: TestPattern[] = ['smpte', 'bar', 'checkerboard', 'ball', 'snow'];

/**
 * Get the current test streaming status
 */
async function getTestStatus(): Promise<TestStreamStatus> {
  try {
    const containers = await docker.listContainers({
      all: true,
      filters: {
        name: [TEST_CONTAINER_NAME],
      },
    });
    
    if (containers.length === 0) {
      return { running: false };
    }
    
    const container = containers[0];
    const isRunning = container.State === 'running';
    
    if (!isRunning) {
      return { running: false };
    }
    
    // Extract info from container labels/env
    const inspect = await docker.getContainer(container.Id).inspect();
    const env = inspect.Config.Env || [];
    
    const getEnv = (key: string) => {
      const entry = env.find((e: string) => e.startsWith(`${key}=`));
      return entry ? entry.split('=')[1] : undefined;
    };
    
    const mode = getEnv('SIDECAR_MODE');
    const profileId = getEnv('SWAY_CONFIG_NAME');
    const pattern = getEnv('TEST_PATTERN') as TestPattern | undefined;
    
    return {
      running: true,
      mode: mode === 'test-x11' ? 'x11' : 'stream',
      profileId,
      pattern,
      containerId: container.Id,
      instructions: mode === 'test-x11' 
        ? 'Check your host display for the test pattern window'
        : 'Connect with Moonlight to see the test pattern (ports 47984, 47990)',
    };
  } catch (error) {
    console.error('Failed to get test status:', error);
    return { running: false };
  }
}

/**
 * Stop any running test container
 */
async function stopTestContainer(): Promise<void> {
  try {
    const containers = await docker.listContainers({
      all: true,
      filters: {
        name: [TEST_CONTAINER_NAME],
      },
    });
    
    for (const containerInfo of containers) {
      const container = docker.getContainer(containerInfo.Id);
      
      if (containerInfo.State === 'running') {
        await container.stop({ t: 5 });
      }
      
      await container.remove({ force: true });
    }
  } catch (error: any) {
    // Ignore "not found" errors
    if (error.statusCode !== 404) {
      throw error;
    }
  }
}

// GET /api/streaming/test - Get test status
export async function GET() {
  try {
    const status = await getTestStatus();
    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error('Failed to get test status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get test status', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/streaming/test - Start test stream
export async function POST(request: NextRequest) {
  try {
    const body: StartTestStreamRequest = await request.json();
    
    // Validate mode
    if (!body.mode || !['stream', 'x11'].includes(body.mode)) {
      return NextResponse.json(
        { success: false, message: "Invalid mode (expected 'stream' | 'x11')" },
        { status: 400 }
      );
    }
    
    // Validate pattern
    if (!body.pattern || !VALID_PATTERNS.includes(body.pattern)) {
      return NextResponse.json(
        { success: false, message: `Invalid pattern (expected one of: ${VALID_PATTERNS.join(', ')})` },
        { status: 400 }
      );
    }
    
    // Validate profile exists
    const profile = await swayConfigService.getProfile(body.profileId);
    if (!profile) {
      return NextResponse.json(
        { success: false, message: `Profile "${body.profileId}" not found` },
        { status: 404 }
      );
    }
    
    // Get streaming settings
    const streamingSettings = await settingsService.getStreamingSettings();
    
    // Stop any existing test container
    await stopTestContainer();
    
    // Prepare environment variables
    const envVars = [
      `SIDECAR_MODE=${body.mode === 'x11' ? 'test-x11' : 'test-stream'}`,
      `SWAY_CONFIG_NAME=${body.profileId}`,
      `TEST_PATTERN=${body.pattern}`,
      `GPU_TYPE=${streamingSettings.gpuType}`,
      `RESOLUTION_WIDTH=${profile.width}`,
      `RESOLUTION_HEIGHT=${profile.height}`,
      `REFRESH_RATE=${profile.refreshRate}`,
      `IDLE_TIMEOUT_MINUTES=0`, // Never auto-stop during test
      `ENABLE_GAMESCOPE=false`,
      `AUDIO_ENABLED=true`,
      `SUNSHINE_USERNAME=dillinger`,
      `SUNSHINE_PASSWORD=test-${Date.now()}`,
      `PUID=${process.getuid?.() || 1000}`,
      `PGID=${process.getgid?.() || 1000}`,
    ];
    
    // Check which GPU devices exist
    const fs = await import('fs');
    const gpuDevices: Docker.DeviceMapping[] = [];
    
    // Scan /dev/dri for all available devices
    // Using F_OK (existence check) instead of R_OK because the Node process may not have 
    // read permission to DRM devices (card0/card1), but Docker will mount them with proper access
    try {
      const driDevices = await fs.promises.readdir('/dev/dri');
      for (const device of driDevices) {
        const devicePath = `/dev/dri/${device}`;
        gpuDevices.push({ PathOnHost: devicePath, PathInContainer: devicePath, CgroupPermissions: 'rwm' });
      }
    } catch {
      // /dev/dri doesn't exist
    }
    
    // GPU is required for streaming - fail if none found
    if (gpuDevices.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'No GPU devices found at /dev/dri/. Ensure GPU is passed through to the devcontainer (--device=/dev/dri in runArgs).' 
        },
        { status: 500 }
      );
    }
    
    console.log(`Found GPU devices: ${gpuDevices.map(d => d.PathOnHost).join(', ')}`);
    
    // Prepare host config
    // Sway compositor needs elevated privileges to create virtual displays
    // The sway binary has file capabilities (cap_sys_nice) which require no-new-privileges=false
    const hostConfig: Docker.HostConfig = {
      AutoRemove: false,
      NetworkMode: 'host', // Use host networking for streaming ports
      // TODO: Investigate if we can reduce from Privileged to specific capabilities
      // amdgpu_cs_ctx_create2 requires kernel-level DRM access that may need --privileged
      Privileged: true,
      // Add user to host video/render groups for GPU access (numeric GIDs from host)
      // card1 is owned by group 985, renderD128 by group 989
      GroupAdd: ['985', '989'],
      // Capabilities required for Wayland compositor (Sway)
      CapAdd: [
        'SYS_ADMIN',      // Required for wlroots/Sway headless backend
        'SYS_PTRACE',     // For debugging/monitoring
        'SYS_NICE',       // For sway's realtime scheduling
      ],
      SecurityOpt: [
        'seccomp=unconfined',       // Sway needs this for DRM access
        'no-new-privileges=false',  // Required because sway binary has file capabilities
      ],
      Binds: [
        'dillinger_root:/data',
        '/run/dillinger:/run/dillinger',
      ],
      Devices: gpuDevices,
    };
    
    // For X11 test mode, mount X11 socket, PulseAudio, and set DISPLAY
    if (body.mode === 'x11') {
      hostConfig.Binds!.push('/tmp/.X11-unix:/tmp/.X11-unix:rw');
      // Mount PulseAudio socket for audio output
      hostConfig.Binds!.push('/run/user/1000/pulse:/run/user/1000/pulse:rw');
      envVars.push(`DISPLAY=${process.env.DISPLAY || ':0'}`);
      envVars.push(`PULSE_SERVER=${process.env.PULSE_SERVER || 'unix:/run/user/1000/pulse/native'}`);
    }
    
    console.log(`Starting test stream: mode=${body.mode}, pattern=${body.pattern}, profile=${body.profileId}`);
    console.log(`Using image: ${SIDECAR_IMAGE}`);
    
    // Create and start container
    const container = await docker.createContainer({
      Image: SIDECAR_IMAGE,
      name: TEST_CONTAINER_NAME,
      Env: envVars,
      HostConfig: hostConfig,
      Labels: {
        'dillinger.streaming-test': 'true',
        'dillinger.test-mode': body.mode,
        'dillinger.test-profile': body.profileId,
        'dillinger.test-pattern': body.pattern,
      },
    } as Docker.ContainerCreateOptions);
    
    await container.start();
    
    // Wait a moment for services to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const status = await getTestStatus();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Test stream started',
      status,
    });
  } catch (error) {
    console.error('Failed to start test stream:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to start test stream', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/streaming/test - Stop test stream
export async function DELETE() {
  try {
    await stopTestContainer();
    return NextResponse.json({ success: true, message: 'Test stream stopped' });
  } catch (error) {
    console.error('Failed to stop test stream:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to stop test stream', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
