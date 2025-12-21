import { NextResponse } from 'next/server';
import * as fs from 'fs-extra';
import * as path from 'path';

const DILLINGER_ROOT = process.env.DILLINGER_ROOT || '/data';

function getGOGTokensPath(): string {
  return path.join(DILLINGER_ROOT, 'storage', 'online-sources', 'gog-tokens.json');
}

// POST /api/online-sources/gog/logout - Log out from GOG
export async function POST() {
  try {
    const tokensPath = getGOGTokensPath();
    if (await fs.pathExists(tokensPath)) {
      await fs.remove(tokensPath);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Successfully logged out from GOG',
    });
  } catch (error) {
    console.error('Failed to logout from GOG:', error);
    return NextResponse.json(
      { error: 'Failed to logout from GOG', message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error' },
      { status: 500 }
    );
  }
}
