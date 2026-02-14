import { NextRequest, NextResponse } from 'next/server';
import type { StartTestStreamRequest, TestStreamStatus, TestApp } from '@dillinger/shared';
import { DockerService } from '@/lib/services/docker-service';

const dockerService = DockerService.getInstance();
const VALID_APPS: TestApp[] = ['gst-video-test', 'gst-av-test'];

type PendingLaunch = {
  app: TestApp;
  requestedAt: number;
};

const PENDING_TTL_MS = 5 * 60 * 1000;
let pendingLaunch: PendingLaunch | null = null;
let pendingWorkerActive = false;

const TEST_COMMANDS: Record<TestApp, string> = {
  'gst-video-test': '/opt/dillinger/gst-video-test.sh',
  'gst-av-test': '/opt/dillinger/gst-av-test.sh',
};

async function waitForSidecarHealth(retries: number = 10, delayMs: number = 500): Promise<boolean> {
  for (let i = 0; i < retries; i += 1) {
    const health = await dockerService.getSidecarHealth();
    if (health?.status === 'ok') {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return false;
}

async function waitForActiveSession(retries: number = 30, delayMs: number = 1000): Promise<boolean> {
  for (let i = 0; i < retries; i += 1) {
    const status = await dockerService.getSidecarStatus();
    if (status?.session_id) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  return false;
}

async function processPendingLaunch(): Promise<void> {
  if (pendingWorkerActive) return;
  pendingWorkerActive = true;

  try {
    while (pendingLaunch) {
      const { app, requestedAt } = pendingLaunch;
      if (Date.now() - requestedAt > PENDING_TTL_MS) {
        pendingLaunch = null;
        return;
      }

      const pairStatus = await dockerService.getPairStatus();
      const pendingPairs = Array.isArray(pairStatus?.pending) ? pairStatus.pending : [];
      if (pendingPairs.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }

      const sessionActive = await waitForActiveSession(1, 0);
      if (sessionActive) {
        const cmd = TEST_COMMANDS[app];
        try {
          await dockerService.launchSidecarCommand(cmd, {
            DILLINGER_TEST_APP: app,
          });
          pendingLaunch = null;
          return;
        } catch (error) {
          console.error('Failed to launch pending test app:', error);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } finally {
    pendingWorkerActive = false;
  }
}

async function getTestStatus(): Promise<TestStreamStatus> {
  const pairStatus = await dockerService.getPairStatus();
  const pendingPairs = Array.isArray(pairStatus?.pending) ? pairStatus.pending : [];
  const status = await dockerService.getSidecarStatus();
  if (!status) {
    return {
      running: false,
      waiting: pendingLaunch !== null,
      pairingRequired: pendingPairs.length > 0,
      app: pendingLaunch?.app,
    };
  }

  return {
    running: true,
    mode: 'stream',
    waiting: pendingLaunch !== null,
    pairingRequired: pendingPairs.length > 0,
    app: pendingLaunch?.app,
    containerId: status.session_id ? String(status.session_id) : undefined,
    instructions: 'Connect with Moonlight to see the test app (ports 47984, 47989, 47999, 48010)'
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

    if (!body.app || !VALID_APPS.includes(body.app)) {
      return NextResponse.json(
        { success: false, message: `Invalid test app (expected one of: ${VALID_APPS.join(', ')})` },
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

    const pairStatus = await dockerService.getPairStatus();
    const pendingPairs = Array.isArray(pairStatus?.pending) ? pairStatus.pending : [];
    if (pendingPairs.length > 0) {
      return NextResponse.json(
        {
          success: false,
          pairingRequired: true,
          pendingPairings: pendingPairs,
          message: 'Pairing required before launching the test stream.',
          status: { running: false, waiting: true, pairingRequired: true, app: body.app },
        },
        { status: 409 }
      );
    }

    const sessionReady = await waitForActiveSession();
    if (!sessionReady) {
      pendingLaunch = { app: body.app, requestedAt: Date.now() };
      void processPendingLaunch();
      return NextResponse.json(
        {
          success: true,
          message: 'Waiting for Moonlight connection to launch test app.',
          status: { running: false, waiting: true, app: body.app },
        },
        { status: 202 }
      );
    }

    const cmd = TEST_COMMANDS[body.app];
    await dockerService.launchSidecarCommand(cmd, {
      DILLINGER_TEST_APP: body.app,
    });

    const status = await getTestStatus();

    return NextResponse.json({
      success: true,
      message: 'Test stream started',
      status: { ...status, app: body.app, mode: 'stream' },
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
    if (pendingLaunch) {
      pendingLaunch = null;
      return NextResponse.json({ success: true, message: 'Queued test launch cancelled' });
    }

    await dockerService.stopSidecarCommand();
    return NextResponse.json({ success: true, message: 'Test stream stopped' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('ECONNREFUSED')) {
      return NextResponse.json({ success: true, message: 'Test stream already stopped' });
    }
    console.error('Failed to stop test stream:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to stop test stream', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
