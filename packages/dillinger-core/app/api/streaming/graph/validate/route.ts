import { NextResponse } from 'next/server';
import { StreamingGraphService } from '@/lib/services/streaming-graph';
import { validateGraphStore } from '@/lib/services/streaming-graph-validator';

const graphService = StreamingGraphService.getInstance();

// POST /api/streaming/graph/validate - Validate and cache graph store
export async function POST() {
  try {
    const store = await graphService.getGraphStore();
    const validation = validateGraphStore(store);
    const nextStore = {
      ...store,
      validation,
    };

    await graphService.saveGraphStore(nextStore);

    return NextResponse.json({ success: true, validation });
  } catch (error) {
    console.error('Failed to validate streaming graph store:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to validate streaming graph store', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
