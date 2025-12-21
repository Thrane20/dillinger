import { NextResponse } from 'next/server';
import { JSONStorageService } from '@/lib/services/storage';

const storage = JSONStorageService.getInstance();

export async function GET() {
  try {
    const healthCheck = await storage.healthCheck();
    const uptime = process.uptime();

    return NextResponse.json({
      status: healthCheck.healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      storage: 'JSON files',
      dataPath: healthCheck.dataPath,
      uptime: uptime,
      checks: {
        storage: healthCheck.healthy,
        docker: false,
        metadata: false,
      },
      counts: healthCheck.counts,
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
