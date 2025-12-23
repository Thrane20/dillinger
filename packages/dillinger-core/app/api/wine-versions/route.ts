/**
 * Wine Versions API
 * 
 * GET /api/wine-versions - List installed and available Wine versions
 * POST /api/wine-versions - Install a new Wine version (SSE for progress)
 */

import { NextRequest, NextResponse } from 'next/server';
import { wineVersionsService } from '@/lib/services/wine-versions';

// Local type for API request body
interface AvailableWineVersion {
  type: 'system' | 'wine-staging' | 'ge-proton';
  version: string;
  displayName: string;
  downloadUrl: string;
  size?: number;
  releaseDate: string;
  checksumUrl?: string;
  releaseNotes?: string;
}

/**
 * GET /api/wine-versions
 * Returns installed versions, available versions, and default version
 */
export async function GET() {
  try {
    const status = await wineVersionsService.getStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error('Error fetching wine versions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wine versions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/wine-versions
 * Install a new Wine version with SSE progress updates
 * 
 * Body: { version: AvailableWineVersion }
 * Query: ?stream=true for SSE, otherwise returns on completion
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const version = body.version as AvailableWineVersion;

    if (!version || !version.type || !version.version) {
      return NextResponse.json(
        { error: 'Invalid version object' },
        { status: 400 }
      );
    }

    const useStream = request.nextUrl.searchParams.get('stream') === 'true';

    if (useStream) {
      // Server-Sent Events for progress updates
      const encoder = new TextEncoder();
      
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const installed = await wineVersionsService.installVersion(
              version,
              (progress) => {
                const data = JSON.stringify({ type: 'progress', ...progress });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              }
            );
            
            const data = JSON.stringify({ type: 'complete', version: installed });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            controller.close();
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Installation failed';
            const data = JSON.stringify({ type: 'error', error: errorMessage });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // Non-streaming: wait for completion
      const installed = await wineVersionsService.installVersion(version);
      return NextResponse.json(installed, { status: 201 });
    }
  } catch (error) {
    console.error('Error installing wine version:', error);
    const message = error instanceof Error ? error.message : 'Installation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
