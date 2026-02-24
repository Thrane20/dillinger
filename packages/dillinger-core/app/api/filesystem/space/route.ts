import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetPath = (searchParams.get('path') || '').trim();

    if (!targetPath) {
      return NextResponse.json({ success: false, error: 'Path is required' }, { status: 400 });
    }

    const quotedPath = shellQuote(targetPath);
    const command = `df -B1 ${quotedPath} | tail -n 1`;
    const { stdout } = await execAsync(command, { timeout: 5000 });

    const line = stdout.trim();
    if (!line) {
      return NextResponse.json({ success: false, error: 'No space data returned' }, { status: 404 });
    }

    const parts = line.split(/\s+/);
    if (parts.length < 6) {
      return NextResponse.json({ success: false, error: 'Unexpected df output format' }, { status: 500 });
    }

    const filesystem = parts[0] || '';
    const totalBytes = Number(parts[1] || '0');
    const usedBytes = Number(parts[2] || '0');
    const availableBytes = Number(parts[3] || '0');
    const usePercent = parts[4] || '';
    const mountedOn = parts[5] || targetPath;

    return NextResponse.json({
      success: true,
      data: {
        path: targetPath,
        filesystem,
        mountedOn,
        totalBytes: Number.isFinite(totalBytes) ? totalBytes : 0,
        usedBytes: Number.isFinite(usedBytes) ? usedBytes : 0,
        availableBytes: Number.isFinite(availableBytes) ? availableBytes : 0,
        usePercent,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read filesystem space',
      },
      { status: 500 }
    );
  }
}
