import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/services/logger';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Wolf config path - this is mounted from the host volume
const WOLF_CONFIG_PATH = '/data/wolf/config.toml';

/**
 * GET /api/streaming/pair
 * Get pairing status and list of paired Moonlight clients
 */
export async function GET() {
  try {
    // Read the Wolf config to get paired clients
    if (!existsSync(WOLF_CONFIG_PATH)) {
      return NextResponse.json({
        paired: false,
        clients: [],
        message: 'No Wolf configuration found. Start a streaming session first.',
        instructions: [
          '1. Enable streaming in a game\'s settings (Moonlight > Enabled)',
          '2. Launch the game - the streaming sidecar will start automatically',
          '3. Open Moonlight client and connect to this host\'s IP',
          '4. Enter the PIN shown in the Moonlight client',
        ],
      });
    }
    
    const configContent = readFileSync(WOLF_CONFIG_PATH, 'utf-8');
    
    // Parse paired clients from TOML (simple extraction)
    const pairedClientsMatch = configContent.match(/\[\[paired_clients\]\]/g);
    const clientCount = pairedClientsMatch ? pairedClientsMatch.length : 0;
    
    return NextResponse.json({
      paired: clientCount > 0,
      clientCount,
      configPath: WOLF_CONFIG_PATH,
      message: clientCount > 0 
        ? `${clientCount} Moonlight client(s) paired`
        : 'No clients paired yet',
      instructions: clientCount === 0 ? [
        '1. Start a game with streaming enabled',
        '2. Open Moonlight client on another device',
        '3. Add this host\'s IP address',
        '4. Click to pair and enter the PIN when prompted',
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
 * - pair: Submit PIN to Wolf to complete pairing
 * - status: Check if Wolf is ready for pairing
 * - clear: Remove all paired clients
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    
    if (action === 'pair') {
      // Submit PIN to Wolf to complete pairing
      const { pair_secret, pin } = body;
      
      if (!pair_secret || !pin) {
        return NextResponse.json(
          { success: false, error: 'Missing pair_secret or pin' },
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
      
      logger.info(`Attempting to pair client with secret: ${pair_secret.substring(0, 8)}...`);
      
      // Submit pairing to Wolf
      const result = await submitPairingPin(pair_secret, pin);
      
      if (result.success) {
        logger.info('Client paired successfully');
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
      // Check if streaming sidecar/Wolf is running and accepting pairing requests
      const container = await findStreamingContainer();
      
      if (!container) {
        return NextResponse.json({
          ready: false,
          message: 'No streaming session active. Start a game with streaming enabled first.',
        });
      }
      
      return NextResponse.json({
        ready: true,
        message: 'Streaming sidecar is running and ready for pairing',
        pairingUrl: 'Connect Moonlight client to this host IP on port 47989',
        instructions: [
          '1. Open Moonlight on your device',
          '2. Click "Add Host" or the + button',
          '3. Enter this server\'s IP address',
          '4. When prompted, enter the PIN shown in Moonlight',
          '5. Once paired, you can stream games!',
        ],
      });
    }
    
    if (action === 'clear') {
      // Clear all paired clients (useful for troubleshooting)
      if (existsSync(WOLF_CONFIG_PATH)) {
        let configContent = readFileSync(WOLF_CONFIG_PATH, 'utf-8');
        
        // Remove all paired_clients sections
        // This is a simple approach - in production use a TOML library
        configContent = configContent.replace(/\[\[paired_clients\]\][\s\S]*?(?=\[\[|\[(?!\[)|$)/g, '');
        configContent = configContent.replace(/paired_clients\s*=\s*\[\]/g, 'paired_clients = []');
        
        writeFileSync(WOLF_CONFIG_PATH, configContent);
        
        logger.info('Cleared all paired Moonlight clients');
        
        return NextResponse.json({
          success: true,
          message: 'All paired clients have been cleared. You will need to pair again.',
        });
      }
      
      return NextResponse.json({
        success: true,
        message: 'No configuration to clear',
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
async function findStreamingContainer(): Promise<string | null> {
  try {
    // Check for streaming-sidecar containers first
    const { stdout: sidecarOutput } = await execAsync(
      `docker ps --filter "ancestor=ghcr.io/thrane20/dillinger/streaming-sidecar" --format "{{.ID}}" 2>/dev/null | head -1`
    );
    if (sidecarOutput.trim()) return sidecarOutput.trim();

    // Check by name pattern
    const { stdout: namedOutput } = await execAsync(
      `docker ps --filter "name=streaming-sidecar" --format "{{.ID}}" 2>/dev/null | head -1`
    );
    if (namedOutput.trim()) return namedOutput.trim();

    // Check legacy session containers
    const { stdout: sessionOutput } = await execAsync(
      `docker ps --filter "name=dillinger-session" --format "{{.ID}}" 2>/dev/null | head -1`
    );
    if (sessionOutput.trim()) return sessionOutput.trim();

    return null;
  } catch {
    return null;
  }
}

/**
 * Submit the pairing PIN to Wolf
 */
async function submitPairingPin(pairSecret: string, pin: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Method 1: Try Wolf's HTTP API directly (works with --network=host or port mapping)
    try {
      const response = await fetch('http://localhost:47989/api/v1/pair/client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pair_secret: pairSecret,
          pin: pin,
        }),
        signal: AbortSignal.timeout(5000),
      });
      
      if (response.ok) {
        const data = await response.json();
        return { success: data.success === true };
      }
    } catch (error) {
      logger.debug('HTTP pairing failed, trying via container:', error);
    }
    
    // Method 2: Try via docker exec to Wolf's Unix socket
    return await submitPairingViaContainer(pairSecret, pin);
  } catch (error) {
    logger.error('All pairing methods failed:', error);
    return { success: false, error: 'Failed to communicate with Wolf server' };
  }
}

/**
 * Submit pairing via Wolf's Unix socket (through docker exec)
 */
async function submitPairingViaContainer(pairSecret: string, pin: string): Promise<{ success: boolean; error?: string }> {
  try {
    const containerId = await findStreamingContainer();
    
    if (!containerId) {
      return { success: false, error: 'No streaming container found' };
    }
    
    // Call the pairing API via curl inside the container
    const jsonBody = JSON.stringify({ pair_secret: pairSecret, pin: pin }).replace(/"/g, '\\"');
    const curlCmd = `curl -s --unix-socket /tmp/wolf.sock -X POST -H "Content-Type: application/json" -d "${jsonBody}" http://localhost/api/v1/pair/client`;
    
    const { stdout, stderr } = await execAsync(`docker exec ${containerId} sh -c '${curlCmd}'`);
    
    if (stderr) {
      logger.debug('Curl stderr:', stderr);
    }
    
    if (stdout.trim()) {
      const result = JSON.parse(stdout);
      return { success: result.success === true, error: result.error };
    }
    
    return { success: false, error: 'No response from Wolf' };
  } catch (error) {
    logger.error('Failed to submit pairing via container:', error);
    return { success: false, error: 'Failed to communicate with Wolf server' };
  }
}

