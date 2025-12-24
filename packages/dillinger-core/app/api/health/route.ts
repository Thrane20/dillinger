import { NextResponse } from 'next/server';
import { JSONStorageService } from '@/lib/services/storage';
import * as fs from 'fs';

const storage = JSONStorageService.getInstance();

// Check environment passthrough status
function getEnvironmentPassthrough() {
  const display = process.env.DISPLAY || null;
  const waylandDisplay = process.env.WAYLAND_DISPLAY || null;
  const xauthority = process.env.XAUTHORITY || null;
  const pulseServer = process.env.PULSE_SERVER || null;
  
  // Check if X11 socket exists
  const x11SocketExists = fs.existsSync('/tmp/.X11-unix');
  
  // Check if Docker socket exists
  const dockerSocketExists = fs.existsSync('/var/run/docker.sock');
  
  // Check if GPU device exists
  const gpuExists = fs.existsSync('/dev/dri');
  const gpuDevices: string[] = [];
  if (gpuExists) {
    try {
      const devices = fs.readdirSync('/dev/dri');
      gpuDevices.push(...devices);
    } catch {
      // Ignore errors reading directory
    }
  }
  
  // Check PulseAudio socket
  const pulseSocketPath = '/run/user/1000/pulse/native';
  const pulseSocketExists = fs.existsSync(pulseSocketPath);
  
  // Check sound device
  const soundDeviceExists = fs.existsSync('/dev/snd');
  
  // Check input devices
  const inputDevicesExist = fs.existsSync('/dev/input');
  
  return {
    display: {
      x11: display,
      wayland: waylandDisplay,
      xauthority: xauthority,
      x11SocketMounted: x11SocketExists,
      available: !!(display || waylandDisplay) && x11SocketExists,
    },
    docker: {
      socketMounted: dockerSocketExists,
      socketPath: '/var/run/docker.sock',
    },
    gpu: {
      available: gpuExists,
      devices: gpuDevices,
    },
    audio: {
      pulseServer: pulseServer,
      pulseSocketMounted: pulseSocketExists,
      soundDeviceMounted: soundDeviceExists,
      available: pulseSocketExists || soundDeviceExists,
    },
    input: {
      devicesMounted: inputDevicesExist,
    },
  };
}

export async function GET() {
  try {
    const healthCheck = await storage.healthCheck();
    const uptime = process.uptime();
    const environment = getEnvironmentPassthrough();

    return NextResponse.json({
      status: healthCheck.healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      storage: 'JSON files',
      dataPath: healthCheck.dataPath,
      uptime: uptime,
      checks: {
        storage: healthCheck.healthy,
        docker: environment.docker.socketMounted,
        metadata: false,
      },
      counts: healthCheck.counts,
      environment: environment,
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
