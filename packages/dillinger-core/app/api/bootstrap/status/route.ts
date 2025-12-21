import { NextResponse } from 'next/server';
import { JSONStorageService } from '@/lib/services/storage';
import { getScaffoldPreview, isDillingerRootInitialized } from '@/lib/services/bootstrap';

export const dynamic = 'force-dynamic';

export async function GET() {
  const storage = JSONStorageService.getInstance();
  const dillingerRoot = storage.getDillingerRoot();

  const initialized = await isDillingerRootInitialized();

  return NextResponse.json({
    initialized,
    dillingerRoot,
    volume: {
      name: 'dillinger_root',
      containerMount: '/data',
      envVar: 'DILLINGER_ROOT',
    },
    preview: getScaffoldPreview(),
  });
}
