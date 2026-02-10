import { NextResponse } from 'next/server';
import { DockerService } from '@/lib/services/docker-service';
import { logger } from '@/lib/services/logger';

/**
 * GET /api/streaming
 * Get information about the current streaming session and Sunshine status
 */
export async function GET() {
  try {
    const dockerService = DockerService.getInstance();
    const activeSession = await dockerService.getActiveStreamingSession();
    
    if (!activeSession) {
      return NextResponse.json({
        active: false,
        message: 'No active streaming session',
        ports: {
          https: 47984,
          http: 47989,
          web: 47990,
          control: 47999,
          rtsp: 48010,
          video: 48100,
          audio: 48200,
        },
        help: 'Start a game with streaming enabled to begin a Moonlight session',
      });
    }
    
    return NextResponse.json({
      active: true,
      containerId: activeSession.containerId,
      gameName: activeSession.gameName,
      startedAt: activeSession.startedAt,
      ports: {
        https: 47984,
        http: 47989,
        web: 47990,
        control: 47999,
        rtsp: 48010,
        video: 48100,
        audio: 48200,
      },
      help: 'Connect with Moonlight client to stream this game',
    });
  } catch (error) {
    logger.error('Error getting streaming status:', error);
    return NextResponse.json(
      { error: 'Failed to get streaming status' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/streaming
 * Stop the current streaming session
 */
export async function DELETE() {
  try {
    const dockerService = DockerService.getInstance();
    
    // Check if there's an active session first
    const activeSession = await dockerService.getActiveStreamingSession();
    
    if (!activeSession) {
      return NextResponse.json({
        success: true,
        message: 'No active streaming session to stop',
      });
    }
    
    // Kill the streaming container
    await dockerService.killExistingStreamingContainers();
    
    logger.info(`Stopped streaming session for game: ${activeSession.gameName}`);
    
    return NextResponse.json({
      success: true,
      message: `Stopped streaming session: ${activeSession.gameName}`,
      stoppedContainer: activeSession.containerId,
    });
  } catch (error) {
    logger.error('Error stopping streaming session:', error);
    return NextResponse.json(
      { error: 'Failed to stop streaming session' },
      { status: 500 }
    );
  }
}
