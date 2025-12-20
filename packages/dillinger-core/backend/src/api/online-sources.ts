import { Router } from 'express';
import type { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import fs from 'fs-extra';
import axios from 'axios';
import { JSONStorageService } from '../services/storage.js';
import { DownloadManager } from '../services/download-manager.js';
import { GOGCacheService } from '../services/gog-cache.js';

const router = Router();
const storage = JSONStorageService.getInstance();
const downloadManager = DownloadManager.getInstance();
const gogCache = GOGCacheService.getInstance();

// GOG OAuth configuration
const GOG_CLIENT_ID = '46899977096215655';
const GOG_CLIENT_SECRET = '9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9';
const GOG_REDIRECT_URI = 'https://embed.gog.com/on_login_success?origin=client';

const GOG_AUTH_URL = 'https://auth.gog.com/auth';
const GOG_TOKEN_URL = 'https://auth.gog.com/token';
const GOG_EMBED_URL = 'https://embed.gog.com';
const GOG_API_URL = 'https://api.gog.com';

/**
 * Create a human-readable slug from a game title
 * Example: "Dragon's Lair Trilogy" -> "dragons-lair-trilogy"
 */
function createSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[''"]/g, '') // Remove apostrophes and quotes
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with dashes
    .replace(/^-+|-+$/g, '') // Remove leading/trailing dashes
    .substring(0, 40); // Limit length
}

/**
 * Create a human-readable game ID for GOG games
 * Format: gog-{slug}-{gogId}
 * Example: "gog-dragons-lair-trilogy-2083200433"
 */
function createGogGameId(title: string, gogId: string): string {
  const slug = createSlug(title);
  return `gog-${slug}-${gogId}`;
}

/**
 * Create a human-readable cache directory name
 * Format: {gogId}-{slug}
 * Example: "2083200433-dragons-lair-trilogy"
 */
function createCacheDirectoryName(title: string, gogId: string): string {
  const slug = createSlug(title);
  return `${gogId}-${slug}`;
}

interface GOGTokenData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  user_id: string;
  expires_at: number; // Calculated field
}

interface GOGAuthState {
  authenticated: boolean;
  connected: boolean;
  username?: string;
  userId?: string;
}

/**
 * Get the path to the GOG tokens file
 */
function getGOGTokensPath(): string {
  const dillingerRoot = storage.getDillingerRoot();
  return path.join(dillingerRoot, 'storage', 'online-sources', 'gog-tokens.json');
}

/**
 * Read stored GOG tokens
 */
async function getStoredTokens(): Promise<GOGTokenData | null> {
  try {
    const tokensPath = getGOGTokensPath();
    if (await fs.pathExists(tokensPath)) {
      const data = await fs.readJson(tokensPath);
      return data;
    }
  } catch (error) {
    console.error('Error reading GOG tokens:', error);
  }
  return null;
}

/**
 * Store GOG tokens
 */
async function storeTokens(tokens: GOGTokenData): Promise<void> {
  try {
    const tokensPath = getGOGTokensPath();
    await fs.ensureDir(path.dirname(tokensPath));
    await fs.writeJson(tokensPath, tokens, { spaces: 2 });
  } catch (error) {
    console.error('Error storing GOG tokens:', error);
    throw error;
  }
}

/**
 * Delete stored GOG tokens
 */
async function deleteTokens(): Promise<void> {
  try {
    const tokensPath = getGOGTokensPath();
    if (await fs.pathExists(tokensPath)) {
      await fs.remove(tokensPath);
    }
  } catch (error) {
    console.error('Error deleting GOG tokens:', error);
    throw error;
  }
}

/**
 * Check if token is expired
 */
function isTokenExpired(tokens: GOGTokenData): boolean {
  return Date.now() >= tokens.expires_at;
}

/**
 * Refresh GOG access token
 */
async function refreshAccessToken(refreshToken: string): Promise<GOGTokenData> {
  try {
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
  } catch (error) {
    console.error('Error refreshing GOG token:', error);
    throw new Error('Failed to refresh GOG token');
  }
}

/**
 * Get valid access token (refresh if needed)
 */
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
      // Token refresh failed - user needs to re-authenticate
      await deleteTokens();
      return null;
    }
  }

  return tokens.access_token;
}

/**
 * GET /api/online-sources/gog/auth-url
 * Get the GOG OAuth authorization URL
 */
