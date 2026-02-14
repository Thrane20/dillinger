import { NextResponse } from 'next/server';
import { logger } from '@/lib/services/logger';
import { DockerService } from '@/lib/services/docker-service';

const dockerService = DockerService.getInstance();

/**
 * GET /api/streaming/status
 * Get streaming sidecar and Wolf status including paired clients.
 */
export async function GET() {
  try {
    const sidecar = await dockerService.getStreamerSidecarStatus();
    const status = await dockerService.getSidecarStatus();
    const pairStatus = await dockerService.getPairStatus();
    const sidecarRunning = !!sidecar && sidecar.status === 'running';
    const containerId = sidecar?.containerId ?? null;

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
