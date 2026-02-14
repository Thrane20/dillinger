import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/services/logger';
import { DockerService } from '@/lib/services/docker-service';

const dockerService = DockerService.getInstance();

/**
 * GET /api/streaming/pair
 * Get pairing status and list of paired Moonlight clients
 */
export async function GET() {
  try {
    const pairStatus = await dockerService.getPairStatus();
    const clients = Array.isArray(pairStatus?.paired)
      ? pairStatus.paired.map((client: any) => ({
          id: client.client_id,
          name: client.app_state_folder,
        }))
      : [];
    const clientCount = clients.length;

    return NextResponse.json({
      paired: clientCount > 0,
      clientCount,
      clients,
      pending: Array.isArray(pairStatus?.pending) ? pairStatus.pending : [],
      message: clientCount > 0
        ? `${clientCount} Moonlight client(s) paired`
        : 'No clients paired yet',
      instructions: clientCount === 0 ? [
        '1. Start a game with streaming enabled',
        '2. Open Moonlight on another device',
        '3. Add this host\'s IP address',
        '4. Enter the PIN in Dillinger when prompted',
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
 * - pair: Submit PIN to the Wolf sidecar
 * - status: Check if sidecar is ready for pairing
 * - clear: Clear paired clients (not supported via API)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'pair') {
      const { pin, pair_secret } = body;

      if (!pin) {
        return NextResponse.json(
          { success: false, error: 'Missing pin' },
          { status: 400 }
        );
      }

      if (!/^\d{4}$/.test(pin)) {
        return NextResponse.json(
          { success: false, error: 'PIN must be 4 digits' },
          { status: 400 }
        );
      }

      let pairSecretToUse = pair_secret as string | undefined;

      if (!pairSecretToUse) {
        const pairStatus = await dockerService.getPairStatus();
        const pending = Array.isArray(pairStatus?.pending) ? pairStatus.pending : [];
        pairSecretToUse = pending[0]?.pair_secret;
      }

      if (!pairSecretToUse) {
        return NextResponse.json(
          { success: false, error: 'No pending pairing request found. Trigger pairing in Moonlight first.' },
          { status: 400 }
        );
      }

      logger.info(`Attempting Wolf pairing for secret ${pairSecretToUse}`);
      const result = await dockerService.acceptPairing(pairSecretToUse, pin);

      if (result?.success) {
        logger.info('Wolf pairing successful');
        return NextResponse.json({ success: true, message: 'Pairing successful!' });
      }

      return NextResponse.json(
        { success: false, error: result?.message || 'Pairing failed' },
        { status: 400 }
      );
    }

    if (action === 'status') {
      const ready = await dockerService.getSidecarHealth();

      if (!ready) {
        return NextResponse.json({
          ready: false,
          message: 'No streaming session active. Start a game with streaming enabled first.',
        });
      }

      return NextResponse.json({
        ready: true,
        message: 'Streaming sidecar is running and ready for pairing',
        instructions: [
          '1. Open Moonlight on your device',
          '2. Click "Add Host" or the + button',
          '3. Enter this server\'s IP address',
          '4. When prompted, enter the PIN shown in Moonlight',
          '5. Approve pairing in Dillinger',
        ],
      });
    }

    if (action === 'clear') {
      return NextResponse.json({
        success: false,
        message: 'Clearing paired clients is not supported via API yet.',
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
