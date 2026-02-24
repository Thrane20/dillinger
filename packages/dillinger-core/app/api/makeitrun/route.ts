import { NextRequest, NextResponse } from 'next/server';
import type { MakeItRunConfig } from '@dillinger/shared';
import { makeItRunService } from '@/lib/services/makeitrun-service';

export async function GET() {
  try {
    const configs = await makeItRunService.listConfigs();
    return NextResponse.json({ success: true, data: configs });
  } catch (error) {
    console.error('Error listing MakeItRun configs:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list MakeItRun configs',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { config, toml, slug } = body as {
      config?: MakeItRunConfig;
      toml?: string;
      slug?: string;
    };

    if (!config && !toml) {
      return NextResponse.json(
        { success: false, error: 'Either config or toml is required' },
        { status: 400 }
      );
    }

    const parsedConfig = config || makeItRunService.parseToml(toml || '');
    const saved = await makeItRunService.saveConfig({
      ...parsedConfig,
      slug: parsedConfig.slug || slug || parsedConfig.title || 'config',
    });

    return NextResponse.json({
      success: true,
      data: saved,
      message: 'MakeItRun config saved successfully',
    });
  } catch (error) {
    console.error('Error saving MakeItRun config:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save MakeItRun config',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
