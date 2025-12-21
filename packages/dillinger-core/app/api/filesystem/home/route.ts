import { NextResponse } from 'next/server';
import * as os from 'os';

// GET /api/filesystem/home - Get the user's home directory path
export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      data: { path: os.homedir() },
    });
  } catch (error) {
    console.error('Error getting home directory:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Failed to get home directory' },
      { status: 500 }
    );
  }
}
