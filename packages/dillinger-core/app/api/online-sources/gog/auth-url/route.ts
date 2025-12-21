import { NextResponse } from 'next/server';

const GOG_CLIENT_ID = process.env.GOG_CLIENT_ID || '46899977096215655';
const GOG_REDIRECT_URI = process.env.GOG_REDIRECT_URI || 'https://embed.gog.com/on_login_success?origin=client';

// GET /api/online-sources/gog/auth-url - Get GOG authentication URL
export async function GET() {
  try {
    const authUrl = `https://auth.gog.com/auth?client_id=${GOG_CLIENT_ID}&redirect_uri=${encodeURIComponent(GOG_REDIRECT_URI)}&response_type=code&layout=client2`;
    
    return NextResponse.json({ 
      success: true,
      authUrl,
    });
  } catch (error) {
    console.error('Failed to get GOG auth URL:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get GOG auth URL', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
