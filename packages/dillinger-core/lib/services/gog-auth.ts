import * as fs from 'fs-extra';
import * as path from 'path';
import axios from 'axios';

export const GOG_CLIENT_ID = '46899977096215655';
export const GOG_CLIENT_SECRET = '9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9';
export const GOG_TOKEN_URL = 'https://auth.gog.com/token';
export const GOG_API_URL = 'https://embed.gog.com';
export const GOG_CDN_URL = 'https://cdn.gog.com';

const DILLINGER_ROOT = process.env.DILLINGER_ROOT || '/data';

export interface GOGTokenData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  user_id: string;
  expires_at: number;
}

export interface GOGGame {
  id: number;
  title: string;
  image: string;
  url: string;
  slug?: string;
  worksOn?: {
    Windows: boolean;
    Mac: boolean;
    Linux: boolean;
  };
}

export interface GOGGameDetails {
  id: number;
  title: string;
  description?: {
    full?: string;
    lead?: string;
  };
  images?: {
    background?: string;
    icon?: string;
  };
  downloads?: {
    installers?: Array<{
      id: string;
      name: string;
      os: string;
      language: string;
      size: string;
      version: string;
    }>;
    patches?: Array<{
      id: string;
      name: string;
      os: string;
      language: string;
      size: string;
    }>;
    bonus_content?: Array<{
      id: number;
      name: string;
      type: string;
      size: string;
    }>;
  };
}

export interface GOGDownloadLink {
  manualUrl: string;
  downlink: string;
  name: string;
  size: string;
}

export interface ResolvedGOGDownload {
  url: string;
  filename: string;
  sizeBytes?: number;
}

function isLikelyNonBinaryContentType(contentType: string | undefined): boolean {
  if (!contentType) return false;
  const ct = contentType.toLowerCase();
  if (ct.startsWith('text/')) return true;
  if (ct.includes('html')) return true;
  if (ct.includes('json')) return true;
  if (ct.includes('xml')) return true;
  return false;
}

function getFilenameFromContentDisposition(contentDisposition: string | undefined): string | null {
  if (!contentDisposition) return null;

  // Try RFC 5987 (filename*=UTF-8''...)
  const rfc5987 = /filename\*=(?:UTF-8''|utf-8'')([^;]+)/.exec(contentDisposition);
  if (rfc5987 && rfc5987[1]) {
    try {
      return decodeURIComponent(rfc5987[1].trim().replace(/^"|"$/g, ''));
    } catch {
      // ignore
    }
  }

  // Fallback: filename="..." or filename=...
  const simple = /filename=(?:"([^"]+)"|([^;]+))/.exec(contentDisposition);
  const value = (simple?.[1] || simple?.[2])?.trim();
  return value ? value.replace(/^"|"$/g, '') : null;
}

function fallbackFilenameFromUrl(urlString: string, fallbackBase: string): string {
  try {
    const u = new URL(urlString);
    const base = path.posix.basename(u.pathname);
    if (base && base !== '/' && base !== '.') return base;
  } catch {
    // ignore
  }
  // last resort
  return `${fallbackBase}.bin`;
}

/**
 * Resolve a GOG embed `manualUrl` into a direct downloadable URL.
 *
 * The embed `manualUrl` endpoints often return a redirect / small response.
 * We resolve it server-side with the OAuth token, then pass the final signed CDN URL
 * (and real filename) to the worker so it can download without auth/cookies.
 */
