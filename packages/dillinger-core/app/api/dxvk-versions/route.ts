/**
 * DXVK Versions API
 * 
 * GET /api/dxvk-versions - List installed and available DXVK versions
 * POST /api/dxvk-versions - Install a new DXVK version (SSE for progress)
 */

import { NextRequest, NextResponse } from 'next/server';
import { dxvkVersionsService, AvailableDxvkVersion } from '@/lib/services/dxvk-versions';

/**
 * GET /api/dxvk-versions
 * Returns installed versions, available versions, and default version
 */
export async function GET() {
  try {
    const installed = await dxvkVersionsService.getInstalledVersions();
    const defaultId = await dxvkVersionsService.getDefaultVersionId();
    const available = await dxvkVersionsService.refreshAvailableVersions();
    
    return NextResponse.json({
      installed,
      defaultId,
      available: {
        dxvk: available.dxvk,
        vkd3dProton: available.vkd3dProton,
      },
    });
  } catch (error) {
    console.error('Error fetching DXVK versions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch DXVK versions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dxvk-versions
 * Install a new DXVK version with SSE progress updates
 * 
 * Body: { version: AvailableDxvkVersion }
 * Query: ?stream=true for SSE, otherwise returns on completion
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const version = body.version as AvailableDxvkVersion;

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
            const installed = await dxvkVersionsService.installVersion(
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
      const installed = await dxvkVersionsService.installVersion(version);
      return NextResponse.json({ version: installed });
    }
  } catch (error) {
    console.error('Error installing DXVK version:', error);
    const message = error instanceof Error ? error.message : 'Failed to install DXVK version';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
