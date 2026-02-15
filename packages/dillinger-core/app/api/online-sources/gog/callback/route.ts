import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs-extra';
import * as path from 'path';
import axios from 'axios';

const GOG_CLIENT_ID = '46899977096215655';
const GOG_CLIENT_SECRET = '9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9';
const GOG_TOKEN_URL = 'https://auth.gog.com/token';
const GOG_REDIRECT_URI = 'https://embed.gog.com/on_login_success?origin=client';

const DILLINGER_CORE_PATH = process.env.DILLINGER_CORE_PATH || '/data';

interface GOGTokenData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  user_id: string;
  expires_at: number;
}

function getGOGTokensPath(): string {
  return path.join(DILLINGER_CORE_PATH, 'storage', 'online-sources', 'gog-tokens.json');
}

async function storeTokens(tokens: GOGTokenData): Promise<void> {
  const tokensPath = getGOGTokensPath();
  await fs.ensureDir(path.dirname(tokensPath));
  await fs.writeJson(tokensPath, tokens, { spaces: 2 });
}

// POST /api/online-sources/gog/callback - Handle GOG OAuth callback
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json(
        { success: false, error: 'Authorization code is required' },
        { status: 400 }
      );
    }

    // Exchange code for tokens
    const tokenResponse = await axios.post(
      GOG_TOKEN_URL,
      new URLSearchParams({
        client_id: GOG_CLIENT_ID,
        client_secret: GOG_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: GOG_REDIRECT_URI,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const tokenData: GOGTokenData = {
      ...tokenResponse.data,
      expires_at: Date.now() + tokenResponse.data.expires_in * 1000,
    };

    // Store tokens
    await storeTokens(tokenData);

    return NextResponse.json({
      success: true,
      username: 'GOG User',
      userId: tokenData.user_id,
    });
  } catch (error) {
    console.error('Failed to handle GOG callback:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to authenticate with GOG', message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error' },
      { status: 500 }
    );
  }
}