export async function resolveGogDownload(link: GOGDownloadLink): Promise<ResolvedGOGDownload> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    throw new Error('Not authenticated with GOG');
  }

  const url = link.downlink;
  const response = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      // Some endpoints behave differently based on Accept
      Accept: '*/*',
    },
    maxRedirects: 5,
    responseType: 'stream',
    // We need 3xx responses to be considered valid so redirects are followed.
    validateStatus: (status) => status >= 200 && status < 400,
  });

  // Determine final URL from axios internals (follows redirects)
  const finalUrl: string =
    (response.request as any)?.res?.responseUrl ||
    (response.request as any)?._redirectable?._currentUrl ||
    url;

  // If we didn't escape the embed domain, the worker (unauthenticated) will likely download
  // a small HTML/text response instead of the actual installer.
  try {
    const host = new URL(finalUrl).host;
    if (host === 'embed.gog.com') {
      throw new Error('Resolved URL still points to embed.gog.com (not a direct download URL)');
    }
  } catch {
    // ignore URL parsing errors; worker may still handle it, but it’s likely not what we want.
  }

  const contentType = response.headers?.['content-type'] as string | undefined;
  if (isLikelyNonBinaryContentType(contentType)) {
    throw new Error(`Resolved download does not look like a binary (content-type: ${contentType})`);
  }

  // Extract filename & size from headers if present
  const contentDisposition = response.headers?.['content-disposition'] as string | undefined;
  const filename =
    getFilenameFromContentDisposition(contentDisposition) ||
    fallbackFilenameFromUrl(finalUrl, link.name || 'installer');

  const lengthHeader = response.headers?.['content-length'];
  const sizeBytes = typeof lengthHeader === 'string' ? Number(lengthHeader) : undefined;

  // Close stream immediately; we only need headers + final URL.
  try {
    (response.data as any)?.destroy?.();
  } catch {
    // ignore
  }

  return {
    url: finalUrl,
    filename,
    sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : undefined,
  };
}

function normalizeGogImageUrl(url: string | undefined | null, sizeSuffix: number): string | undefined {
  if (!url) return undefined;
  let normalized = url;
  if (normalized.startsWith('//')) {
    normalized = `https:${normalized}`;
  }
  // Many GOG static image URLs come without a file extension; append a size suffix.
  if (!/\.(png|jpe?g|webp)(\?|$)/i.test(normalized)) {
    normalized = `${normalized}_${sizeSuffix}.jpg`;
  }
  return normalized;
}

export function getGOGTokensPath(): string {
  return path.join(DILLINGER_ROOT, 'storage', 'online-sources', 'gog-tokens.json');
}

