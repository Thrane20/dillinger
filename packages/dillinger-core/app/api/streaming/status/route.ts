import { NextResponse } from 'next/server';
import { logger } from '@/lib/services/logger';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * GET /api/streaming/status
 * Get streaming sidecar and Wolf status including paired clients.
 */
export async function GET() {
  try {
    const { sidecarRunning, containerId } = await findStreamingContainer();
    const status = await getSidecarStatus();
    const pairStatus = await getPairStatus();

    const pairedClients = Array.isArray(pairStatus?.paired)
      ? pairStatus.paired.map((client: any) => ({
          id: client.client_id,
          name: client.app_state_folder,
        }))
      : [];

    return NextResponse.json({
      sidecarRunning: sidecarRunning || !!status,
      wolfRunning: !!status,
      pendingPairings: Array.isArray(pairStatus?.pending) ? pairStatus?.pending : [],
      pairedClients,
      containerId,
      containerType: 'sidecar',
      status: status || null,
    });
  } catch (error) {
    logger.error('Error getting streaming status:', error);
    return NextResponse.json({
      sidecarRunning: false,
      wolfRunning: false,
      pendingPairings: [],
      pairedClients: [],
      error: 'Failed to get streaming status',
    });
  }
}

async function fetchSidecarJson(endpoint: string): Promise<any | null> {
  try {
    const response = await fetch(`http://localhost:9999${endpoint}`, {
      method: 'GET',
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

async function getSidecarStatus(): Promise<any | null> {
  return await fetchSidecarJson('/status');
}

async function getPairStatus(): Promise<any | null> {
  return await fetchSidecarJson('/pair/status');
}

/**
 * Find a running streaming sidecar container.
 */
async function findStreamingContainer(): Promise<{ sidecarRunning: boolean; containerId: string | null }> {
  try {
    const { stdout: labeledOutput } = await execAsync(
      `docker ps --filter "label=dillinger.streaming.sidecar=true" --format "{{.ID}}" 2>/dev/null | head -1`
    );

    if (labeledOutput.trim()) {
      return { sidecarRunning: true, containerId: labeledOutput.trim() };
    }

    const { stdout: namedOutput } = await execAsync(
      `docker ps --filter "name=dillinger-streamer" --format "{{.ID}}" 2>/dev/null | head -1`
    );

    if (namedOutput.trim()) {
      return { sidecarRunning: true, containerId: namedOutput.trim() };
    }

    return { sidecarRunning: false, containerId: null };
  } catch {
    return { sidecarRunning: false, containerId: null };
  }
}
