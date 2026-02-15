import { NextResponse } from 'next/server';
import * as fs from 'fs-extra';
import * as path from 'path';
import axios from 'axios';

// Disable caching for this dynamic route
export const dynamic = 'force-dynamic';

const GOG_CLIENT_ID = '46899977096215655';
const GOG_CLIENT_SECRET = '9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9';
const GOG_TOKEN_URL = 'https://auth.gog.com/token';

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

interface GOGAuthState {
  authenticated: boolean;
  connected: boolean;
  username?: string;
  userId?: string;
}

function getGOGTokensPath(): string {
  return path.join(DILLINGER_CORE_PATH, 'storage', 'online-sources', 'gog-tokens.json');
}

async function getStoredTokens(): Promise<GOGTokenData | null> {
  try {
    const tokensPath = getGOGTokensPath();
    if (await fs.pathExists(tokensPath)) {
      return await fs.readJson(tokensPath);
    }
  } catch (error) {
    console.error('Error reading GOG tokens:', error);
  }
  return null;
}

function isTokenExpired(tokens: GOGTokenData): boolean {
  return Date.now() >= tokens.expires_at;
}

async function storeTokens(tokens: GOGTokenData): Promise<void> {
  const tokensPath = getGOGTokensPath();
  await fs.ensureDir(path.dirname(tokensPath));
  await fs.writeJson(tokensPath, tokens, { spaces: 2 });
}

async function refreshAccessToken(refreshToken: string): Promise<GOGTokenData> {
  const response = await axios.post(
    GOG_TOKEN_URL,
    new URLSearchParams({
      client_id: GOG_CLIENT_ID,
      client_secret: GOG_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  const tokenData: GOGTokenData = {
    ...response.data,
    expires_at: Date.now() + response.data.expires_in * 1000,
  };

  await storeTokens(tokenData);
  return tokenData;
}

async function getValidAccessToken(): Promise<string | null> {
  const tokens = await getStoredTokens();
  
  if (!tokens) {
    return null;
  }

  if (isTokenExpired(tokens)) {
    try {
      const newTokens = await refreshAccessToken(tokens.refresh_token);
      return newTokens.access_token;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      await fs.remove(getGOGTokensPath());
      return null;
    }
  }

  return tokens.access_token;
}

// GET /api/online-sources/gog/status - Check GOG authentication status
export async function GET() {
  try {
    const tokens = await getStoredTokens();
    
    if (!tokens) {
      return NextResponse.json({
        success: true,
        status: {
          authenticated: false,
          connected: false,
        } as GOGAuthState,
      });
    }

    // Check if token is still valid
    const accessToken = await getValidAccessToken();
    
    if (!accessToken) {
      return NextResponse.json({
        success: true,
        status: {
          authenticated: false,
          connected: false,
        } as GOGAuthState,
      });
    }

    return NextResponse.json({
      success: true,
      status: {
        authenticated: true,
        connected: true,
        userId: tokens.user_id,
      } as GOGAuthState,
    });
  } catch (error) {
    console.error('Failed to get GOG status:', error);
    return NextResponse.json(
      { error: 'Failed to get GOG status', message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error' },
      { status: 500 }
    );
  }
}
