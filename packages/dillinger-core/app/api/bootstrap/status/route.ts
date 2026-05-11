import { NextResponse } from 'next/server';
import { JSONStorageService } from '@/lib/services/storage';
import { getScaffoldPreview, isDillingerCoreInitialized } from '@/lib/services/bootstrap';

export const dynamic = 'force-dynamic';

export async function GET() {
  const storage = JSONStorageService.getInstance();
  const dillingerCorePath = storage.getDillingerCorePath();

  const initialized = await isDillingerCoreInitialized();

  return NextResponse.json({
    initialized,
    dillingerCorePath,
    runtime: process.env.DILLINGER_RUNTIME === 'native' ? 'native' : 'container',
    hostDataPath: process.env.DILLINGER_RUNTIME === 'native' ? dillingerCorePath : null,
    volume: {
      name: 'dillinger_core',
      containerMount: '/data',
      envVar: 'DILLINGER_CORE_PATH',
    },
    preview: getScaffoldPreview(),
  });
}
