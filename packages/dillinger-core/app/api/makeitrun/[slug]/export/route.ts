import { NextRequest, NextResponse } from 'next/server';
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

    const toml = makeItRunService.exportToml(config);
    return new NextResponse(toml, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${config.slug}.toml"`,
      },
    });
  } catch (error) {
    console.error('Error exporting MakeItRun config:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to export MakeItRun config',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
