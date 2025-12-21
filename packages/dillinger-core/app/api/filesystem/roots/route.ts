import { NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as os from 'os';

// GET /api/filesystem/roots - Get filesystem roots
export async function GET() {
  try {
    const platform = os.platform();
    let roots: string[];

    if (platform === 'win32') {
      roots = [];
      for (let i = 65; i <= 90; i++) {
        const drive = String.fromCharCode(i) + ':\\';
        try {
          await fs.access(drive);
          roots.push(drive);
        } catch {
          // Drive doesn't exist or not accessible
        }
      }
    } else {
      roots = ['/'];
    }

    return NextResponse.json({
      success: true,
      data: { roots },
    });
  } catch (error) {
    console.error('Error getting filesystem roots:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Failed to get filesystem roots' },
      { status: 500 }
    );
  }
}
