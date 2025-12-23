import { NextRequest, NextResponse } from 'next/server';
import Docker from 'dockerode';
import { RUNNER_IMAGES } from '../../route';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

/**
 * POST /api/runners/[id]/pull
 * Pull a runner image from the registry with progress streaming
 * 
 * Query params:
 *   version - specific version to pull (e.g., "0.1.2"), defaults to "latest"
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  // Get optional version from query params
  const { searchParams } = new URL(request.url);
  const version = searchParams.get('version') || 'latest';
  
  const config = RUNNER_IMAGES[id];
  if (!config) {
    return NextResponse.json(
      { success: false, error: `Unknown runner: ${id}` },
      { status: 404 }
    );
  }
  
  // Build the full image reference with specified version
  const imageRef = `${config.repository}:${version}`;
  
  // Create a streaming response for progress updates
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      
      try {
        send({ type: 'start', message: `Pulling ${config.name} v${version}...`, image: imageRef });
        
        // Start the pull
        const pullStream = await docker.pull(imageRef, {});
        
        // Track layer progress
        const layerProgress: Record<string, { current: number; total: number }> = {};
        
        await new Promise<void>((resolve, reject) => {
          docker.modem.followProgress(
            pullStream,
            (err: Error | null, _output: unknown[]) => {
              if (err) {
                send({ type: 'error', message: err.message });
                reject(err);
              } else {
                send({ type: 'complete', message: 'Pull complete', version });
                resolve();
              }
            },
            (event: any) => {
              // Progress event
              if (event.id && event.progressDetail) {
                const { current, total } = event.progressDetail;
                if (current !== undefined && total !== undefined && total > 0) {
                  layerProgress[event.id] = { current, total };
                  
                  // Calculate overall progress
                  let totalCurrent = 0;
                  let totalSize = 0;
                  for (const layer of Object.values(layerProgress)) {
                    totalCurrent += layer.current;
                    totalSize += layer.total;
                  }
                  
                  const progress = totalSize > 0 ? Math.round((totalCurrent / totalSize) * 100) : 0;
                  send({
                    type: 'progress',
                    progress,
                    status: event.status,
                    id: event.id,
                    current: totalCurrent,
                    total: totalSize,
                  });
                }
              } else if (event.status) {
                send({ type: 'status', status: event.status, id: event.id });
              }
            }
          );
        });
        
        controller.close();
      } catch (error) {
        send({ type: 'error', message: error instanceof Error ? error.message : 'Pull failed' });
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
}

/**
 * DELETE /api/runners/[id]/pull
 * Remove a runner image from local Docker
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  const config = RUNNER_IMAGES[id];
  if (!config) {
    return NextResponse.json(
      { success: false, error: `Unknown runner: ${id}` },
      { status: 404 }
    );
  }
  
  try {
    // First, find the actual image by listing all images and matching tags
    const images = await docker.listImages({ all: true });
    const foundImage = images.find(img => 
      img.RepoTags?.some(tag => 
        tag.startsWith(config.repository + ':')
      )
    );
    
    if (!foundImage) {
      return NextResponse.json(
        { success: false, error: `Image ${config.repository} not found locally` },
        { status: 404 }
      );
    }
    
    // Use the image ID to remove it
    const image = docker.getImage(foundImage.Id);
    await image.remove({ force: false });
    
    return NextResponse.json({
      success: true,
      message: `Removed ${config.name}`,
    });
  } catch (error) {
    console.error(`Failed to remove image ${config.repository}:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        success: false, 
        error: `Failed to remove image: ${errorMessage}. It may be in use by a container.`,
        repository: config.repository
      },
      { status: 500 }
    );
  }
}
