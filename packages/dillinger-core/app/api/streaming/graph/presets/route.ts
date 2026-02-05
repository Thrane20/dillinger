import { NextRequest, NextResponse } from 'next/server';
import { StreamingGraphService } from '@/lib/services/streaming-graph';
import type { StreamingGraphPreset, StreamingGraphStore } from '@dillinger/shared';

const graphService = StreamingGraphService.getInstance();

// GET /api/streaming/graph/presets - List presets
export async function GET() {
  try {
    const store = await graphService.getGraphStore();
    return NextResponse.json({ success: true, presets: store.presets, defaultPresetId: store.defaultPresetId });
  } catch (error) {
    console.error('Failed to list presets:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list presets', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/streaming/graph/presets - Create preset
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<StreamingGraphPreset>;

    if (!body || !body.id || !body.name || !body.graph) {
      return NextResponse.json(
        { success: false, message: 'Invalid preset payload' },
        { status: 400 }
      );
    }

    const store = await graphService.getGraphStore();
    if (store.presets.some((preset) => preset.id === body.id)) {
      return NextResponse.json(
        { success: false, message: `Preset id already exists: ${body.id}` },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const nextPreset: StreamingGraphPreset = {
      id: body.id,
      name: body.name,
      description: body.description,
      isFactory: false,
      createdAt: now,
      updatedAt: now,
      graph: body.graph,
    };

    const nextStore: StreamingGraphStore = {
      ...store,
      presets: [...store.presets, nextPreset],
    };

    await graphService.saveGraphStore(nextStore);
    return NextResponse.json({ success: true, preset: nextPreset });
  } catch (error) {
    console.error('Failed to create preset:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create preset', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
