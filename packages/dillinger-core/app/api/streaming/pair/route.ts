import { NextRequest, NextResponse } from 'next/server';
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { logger } from '@/lib/services/logger';

const execAsync = promisify(exec);

function getDefaultGateway(): string | null {
  try {
    const data = fs.readFileSync('/proc/net/route', 'utf-8');
    const lines = data.trim().split('\n');
    for (const line of lines.slice(1)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 3) continue;
      const destination = parts[1];
      const gatewayHex = parts[2];
      if (destination !== '00000000') continue;
      const num = parseInt(gatewayHex, 16);
      const bytes = [
        num & 0xff,
        (num >> 8) & 0xff,
        (num >> 16) & 0xff,
        (num >> 24) & 0xff,
      ];
      return bytes.join('.');
    }
  } catch (error) {
    logger.debug('Failed to read default gateway:', error);
  }
  return null;
}

function getHostCandidates(): string[] {
  const candidates: string[] = [];
  const envGateway = process.env.DILLINGER_HOST_GATEWAY || process.env.HOST_GATEWAY;
  if (envGateway) candidates.push(envGateway);
  const gateway = getDefaultGateway();
  if (gateway) candidates.push(gateway);
  return candidates;
}

function buildSunshineBases(): string[] {
  const bases = new Set<string>();
  if (process.env.SUNSHINE_API_BASE) bases.add(process.env.SUNSHINE_API_BASE);

  const hosts = ['localhost', 'host.docker.internal', ...getHostCandidates()];
  for (const host of hosts) {
    bases.add(`https://${host}:47990`);
    bases.add(`http://${host}:47990`);
  }

  return Array.from(bases);
}

function buildHealthBases(): string[] {
  const bases = new Set<string>();
  if (process.env.SUNSHINE_HEALTH_BASE) bases.add(process.env.SUNSHINE_HEALTH_BASE);

  const hosts = ['localhost', 'host.docker.internal', ...getHostCandidates()];
  for (const host of hosts) {
    bases.add(`http://${host}:9999`);
  }

  return Array.from(bases);
}

/**
 * GET /api/streaming/pair
 * Get pairing status and list of paired Moonlight clients
 */
