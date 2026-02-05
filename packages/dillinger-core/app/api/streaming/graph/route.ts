import { NextRequest, NextResponse } from 'next/server';
import { StreamingGraphService } from '@/lib/services/streaming-graph';
import type { StreamingGraphStore } from '@dillinger/shared';

const graphService = StreamingGraphService.getInstance();

// GET /api/streaming/graph - Get streaming graph store
export async function GET() {
  try {
    const store = await graphService.getGraphStore();
    return NextResponse.json({ success: true, store });
  } catch (error) {
    console.error('Failed to get streaming graph store:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get streaming graph store', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/streaming/graph - Replace streaming graph store
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as StreamingGraphStore;

    if (!body || !Array.isArray(body.presets)) {
      return NextResponse.json(
        { success: false, message: 'Invalid graph store (expected presets array)' },
        { status: 400 }
      );
    }

    const ids = new Set<string>();
    for (const preset of body.presets) {
      if (!preset.id || typeof preset.id !== 'string') {
        return NextResponse.json(
          { success: false, message: 'Invalid preset id' },
          { status: 400 }
        );
      }
      if (ids.has(preset.id)) {
        return NextResponse.json(
          { success: false, message: `Duplicate preset id: ${preset.id}` },
          { status: 400 }
        );
      }
      ids.add(preset.id);
    }

    if (!body.defaultPresetId || !ids.has(body.defaultPresetId)) {
      return NextResponse.json(
        { success: false, message: 'defaultPresetId must reference an existing preset' },
        { status: 400 }
      );
    }

    await graphService.saveGraphStore(body);
    return NextResponse.json({ success: true, message: 'Streaming graph store updated' });
  } catch (error) {
    console.error('Failed to update streaming graph store:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update streaming graph store', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