router.get('/gog/auth-url', async (_req: Request, res: Response) => {
  try {
    const state = uuidv4(); // CSRF protection
    
    const authUrl = new URL(GOG_AUTH_URL);
    authUrl.searchParams.set('client_id', GOG_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', GOG_REDIRECT_URI);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', state);
    
    res.json({
      success: true,
      authUrl: authUrl.toString(),
      state,
    });
  } catch (error) {
    console.error('Error generating GOG auth URL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate auth URL',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/online-sources/gog/callback
 * Handle GOG OAuth callback (exchange code for tokens)
 */
router.post('/gog/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;

    if (!code) {
      res.status(400).json({
        success: false,
        error: 'Authorization code is required',
      });
      return;
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

    res.json({
      success: true,
      username: 'GOG User',
      userId: tokenData.user_id,
    });
  } catch (error) {
    console.error('Error exchanging GOG code for token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete authentication',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/online-sources/gog/status
 * Check if user is authenticated with GOG
 */
router.get('/gog/status', async (_req: Request, res: Response) => {
  try {
    // First check if there's an access code in settings
    const settingsService = (await import('../services/settings.js')).SettingsService.getInstance();
    const gogSettings = await settingsService.getGOGSettings();
    const hasAccessCode = !!(gogSettings?.accessCode);

    const tokens = await getStoredTokens();
    
    if (!tokens && !hasAccessCode) {
      res.json({
        success: true,
        status: {
          authenticated: false,
          connected: false,
        } as GOGAuthState,
      });
      return;
    }

    // If we have access code but no tokens, we're "connected" but not authenticated
    if (!tokens && hasAccessCode) {
      res.json({
        success: true,
        status: {
          authenticated: false,
          connected: true,
        } as GOGAuthState,
      });
      return;
    }

    // Check if token is still valid
    const accessToken = await getValidAccessToken();
    
    if (!accessToken) {
      res.json({
        success: true,
        status: {
          authenticated: false,
          connected: hasAccessCode,
        } as GOGAuthState,
      });
      return;
    }

    res.json({
      success: true,
      status: {
        authenticated: true,
        connected: true,
        username: 'GOG User',
        userId: tokens?.user_id,
      } as GOGAuthState,
    });
  } catch (error) {
    console.error('Error checking GOG auth status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check authentication status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/online-sources/gog/logout
 * Logout from GOG (delete stored tokens)
 */
router.post('/gog/logout', async (_req: Request, res: Response) => {
  try {
    await deleteTokens();
    res.json({
      success: true,
      message: 'Successfully logged out from GOG',
    });
  } catch (error) {
    console.error('Error logging out from GOG:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to logout',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/online-sources/gog/exchange-code
 * Exchange an authorization code for an access token
 * This is for manual code entry (when user copies code from redirect URL)
 */
router.post('/gog/exchange-code', async (req: Request, res: Response) => {
  try {
    const { code } = req.body;

    if (!code) {
      res.status(400).json({
        success: false,
        error: 'Authorization code is required',
      });
      return;
    }

    console.log('Exchanging authorization code for access token...');

    // Exchange code for tokens
    const tokenResponse = await axios.post(
      GOG_TOKEN_URL,
      new URLSearchParams({
        client_id: GOG_CLIENT_ID,
        client_secret: GOG_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: 'https://embed.gog.com/on_login_success?origin=client',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    console.log('Token exchange successful!');

    const accessToken = tokenResponse.data.access_token;

    // Store as both OAuth tokens and in settings for easy access
    const tokenData: GOGTokenData = {
      ...tokenResponse.data,
      expires_at: Date.now() + tokenResponse.data.expires_in * 1000,
    };

    await storeTokens(tokenData);

    // Also save access token to settings
    const settingsService = (await import('../services/settings.js')).SettingsService.getInstance();
    await settingsService.updateGOGSettings({ accessCode: accessToken });

    res.json({
      success: true,
      message: 'Authorization code exchanged successfully',
      accessToken: accessToken.substring(0, 10) + '...', // Show partial for confirmation
    });
  } catch (error) {
    console.error('Error exchanging authorization code:', error);
    
    if (axios.isAxiosError(error)) {
      console.error('Response status:', error.response?.status);
      console.error('Response data:', error.response?.data);
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to exchange authorization code',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: axios.isAxiosError(error) ? error.response?.data : undefined,
    });
  }
});

/**
 * GET /api/online-sources/gog/games
 * Get the user's GOG game library
 * Fetches all pages automatically
 * Supports caching with ?refresh=true to bypass cache
 */
router.get('/gog/games', async (req: Request, res: Response) => {
  try {
    const refresh = req.query.refresh === 'true';
    
    // Check cache first unless refresh is requested
    if (!refresh) {
      const cachedData = await gogCache.getCachedGames();
      if (cachedData) {
        res.json({
          success: true,
          games: cachedData.games,
          count: cachedData.count,
          totalPages: cachedData.totalPages,
          cached: true,
          lastFetched: cachedData.lastFetched,
        });
        return;
      }
    }
    
    let accessToken = await getValidAccessToken();
    
    // If no valid access token from OAuth, try to use access code from settings
    if (!accessToken) {
      const settingsService = (await import('../services/settings.js')).SettingsService.getInstance();
      const gogSettings = await settingsService.getGOGSettings();
      
      if (gogSettings?.accessCode) {
        accessToken = gogSettings.accessCode;
      } else {
        res.status(401).json({
          success: false,
          error: 'Not authenticated with GOG. Please connect your account or provide an access code.',
        });
        return;
      }
    }

    // Fetch all pages of games
    let allProducts: any[] = [];
    let currentPage = 1;
    let totalPages = 1;

    console.log('Fetching GOG games library...');

    while (currentPage <= totalPages) {
      const url = `${GOG_EMBED_URL}/account/getFilteredProducts?mediaType=1&page=${currentPage}`;
      
      const gamesResponse = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const products = gamesResponse.data.products || [];
      allProducts = allProducts.concat(products);
      
      totalPages = gamesResponse.data.totalPages || 1;
      console.log(`Fetched page ${currentPage}/${totalPages} (${products.length} games)`);
      
      currentPage++;
    }

    console.log(`Total games fetched: ${allProducts.length}`);
    
    // Transform to our format
    const games = allProducts.map((game: any) => ({
      id: game.id.toString(),
      title: game.title,
      image: game.image ? `https:${game.image}_196.jpg` : null,
      url: `https://www.gog.com/game/${game.slug || game.id}`,
    }));

    // Cache the results
    await gogCache.cacheGames(games, totalPages);

    res.json({
      success: true,
      games,
      count: games.length,
      totalPages,
      cached: false,
    });
  } catch (error) {
    console.error('Error fetching GOG games:', error);
    
    if (axios.isAxiosError(error)) {
      console.error('Response status:', error.response?.status);
      console.error('Response data:', error.response?.data);
      
      if (error.response?.status === 401) {
        // Token invalid - clear it
        await deleteTokens();
        res.status(401).json({
          success: false,
          error: 'GOG authentication expired. Please login again.',
        });
        return;
      }
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch GOG games',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/online-sources/gog/games/:id
 * Get detailed information about a specific GOG game
 */
router.get('/gog/games/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    let accessToken = await getValidAccessToken();
    
    // If no valid access token from OAuth, try to use access code from settings
    if (!accessToken) {
      const settingsService = (await import('../services/settings.js')).SettingsService.getInstance();
      const gogSettings = await settingsService.getGOGSettings();
      
      if (gogSettings?.accessCode) {
        accessToken = gogSettings.accessCode;
      } else {
        res.status(401).json({
          success: false,
          error: 'Not authenticated with GOG. Please connect your account or provide an access code.',
        });
        return;
      }
    }

    console.log(`Fetching details for GOG game ${id}...`);

    // Fetch game details with downloads expanded
    const url = `${GOG_API_URL}/products/${id}?expand=downloads&locale=en-US`;
    
    const gameResponse = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const game = gameResponse.data;
    
    res.json({
      success: true,
      game: {
        id: game.id.toString(),
        title: game.title,
        slug: game.slug,
        description: game.description?.full || game.description?.lead || '',
        publisher: game.publisher,
        developer: game.developer,
        releaseDate: game.release_date,
        genres: game.genres?.map((g: any) => g.name) || [],
        images: {
          background: game.images?.background ? `https:${game.images.background}` : null,
          logo: game.images?.logo ? `https:${game.images.logo}` : null,
          logo2x: game.images?.logo2x ? `https:${game.images.logo2x}` : null,
          icon: game.images?.icon ? `https:${game.images.icon}` : null,
          sidebarIcon: game.images?.sidebarIcon ? `https:${game.images.sidebarIcon}` : null,
          sidebarIcon2x: game.images?.sidebarIcon2x ? `https:${game.images.sidebarIcon2x}` : null,
        },
        screenshots: game.screenshots?.map((s: any) => ({
          url: `https:${s.formatter_template_url}`.replace('{formatter}', ''),
          thumbnail: `https:${s.formatter_template_url}`.replace('{formatter}', '_ggvgm'),
        })) || [],
        downloads: game.downloads || null,
      },
    });
  } catch (error) {
    console.error('Error fetching GOG game details:', error);
    
    if (axios.isAxiosError(error)) {
      console.error('Response status:', error.response?.status);
      console.error('Response data:', error.response?.data);
      
      if (error.response?.status === 401) {
        await deleteTokens();
        res.status(401).json({
          success: false,
          error: 'GOG authentication expired. Please login again.',
        });
        return;
      }
      
      if (error.response?.status === 404) {
        res.status(404).json({
          success: false,
          error: 'Game not found.',
        });
        return;
      }
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch GOG game details',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/online-sources/gog/games/:id/download
 * Get download links and initiate background download for a GOG game
 */
router.post('/gog/games/:id/download', async (req: Request, res: Response) => {
  try {
    const { id: gogId } = req.params;
    const { title, runner } = req.body as { title?: string; runner?: string };
    
    if (!gogId) {
      res.status(400).json({
        success: false,
        error: 'GOG game ID is required',
      });
      return;
    }

    if (!title) {
      res.status(400).json({
        success: false,
        error: 'title is required',
      });
      return;
    }

    let accessToken = await getValidAccessToken();
    
    if (!accessToken) {
      const settingsService = (await import('../services/settings.js')).SettingsService.getInstance();
      const gogSettings = await settingsService.getGOGSettings();
      
      if (gogSettings?.accessCode) {
        accessToken = gogSettings.accessCode;
      } else {
        res.status(401).json({
          success: false,
          error: 'Not authenticated with GOG.',
        });
        return;
      }
    }

    console.log(`Fetching download links for GOG game ${gogId}...`);

    // Fetch game details with downloads
    const detailsUrl = `${GOG_API_URL}/products/${gogId}?expand=downloads&locale=en-US`;
    const gameResponse = await axios.get(detailsUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const downloads = gameResponse.data.downloads;
    
    if (!downloads || !downloads.installers) {
      res.status(404).json({
        success: false,
        error: 'No installers found for this game',
      });
      return;
    }

    // Filter installers based on runner (wine = windows, linux = linux)
    let installers = downloads.installers;
    
    // Filter out Mac installers
    installers = installers.filter((inst: any) => inst.os !== 'mac');
    
    // Filter by OS if runner is specified
    if (runner === 'wine') {
      installers = installers.filter((inst: any) => inst.os === 'windows');
    } else if (runner === 'linux') {
      installers = installers.filter((inst: any) => inst.os === 'linux');
    }

    // Get English installers (or first available language)
    const englishInstallers = installers.filter((inst: any) => inst.language === 'en');
    const selectedInstallers = englishInstallers.length > 0 ? englishInstallers : installers.slice(0, 1);

    if (selectedInstallers.length === 0) {
      res.status(404).json({
        success: false,
        error: 'No suitable installers found',
      });
      return;
    }

    console.log(`Found ${selectedInstallers.length} installer(s) for ${title}`);

    // Get download info (actual URLs) for each installer
    const downloadFiles: Array<{ url: string; filename: string; size?: number }> = [];

    for (const installer of selectedInstallers) {
      for (const file of installer.files || []) {
        const downlink = file.downlink;
        if (!downlink) continue;

        try {
          // Get the actual download URL
          const downloadInfoResponse = await axios.get(downlink, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

          const downloadInfo = downloadInfoResponse.data;
          
          // Extract filename from URL
          let filename = '';
          if (downloadInfo.downlink) {
            const url = new URL(downloadInfo.downlink);
            const pathParam = url.searchParams.get('path');
            if (pathParam) {
              filename = path.basename(pathParam);
            } else {
              filename = path.basename(decodeURIComponent(url.pathname));
            }
          }

          if (!filename) {
            filename = `${gogId}_installer_${downloadFiles.length + 1}.bin`;
          }

          downloadFiles.push({
            url: downloadInfo.downlink,
            filename,
            size: installer.total_size,
          });
        } catch (error) {
          console.error(`Failed to get download info for ${downlink}:`, error);
        }
      }
    }

    if (downloadFiles.length === 0) {
      res.status(500).json({
        success: false,
        error: 'Failed to get download URLs',
      });
      return;
    }

    // Create human-readable IDs and paths
    const humanReadableGameId = createGogGameId(title, gogId);
    const cacheDirectoryName = createCacheDirectoryName(title, gogId);
    
    // Create game entry in library
    const dillingerRoot = storage.getDillingerRoot();
    const installerPath = path.join(dillingerRoot, 'storage', 'installer_cache', cacheDirectoryName);
    
    const now = new Date().toISOString();
    const game = {
      id: humanReadableGameId,
      slug: humanReadableGameId,
      title,
      filePath: '', // Will be set after installation
      platformId: runner === 'wine' ? 'wine-windows' : 'linux-native',
      collectionIds: [],
      tags: ['gog'],
      metadata: {
        description: `GOG game: ${title}`,
        gogId,
      },
      fileInfo: {
        size: downloadFiles.reduce((sum, f) => sum + (f.size || 0), 0),
        lastModified: now,
      },
      installation: {
        status: 'downloading' as const,
        installerPath,
        downloadProgress: 0,
      },
      created: now,
      updated: now,
    };

    await storage.writeEntity('games', humanReadableGameId, game);

    // Start background download with human-readable cache directory
    await downloadManager.startDownload(humanReadableGameId, cacheDirectoryName, title, downloadFiles);

    console.log(`Started background download for ${title} (${downloadFiles.length} files) -> ${cacheDirectoryName}`);

    res.json({
      success: true,
      message: 'Download started',
      fileCount: downloadFiles.length,
      gameId: humanReadableGameId,
    });
  } catch (error) {
    console.error('Error starting GOG download:', error);
    
    if (axios.isAxiosError(error)) {
      console.error('Response status:', error.response?.status);
      console.error('Response data:', error.response?.data);
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to start download',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/online-sources/gog/downloads/:gameId/progress
 * Get download progress for a game
 */
router.get('/gog/downloads/:gameId/progress', (req: Request, res: Response) => {
  const { gameId } = req.params;
  
  if (!gameId) {
    res.status(400).json({
      success: false,
      error: 'gameId is required',
    });
    return;
  }
  
  const progress = downloadManager.getProgress(gameId);
  
  if (!progress) {
    res.status(404).json({
      success: false,
      error: 'No download found for this game',
    });
    return;
  }

  res.json({
    success: true,
    progress,
  });
});

/**
 * GET /api/online-sources/gog/downloads
 * Get all active downloads
 */
router.get('/gog/downloads', (_req: Request, res: Response) => {
  const downloads = downloadManager.getAllDownloads();
  
  res.json({
    success: true,
    downloads: downloads.map(d => ({
      gameId: d.gameId,
      gogId: d.gogId,
      title: d.title,
      status: d.status,
      progress: d.progress,
      startedAt: d.startedAt,
      completedAt: d.completedAt,
    })),
  });
});

/**
 * DELETE /api/online-sources/gog/downloads/:gameId
 * Cancel a download
 */
router.delete('/gog/downloads/:gameId', async (req: Request, res: Response) => {
  const { gameId } = req.params;
  
  if (!gameId) {
    res.status(400).json({
      success: false,
      error: 'gameId is required',
    });
    return;
  }
  
  try {
    await downloadManager.cancelDownload(gameId);
    
    res.json({
      success: true,
      message: 'Download cancelled',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to cancel download',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Listen to download events and update game entities
// Note: Progress updates are now handled via WebSocket broadcasts (no disk writes)
// We only persist state changes on completion/failure

downloadManager.on('download:completed', async (progress: any) => {
  try {
    const game = await storage.readEntity<any>('games', progress.gameId);
    if (game && game.installation) {
      game.installation.status = 'ready_to_install';
      game.installation.downloadProgress = 100;
      game.updated = new Date().toISOString();
      await storage.writeEntity('games', progress.gameId, game);
      console.log(`[GOG] Game ${game.title} ready to install`);
    }
  } catch (error) {
    console.error(`Failed to update game completion for ${progress.gameId}:`, error);
  }
});

downloadManager.on('download:failed', async (progress: any) => {
  try {
    const game = await storage.readEntity<any>('games', progress.gameId);
    if (game && game.installation) {
      game.installation.status = 'failed';
      game.installation.error = progress.error;
      game.updated = new Date().toISOString();
      await storage.writeEntity('games', progress.gameId, game);
    }
  } catch (error) {
    console.error(`Failed to update game failure for ${progress.gameId}:`, error);
  }
});

export default router;