export async function GET() {
  try {
    const status = await fetchFromBases(buildHealthBases(), '/status', 1500);

    const clients = Array.isArray(status?.clients) ? status.clients : [];
    const clientCount = clients.length;

    return NextResponse.json({
      paired: clientCount > 0,
      clientCount,
      clients,
      message: clientCount > 0
        ? `${clientCount} Moonlight client(s) paired`
        : 'No clients paired yet',
      instructions: clientCount === 0 ? [
        '1. Start a game with streaming enabled',
        '2. Open Moonlight client on another device',
        '3. Add this host\'s IP address',
        '4. Open Sunshine web UI at http://<host>:47990 to approve pairing',
      ] : [
        'Your Moonlight clients are paired and ready to connect.',
        'Start a game with streaming enabled to begin playing.',
      ],
    });
  } catch (error) {
    logger.error('Error getting pairing status:', error);
    return NextResponse.json(
      { error: 'Failed to get pairing status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/streaming/pair
 * Handle pairing request with PIN verification
 *
 * Actions:
 * - pair: Submit PIN to Sunshine (best-effort)
 * - status: Check if sidecar is ready for pairing
 * - clear: Clear paired clients (not supported via API)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    
    if (action === 'pair') {
      // Submit PIN to Sunshine to complete pairing
      const { pin } = body;
      
      if (!pin) {
        return NextResponse.json(
          { success: false, error: 'Missing pin' },
          { status: 400 }
        );
      }
      
      // Validate PIN format (4 digits)
      if (!/^\d{4}$/.test(pin)) {
        return NextResponse.json(
          { success: false, error: 'PIN must be 4 digits' },
          { status: 400 }
        );
      }
      
      logger.info(`Attempting Sunshine pairing with pin: ${pin}`);
      const result = await submitPairingPin(pin);
      
      if (result.success) {
        logger.info('Sunshine pairing successful');
        return NextResponse.json({ success: true, message: 'Pairing successful!' });
      } else {
        logger.warn('Pairing failed:', result.error);
        return NextResponse.json(
          { success: false, error: result.error || 'Pairing failed' },
          { status: 400 }
        );
      }
    }
    
    if (action === 'status') {
      const ready = await fetchReadyFromBases(buildHealthBases(), '/readyz', 1500);

      if (!ready) {
        return NextResponse.json({
          ready: false,
          message: 'No streaming session active. Start a game with streaming enabled first.',
        });
      }
      
      return NextResponse.json({
        ready: true,
        message: 'Streaming sidecar is running and ready for pairing',
        pairingUrl: 'Open Sunshine web UI at http://<host>:47990 to approve pairing',
        instructions: [
          '1. Open Moonlight on your device',
          '2. Click "Add Host" or the + button',
          '3. Enter this server\'s IP address',
          '4. When prompted, enter the PIN shown in Moonlight',
          '5. Approve pairing in Sunshine web UI',
        ],
      });
    }
    
    if (action === 'clear') {
      return NextResponse.json({
        success: false,
        message: 'Clearing paired clients is not supported via API. Use Sunshine web UI.',
      });
    }
    
    return NextResponse.json(
      { error: 'Invalid action. Use "pair", "status", or "clear".' },
      { status: 400 }
    );
  } catch (error) {
    logger.error('Error handling pairing request:', error);
    return NextResponse.json(
      { error: 'Failed to process pairing request' },
      { status: 500 }
    );
  }
}

/**
 * Find a running streaming container (sidecar or legacy session)
 */
async function submitPairingPin(pin: string): Promise<{ success: boolean; error?: string }> {
  const endpoints = ['/api/pin'];
  let lastError: string | undefined;
  const creds = await getSunshineCredentials();
  const headers: Record<string, string> = {};
  if (creds?.username && creds?.password) {
    const token = Buffer.from(`${creds.username}:${creds.password}`).toString('base64');
    headers.Authorization = `Basic ${token}`;
  }

  for (const base of buildSunshineBases()) {
    for (const endpoint of endpoints) {
      try {
        const response = await requestJson(
          `${base}${endpoint}`,
          'POST',
          { pin, name: 'Dillinger' },
          5000,
          headers
        );
        if (response.ok) {
          const data = response.json ?? {};
          const success =
            data.success === true ||
            data.ok === true ||
            data.status === true ||
            data.status === 'ok' ||
            data.paired === true ||
            Object.keys(data).length === 0;
          if (success) {
            return { success: true };
          }
        }
        lastError = `Sunshine ${base}${endpoint} responded ${response.status}`;
        if (response.bodyText) {
          lastError += `: ${response.bodyText.slice(0, 200)}`;
        }
      } catch (error) {
        logger.debug('Sunshine pairing attempt failed:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (!lastError && !message.includes('ENOTFOUND')) {
          lastError = message;
        }
      }
    }
  }

  return { success: false, error: lastError || 'Pairing failed. Use Sunshine web UI to approve pairing.' };
}

async function getSunshineCredentials(): Promise<{ username: string; password: string } | null> {
  const envUser = process.env.SUNSHINE_USERNAME;
  const envPass = process.env.SUNSHINE_PASSWORD;
  if (envUser && envPass) {
    return { username: envUser, password: envPass };
  }

  const containerId = await findTestContainerId();
  if (!containerId) return null;

  try {
    const { stdout } = await execAsync(
      `docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' ${containerId}`
    );
    const lines = stdout.split('\n');
    const username = getEnvValue(lines, 'SUNSHINE_USERNAME');
    const password = getEnvValue(lines, 'SUNSHINE_PASSWORD');
    if (username && password) {
      return { username, password };
    }
  } catch (error) {
    logger.debug('Failed to read Sunshine credentials from container:', error);
  }

  return null;
}

function getEnvValue(lines: string[], key: string): string | null {
  const line = lines.find((entry) => entry.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1) : null;
}

async function findTestContainerId(): Promise<string | null> {
  try {
    const { stdout } = await execAsync(
      `docker ps --filter "name=dillinger-streaming-test" --format "{{.ID}}" 2>/dev/null | head -1`
    );
    const id = stdout.trim();
    return id || null;
  } catch (error) {
    logger.debug('Failed to find test container:', error);
    return null;
  }
}

async function fetchFromBases(bases: string[], path: string, timeoutMs: number) {
  for (const base of bases) {
    try {
      const response = await requestJson(`${base}${path}`, 'GET', undefined, timeoutMs);
      if (response.ok) {
        return response.json ?? null;
      }
    } catch (error) {
      logger.debug('Health status fetch failed:', error);
    }
  }
  return null;
}

async function fetchReadyFromBases(bases: string[], path: string, timeoutMs: number) {
  for (const base of bases) {
    try {
      const response = await requestJson(`${base}${path}`, 'GET', undefined, timeoutMs);
      if (response.ok) {
        return true;
      }
    } catch (error) {
      logger.debug('Health readiness fetch failed:', error);
    }
  }
  return false;
}

async function requestJson(
  url: string,
  method: 'GET' | 'POST',
  body: Record<string, unknown> | undefined,
  timeoutMs: number,
  headers: Record<string, string> = {}
): Promise<{ ok: boolean; status: number; json?: Record<string, unknown>; bodyText?: string }>
{
  const parsedUrl = new URL(url);
  const isHttps = parsedUrl.protocol === 'https:';
  const transport = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const req = transport.request(
      {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
        ...(isHttps ? { rejectUnauthorized: false } : {}),
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => {
          const bodyText = Buffer.concat(chunks).toString('utf-8');
          let json: Record<string, unknown> | undefined;
          if (bodyText) {
            try {
              json = JSON.parse(bodyText) as Record<string, unknown>;
            } catch {
              json = undefined;
            }
          }
          const status = res.statusCode || 0;
          resolve({ ok: status >= 200 && status < 300, status, json, bodyText });
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('Request timed out'));
    });

    if (payload) {
      req.write(payload);
    }

    req.end();
  });
}

