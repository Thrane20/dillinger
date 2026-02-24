import { NextRequest, NextResponse } from 'next/server';
import type { MakeItRunConfig } from '@dillinger/shared';
import { makeItRunService } from '@/lib/services/makeitrun-service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug) {
      return NextResponse.json({ success: false, error: 'Slug is required' }, { status: 400 });
    }

    const config = await makeItRunService.loadConfig(slug);
    if (!config) {
      return NextResponse.json({ success: false, error: 'MakeItRun config not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error('Error loading MakeItRun config:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load MakeItRun config',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug) {
      return NextResponse.json({ success: false, error: 'Slug is required' }, { status: 400 });
    }

    const body = await request.json();
    const incoming = body.config as MakeItRunConfig | undefined;
    if (!incoming) {
      return NextResponse.json({ success: false, error: 'Config is required' }, { status: 400 });
    }

    const saved = await makeItRunService.saveConfig({ ...incoming, slug });
    return NextResponse.json({
      success: true,
      data: saved,
      message: 'MakeItRun config updated successfully',
    });
  } catch (error) {
    console.error('Error updating MakeItRun config:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update MakeItRun config',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug) {
      return NextResponse.json({ success: false, error: 'Slug is required' }, { status: 400 });
    }

    const deleted = await makeItRunService.deleteConfig(slug);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'MakeItRun config not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'MakeItRun config deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting MakeItRun config:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete MakeItRun config',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
