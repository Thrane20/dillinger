import { NextResponse } from 'next/server';
import { logger } from '@/lib/services/logger';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * GET /api/streaming/status
 * Get streaming sidecar and Wolf status including pending pairings and paired clients
 * 
 * Works with both:
 * - streaming-sidecar containers (new architecture)
 * - dillinger-session containers with Wolf (legacy)
 */
export async function GET() {
  try {
    // Check for streaming sidecar first, then fall back to legacy session containers
    const { sidecarRunning, containerId, containerType } = await findStreamingContainer();
    const wolfRunning = sidecarRunning; // Wolf runs inside the sidecar
    
    let pendingPairings: Array<{ pair_secret: string; client_ip: string }> = [];
    let pairedClients: Array<{ client_id: string; app_state_folder?: string }> = [];
    
    if (sidecarRunning && containerId) {
      // Get pending pairing requests via Wolf API
      pendingPairings = await getPendingPairings(containerId);
      
      // Get paired clients from Wolf config
      pairedClients = await getPairedClients(containerId);
    }
    
    return NextResponse.json({
      sidecarRunning,
      wolfRunning,
      pendingPairings,
      pairedClients,
      containerId,
      containerType,
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

/**
 * Find a running streaming container (sidecar or legacy session)
 * Returns container info if found
 */
async function findStreamingContainer(): Promise<{ sidecarRunning: boolean; containerId: string | null; containerType: 'sidecar' | 'session' | null }> {
  try {
    // Method 1: Check for streaming-sidecar containers (new architecture)
    const { stdout: sidecarOutput } = await execAsync(
      `docker ps --filter "ancestor=ghcr.io/thrane20/dillinger/streaming-sidecar" --format "{{.ID}}" 2>/dev/null | head -1`
    );
    
    if (sidecarOutput.trim()) {
      return { 
        sidecarRunning: true, 
        containerId: sidecarOutput.trim(),
        containerType: 'sidecar'
      };
    }

    // Method 2: Check for containers with streaming-sidecar in name
    const { stdout: namedOutput } = await execAsync(
      `docker ps --filter "name=streaming-sidecar" --format "{{.ID}}" 2>/dev/null | head -1`
    );
    
    if (namedOutput.trim()) {
      return { 
        sidecarRunning: true, 
        containerId: namedOutput.trim(),
        containerType: 'sidecar'
      };
    }

    // Method 3: Check for legacy dillinger-session containers with Wolf
    const { stdout: sessionOutput } = await execAsync(
      `docker ps --filter "name=dillinger-session" --format "{{.ID}}" 2>/dev/null | head -1`
    );
    
    if (sessionOutput.trim()) {
      return { 
        sidecarRunning: true, 
        containerId: sessionOutput.trim(),
        containerType: 'session'
      };
    }

    // Method 4: Check if Wolf HTTP port is accessible (for --network=host mode)
    const response = await fetch('http://localhost:47989/', {
      method: 'GET',
      signal: AbortSignal.timeout(1000),
    }).catch(() => null);
    
    if (response !== null) {
      return { sidecarRunning: true, containerId: null, containerType: null };
    }

    return { sidecarRunning: false, containerId: null, containerType: null };
  } catch {
    return { sidecarRunning: false, containerId: null, containerType: null };
  }
}

/**
 * Get pending pairing requests from Wolf API
 */
async function getPendingPairings(containerId: string | null): Promise<Array<{ pair_secret: string; client_ip: string }>> {
  try {
    // Try HTTP API first (works if container exposes ports)
    try {
      const response = await fetch('http://localhost:47989/api/v1/pair/pending', {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.requests) {
          return data.requests;
        }
      }
    } catch {
      // HTTP failed, try via container
    }

    // If we have a container ID, try via docker exec
    if (containerId) {
      const result = await callWolfApiViaContainer(containerId, '/api/v1/pair/pending', 'GET');
      if (result?.success && Array.isArray(result?.requests)) {
        return result.requests as Array<{ pair_secret: string; client_ip: string }>;
      }
    }
    
    return [];
  } catch (error) {
    logger.debug('Failed to get pending pairings:', error);
    return [];
  }
}

/**
 * Get paired clients from Wolf API
 */
async function getPairedClients(containerId: string | null): Promise<Array<{ client_id: string; app_state_folder?: string }>> {
  try {
    // Try HTTP API first
    try {
      const response = await fetch('http://localhost:47989/api/v1/clients', {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.clients) {
          return data.clients;
        }
      }
    } catch {
      // HTTP failed, try via container
    }

    // If we have a container ID, try via docker exec  
    if (containerId) {
      const result = await callWolfApiViaContainer(containerId, '/api/v1/clients', 'GET');
      if (result?.success && Array.isArray(result?.clients)) {
        return result.clients as Array<{ client_id: string; app_state_folder?: string }>;
      }
    }
    
    return [];
  } catch (error) {
    logger.debug('Failed to get paired clients:', error);
    return [];
  }
}

/**
 * Call Wolf API via docker exec (for when HTTP ports aren't exposed)
 * Wolf's socket is at /tmp/wolf.sock inside the container
 */
async function callWolfApiViaContainer(containerId: string, endpoint: string, method: string, body?: object): Promise<Record<string, unknown> | null> {
  try {
    let curlCmd = `curl -s --unix-socket /tmp/wolf.sock http://localhost${endpoint}`;
    
    if (method === 'POST' && body) {
      const jsonBody = JSON.stringify(body).replace(/'/g, "'\\''");
      curlCmd = `curl -s --unix-socket /tmp/wolf.sock -X POST -H "Content-Type: application/json" -d '${jsonBody}' http://localhost${endpoint}`;
    }
    
    const { stdout } = await execAsync(`docker exec ${containerId} sh -c "${curlCmd}" 2>/dev/null`);
    
    if (stdout.trim()) {
      return JSON.parse(stdout);
    }
    return null;
  } catch (error) {
    logger.debug('Failed to call Wolf API via container:', error);
    return null;
  }
}
