import { NextRequest, NextResponse } from 'next/server';
import type { StartTestStreamRequest, TestStreamStatus, TestPattern } from '@dillinger/shared';
import { DockerService } from '@/lib/services/docker-service';

const dockerService = DockerService.getInstance();
const SIDECAR_API_BASE = process.env.DILLINGER_SIDECAR_API_BASE || 'http://localhost:9999';

const VALID_PATTERNS: TestPattern[] = ['smpte', 'bar', 'checkerboard', 'ball', 'snow'];

const TEST_COMMANDS: Record<TestPattern, string> = {
  smpte: 'gst-launch-1.0 videotestsrc pattern=smpte ! videoconvert ! waylandsink',
  bar: 'gst-launch-1.0 videotestsrc pattern=bar ! videoconvert ! waylandsink',
  checkerboard: 'gst-launch-1.0 videotestsrc pattern=checker-1 ! videoconvert ! waylandsink',
  ball: 'gst-launch-1.0 videotestsrc pattern=ball ! videoconvert ! waylandsink',
  snow: 'gst-launch-1.0 videotestsrc pattern=snow ! videoconvert ! waylandsink',
};

async function fetchSidecar(endpoint: string, init?: RequestInit): Promise<any | null> {
  try {
    const response = await fetch(`${SIDECAR_API_BASE}${endpoint}`, {
      ...init,
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

async function waitForSidecarHealth(retries: number = 10, delayMs: number = 500): Promise<boolean> {
  for (let i = 0; i < retries; i += 1) {
    const health = await fetchSidecar('/health', { method: 'GET' });
    if (health?.status === 'ok') {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return false;
}

async function getTestStatus(): Promise<TestStreamStatus> {
  const status = await fetchSidecar('/status', { method: 'GET' });
  if (!status) {
    return { running: false };
  }

  return {
    running: true,
    mode: 'stream',
    containerId: status.session_id ? String(status.session_id) : undefined,
    instructions: 'Connect with Moonlight to see the test pattern (ports 47984, 47989, 47999, 48010)'
  };
}

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

export async function POST(request: NextRequest) {
  try {
    const body: StartTestStreamRequest = await request.json();

    if (!body.mode || body.mode !== 'stream') {
      return NextResponse.json(
        { success: false, message: "Only 'stream' mode is supported for Wolf sidecar tests" },
        { status: 400 }
      );
    }

    if (!body.pattern || !VALID_PATTERNS.includes(body.pattern)) {
      return NextResponse.json(
        { success: false, message: `Invalid pattern (expected one of: ${VALID_PATTERNS.join(', ')})` },
        { status: 400 }
      );
    }

    await dockerService.ensureStreamerSidecar('test');

    const ready = await waitForSidecarHealth();
    if (!ready) {
      return NextResponse.json(
        { success: false, message: 'Sidecar did not become healthy in time' },
        { status: 504 }
      );
    }

    const cmd = TEST_COMMANDS[body.pattern];
    await fetchSidecar('/launch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cmd,
        env: {
          DILLINGER_TEST_PATTERN: body.pattern,
        },
      }),
    });

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

export async function DELETE() {
  try {
    await fetchSidecar('/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    return NextResponse.json({ success: true, message: 'Test stream stopped' });
  } catch (error) {
    console.error('Failed to stop test stream:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to stop test stream', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
