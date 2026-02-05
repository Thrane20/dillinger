import { NextRequest, NextResponse } from 'next/server';
import { StreamingGraphService } from '@/lib/services/streaming-graph';
import type { StreamingGraphPreset, StreamingGraphStore } from '@dillinger/shared';

const graphService = StreamingGraphService.getInstance();

// GET /api/streaming/graph/presets/[id] - Get preset
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const store = await graphService.getGraphStore();
    const preset = store.presets.find((entry) => entry.id === id);

    if (!preset) {
      return NextResponse.json(
        { success: false, message: `Preset not found: ${id}` },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, preset });
  } catch (error) {
    console.error('Failed to get preset:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get preset', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT /api/streaming/graph/presets/[id] - Update preset
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json()) as Partial<StreamingGraphPreset>;
    const store = await graphService.getGraphStore();

    const index = store.presets.findIndex((entry) => entry.id === id);
    if (index === -1) {
      return NextResponse.json(
        { success: false, message: `Preset not found: ${id}` },
        { status: 404 }
      );
    }

    if (body.id && body.id !== id) {
      return NextResponse.json(
        { success: false, message: 'Preset id cannot be changed' },
        { status: 400 }
      );
    }

    const existing = store.presets[index];
    const updated: StreamingGraphPreset = {
      ...existing,
      name: body.name ?? existing.name,
      description: body.description ?? existing.description,
      isFactory: body.isFactory ?? existing.isFactory,
      graph: body.graph ?? existing.graph,
      updatedAt: new Date().toISOString(),
    };

    const nextStore: StreamingGraphStore = {
      ...store,
      presets: store.presets.map((entry, i) => (i === index ? updated : entry)),
    };

    await graphService.saveGraphStore(nextStore);
    return NextResponse.json({ success: true, preset: updated });
  } catch (error) {
    console.error('Failed to update preset:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update preset', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/streaming/graph/presets/[id] - Delete preset
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const store = await graphService.getGraphStore();
    const preset = store.presets.find((entry) => entry.id === id);

    if (!preset) {
      return NextResponse.json(
        { success: false, message: `Preset not found: ${id}` },
        { status: 404 }
      );
    }

    if (store.defaultPresetId === id) {
      return NextResponse.json(
        { success: false, message: 'Cannot delete default preset' },
        { status: 400 }
      );
    }

    const nextStore: StreamingGraphStore = {
      ...store,
      presets: store.presets.filter((entry) => entry.id !== id),
    };

    await graphService.saveGraphStore(nextStore);
    return NextResponse.json({ success: true, message: 'Preset deleted' });
  } catch (error) {
    console.error('Failed to delete preset:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete preset', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
