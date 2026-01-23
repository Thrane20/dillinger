import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getGameDetails, getDownloadLinks, resolveGogDownload } from '@/lib/services/gog-auth';
import { DownloadManager } from '@/lib/services/download-manager';
import { JSONStorageService } from '@/lib/services/storage';
import type { Game } from '@dillinger/shared';

function looksLikeDirectDownloadUrl(urlString: string): boolean {
  try {
    const u = new URL(urlString);
    if (u.host === 'embed.gog.com') return false;
    // If the path ends with a common installer/archive extension, it's probably safe.
    return /\.(exe|bin|zip|7z|rar|dmg|pkg|sh)(\?|$)/i.test(u.pathname);
  } catch {
    return false;
  }
}

function createSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .replace(/-+/g, '-');
}

function createGogGameId(title: string, gogId: string): string {
  const slug = createSlug(title);
  return `gog-${slug}-${gogId}`;
}

function createCacheDirectoryName(title: string, gogId: string): string {
  const slug = createSlug(title);
  return `${gogId}-${slug}`;
}

// POST /api/online-sources/gog/games/[id]/download - Start downloading a GOG game
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authenticated = await isAuthenticated();
    
    if (!authenticated) {
      return NextResponse.json(
        { error: 'Not authenticated with GOG' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const {
      os = 'windows',
      language = 'en',
      title: providedTitle,
      runner,
      image,
      gameId: localGameId, // Optional - the Dillinger game ID to associate with
      lutrisInstaller, // Optional - Single Lutris installer (deprecated, use lutrisInstallers)
      lutrisInstallers, // Optional - Array of Lutris installers for Wine configuration
    } = body;

    // Get game details and installers
    const gameDetails = await getGameDetails(id);
    
    if (!gameDetails) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }

    // Get download links from GOG
    const downloadLinks = await getDownloadLinks(id, os, language);
    
    if (!downloadLinks || downloadLinks.length === 0) {
      return NextResponse.json(
        { error: 'No download links available for this game' },
        { status: 404 }
      );
    }

    // Resolve each embed/manual URL into a final direct (signed) URL and real filename.
    const resolved = await Promise.all(
      downloadLinks.map(async (link) => {
        try {
          const r = await resolveGogDownload(link);
          return {
            url: r.url,
            filename: r.filename,
            size: typeof r.sizeBytes === 'number' ? r.sizeBytes : (parseInt(link.size) || undefined),
          };
        } catch (error) {
          // Do not silently fall back to embed.gog.com URLs; those often download HTML/text instead of the installer.
          if (looksLikeDirectDownloadUrl(link.downlink)) {
            return {
              url: link.downlink,
              filename: link.name,
              size: parseInt(link.size) || undefined,
            };
          }

          const message = error instanceof Error ? error.message : 'Failed to resolve download URL';
          throw new Error(`Could not resolve GOG download link into a direct URL: ${message}`);
        }
      })
    );

    const files = resolved;

    const title = (typeof providedTitle === 'string' && providedTitle.trim()) ? providedTitle.trim() : gameDetails.title;
    const humanReadableGameId = localGameId || createGogGameId(title, id);
    const cacheDirectoryName = createCacheDirectoryName(title, id);

    // Create a local library entry so it appears on the main library page immediately.
    const now = new Date().toISOString();
    const platformId = runner === 'linux' ? 'linux-native' : 'windows-wine';

    // Normalize installers - support both single and array format
    const installers: Array<typeof lutrisInstaller> = Array.isArray(lutrisInstallers) && lutrisInstallers.length > 0
      ? lutrisInstallers
      : (lutrisInstaller && typeof lutrisInstaller === 'object' ? [lutrisInstaller] : []);
    
    const hasLutrisInstallers = installers.length > 0;

    // Build platform config with optional Lutris installer(s)
    const platformConfig: Game['platforms'][0] = {
      platformId,
      installation: {
        status: 'not_installed',
        installMethod: hasLutrisInstallers ? 'lutris' : 'automated',
      },
    };

    // Store Lutris installers in the platform config (new array format)
    if (hasLutrisInstallers) {
      platformConfig.lutrisInstallers = installers.map((inst: Record<string, unknown>) => ({
        id: inst.id as number,
        slug: inst.slug as string,
        version: inst.version as string,
        gameSlug: inst.gameSlug as string,
        script: (inst.script || {}) as Record<string, unknown>,
        fetchedAt: now,
        notes: inst.notes as string | undefined,
      }));
      
      // Also set single installer for backward compatibility (use first one)
      const firstInstaller = installers[0];
      platformConfig.lutrisInstaller = {
        id: firstInstaller.id,
        slug: firstInstaller.slug,
        version: firstInstaller.version,
        gameSlug: firstInstaller.gameSlug,
        script: firstInstaller.script || {},
        fetchedAt: now,
        notes: firstInstaller.notes,
      };
    }

    const game: Game = {
      id: humanReadableGameId,
      slug: humanReadableGameId,
      title,
      installation: {
        status: 'not_installed',
        installMethod: hasLutrisInstallers ? 'lutris' : 'automated',
      },
      platforms: [platformConfig],
      defaultPlatformId: platformId,
      collectionIds: [],
      tags: ['gog'],
      metadata: {
        primaryImage: typeof image === 'string' && image ? image : undefined,
      },
      fileInfo: {
        size: 0,
        lastModified: now,
      },
      created: now,
      updated: now,
    };

    const storage = JSONStorageService.getInstance();
    await storage.ensureDirectories();
    await storage.writeEntity('games', humanReadableGameId, game);

    // Start download using the correct method signature
    const downloadManager = await DownloadManager.getInitializedInstance();
    await downloadManager.startDownload(
      humanReadableGameId,
      cacheDirectoryName,
      title,
      files
    );

    return NextResponse.json({
      success: true,
      gameId: humanReadableGameId,
      gogId: id,
      fileCount: files.length,
      message: `Download started for ${gameDetails.title}`,
    });
  } catch (error) {
    console.error('Failed to start GOG download:', error);
    return NextResponse.json(
      { error: 'Failed to start download', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