export async function getStoredTokens(): Promise<GOGTokenData | null> {
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

export function isTokenExpired(tokens: GOGTokenData): boolean {
  return Date.now() >= tokens.expires_at;
}

export async function storeTokens(tokens: GOGTokenData): Promise<void> {
  const tokensPath = getGOGTokensPath();
  await fs.ensureDir(path.dirname(tokensPath));
  await fs.writeJson(tokensPath, tokens, { spaces: 2 });
}

export async function refreshAccessToken(refreshToken: string): Promise<GOGTokenData> {
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

export async function getValidAccessToken(): Promise<string | null> {
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

export async function isAuthenticated(): Promise<boolean> {
  const token = await getValidAccessToken();
  return token !== null;
}

// Get user's GOG library
export async function getGOGLibrary(): Promise<GOGGame[]> {
  const accessToken = await getValidAccessToken();
  
  if (!accessToken) {
    throw new Error('Not authenticated with GOG');
  }

  // Use the same efficient API as the backend - getFilteredProducts returns all data in paginated responses
  const GOG_EMBED_URL = 'https://embed.gog.com';
  let allProducts: Array<{
    id: number;
    title: string;
    image?: string;
    slug?: string;
    worksOn?: { Windows: boolean; Mac: boolean; Linux: boolean };
  }> = [];
  let currentPage = 1;
  let totalPages = 1;

  console.log('Fetching GOG games library...');

  while (currentPage <= totalPages) {
    const url = `${GOG_EMBED_URL}/account/getFilteredProducts?mediaType=1&page=${currentPage}`;
    
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const products = response.data.products || [];
    allProducts = allProducts.concat(products);
    
    totalPages = response.data.totalPages || 1;
    console.log(`Fetched page ${currentPage}/${totalPages} (${products.length} games)`);
    
    currentPage++;
  }

  console.log(`Total games fetched: ${allProducts.length}`);
  
  // Transform to our format
  const games: GOGGame[] = allProducts.map((game) => ({
    id: game.id,
    title: game.title,
    image: game.image ? `https:${game.image}_196.jpg` : '',
    url: `https://www.gog.com/game/${game.slug || game.id}`,
    slug: game.slug,
    worksOn: game.worksOn,
  }));

  return games;
}

// Get detailed info about a specific game
export async function getGameDetails(gameId: string): Promise<GOGGameDetails | null> {
  const accessToken = await getValidAccessToken();
  
  if (!accessToken) {
    throw new Error('Not authenticated with GOG');
  }

  try {
    const response = await axios.get(`${GOG_API_URL}/account/gameDetails/${gameId}.json`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // The embed API returns downloads as an array of tuples:
    // [ ["English", { windows: [ { manualUrl, name, version, size, ... } ] } ], ... ]
    const rawDownloads: unknown[] = Array.isArray(response.data.downloads) ? response.data.downloads : [];
    const installers: Array<{ id: string; name: string; os: string; language: string; size: string; version: string }> = [];

    for (const entry of rawDownloads) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      const languageName = typeof entry[0] === 'string' ? entry[0] : '';
      const byOs = entry[1] as Record<string, unknown> | undefined;
      if (!byOs || typeof byOs !== 'object') continue;

      for (const [osKey, value] of Object.entries(byOs)) {
        if (!Array.isArray(value)) continue;
        for (const installer of value) {
          const item = installer as Record<string, unknown>;
          const manualUrl = typeof item.manualUrl === 'string' ? item.manualUrl : '';
          const name = typeof item.name === 'string' ? item.name : '';
          const size = typeof item.size === 'string' ? item.size : '';
          const version = typeof item.version === 'string' ? item.version : '';
          if (!manualUrl) continue;

          installers.push({
            id: manualUrl,
            name,
            os: osKey,
            language: languageName,
            size,
            version,
          });
        }
      }
    }

    return {
      id: parseInt(gameId),
      title: response.data.title,
      description: {
        full: response.data.description || '',
        lead: response.data.description || '',
      },
      images: {
        background: normalizeGogImageUrl(response.data.backgroundImage, 1000),
        icon: undefined,
      },
      downloads: {
        installers,
      },
    };
  } catch (error) {
    console.error(`Failed to fetch game details for ${gameId}:`, error);
    return null;
  }
}

// Get download links for a game
export async function getDownloadLinks(
  gameId: string,
  os: string = 'windows',
  language: string = 'en'
): Promise<GOGDownloadLink[]> {
  const accessToken = await getValidAccessToken();
  
  if (!accessToken) {
    throw new Error('Not authenticated with GOG');
  }

  try {
    const response = await axios.get(`${GOG_API_URL}/account/gameDetails/${gameId}.json`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const requestedOs = os.toLowerCase();
    const requestedLang = language.toLowerCase();

    const rawDownloads: unknown[] = Array.isArray(response.data.downloads) ? response.data.downloads : [];

    const matchesLanguage = (languageName: string): boolean => {
      if (!requestedLang) return true;
      const ln = languageName.toLowerCase();
      if (requestedLang === 'en') return ln.includes('english');
      return ln.includes(requestedLang);
    };

    const links: GOGDownloadLink[] = [];
    for (const entry of rawDownloads) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      const languageName = typeof entry[0] === 'string' ? entry[0] : '';
      if (languageName && !matchesLanguage(languageName)) continue;

      const byOs = entry[1] as Record<string, unknown> | undefined;
      if (!byOs || typeof byOs !== 'object') continue;

      const installersForOs = byOs[requestedOs];
      if (!Array.isArray(installersForOs)) continue;

      for (const installer of installersForOs) {
        const item = installer as Record<string, unknown>;
        const manualUrl = typeof item.manualUrl === 'string' ? item.manualUrl : '';
        if (!manualUrl) continue;

        links.push({
          manualUrl,
          downlink: `${GOG_API_URL}${manualUrl}`,
          name: typeof item.name === 'string' ? item.name : `installer-${gameId}`,
          size: typeof item.size === 'string' ? item.size : '',
        });
      }
    }

    // If language filtering yielded nothing (common), fall back to any language for the OS.
    if (links.length === 0) {
      for (const entry of rawDownloads) {
        if (!Array.isArray(entry) || entry.length < 2) continue;
        const byOs = entry[1] as Record<string, unknown> | undefined;
        if (!byOs || typeof byOs !== 'object') continue;
        const installersForOs = byOs[requestedOs];
        if (!Array.isArray(installersForOs)) continue;
        for (const installer of installersForOs) {
          const item = installer as Record<string, unknown>;
          const manualUrl = typeof item.manualUrl === 'string' ? item.manualUrl : '';
          if (!manualUrl) continue;
          links.push({
            manualUrl,
            downlink: `${GOG_API_URL}${manualUrl}`,
            name: typeof item.name === 'string' ? item.name : `installer-${gameId}`,
            size: typeof item.size === 'string' ? item.size : '',
          });
        }
      }
    }

    return links;
  } catch (error) {
    console.error(`Failed to fetch download links for ${gameId}:`, error);
    return [];
  }
}
