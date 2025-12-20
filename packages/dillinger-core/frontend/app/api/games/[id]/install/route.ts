import { NextRequest, NextResponse } from 'next/server';
import { JSONStorageService } from '@/lib/services/storage';
import { DockerService } from '@/lib/services/docker-service';
import { v4 as uuidv4 } from 'uuid';
import type { Game, Platform } from '@dillinger/shared';

const storage = JSONStorageService.getInstance();
const dockerService = DockerService.getInstance();

function updateGameInstallationFields(game: Game, platformId: string, installation: any): Game {
  const updatedPlatforms = Array.isArray(game.platforms)
    ? game.platforms.map((p) => {
        if (p.platformId !== platformId) return p;
        return {
          ...p,
          installation: {
            ...(p as any).installation,
            ...installation,
          },
        } as any;
      })
    : game.platforms;

  return {
    ...game,
    installation: {
      ...(game as any).installation,
      ...installation,
    },
    platforms: updatedPlatforms,
  };
}

/**
 * Helper to find a game and its storage filename
 */
async function findGameAndFileKey(id: string): Promise<{ game: Game | null; fileKey: string | null }> {
  const directGame = await storage.readEntity<Game>('games', id);
  if (directGame) {
    return { game: directGame, fileKey: id };
  }
  
  const allGames = await storage.listEntities<Game>('games');
  const foundGame = allGames.find((g) => g.id === id || g.slug === id);
  
  if (!foundGame) {
    return { game: null, fileKey: null };
  }
  
  return { game: foundGame, fileKey: foundGame.id };
}

// POST /api/games/[id]/install - Install a game using Docker with GUI
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { installerPath, installPath, platformId, installerArgs } = body;

    if (!id || !installerPath || !installPath || !platformId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: installerPath, installPath, platformId' },
        { status: 400 }
      );
    }

    // Find the game
    const { game, fileKey } = await findGameAndFileKey(id);
    if (!game || !fileKey) {
      return NextResponse.json(
        { success: false, error: 'Game not found' },
        { status: 404 }
      );
    }

    // Get platform information
    const platform = await storage.readEntity<Platform>('platforms', platformId);
    if (!platform) {
      return NextResponse.json(
        { success: false, error: 'Platform not found' },
        { status: 404 }
      );
    }

    // Generate session ID for this installation
    const sessionId = uuidv4();

    console.log(`🎮 Starting game installation for: ${game.title}`);
    console.log(`  Installer: ${installerPath}`);
    console.log(`  Install target: ${installPath}`);

    // Normalize install paths
    const legacyPublicRoot = process.env.DILLINGER_INSTALLED_PUBLIC_PATH || '/mnt/linuxfast/dillinger_installed';
    let canonicalInstallPath = installPath;
    if (installPath && (installPath === legacyPublicRoot || installPath.startsWith(legacyPublicRoot + '/'))) {
      canonicalInstallPath = '/installed' + installPath.substring(legacyPublicRoot.length);
      console.log(`  Normalized installPath to canonical: ${canonicalInstallPath}`);
    }
    console.log(`  Platform: ${platform.name}`);
    if (installerArgs) {
      console.log(`  Installer args: ${installerArgs}`);
    }

    // Start installation container
    const containerInfo = await dockerService.installGame({
      installerPath,
      installPath: canonicalInstallPath,
      platform,
      sessionId,
      game,
      installerArgs,
    });

    // Update game with installation information
    const updatedAt = new Date().toISOString();
    const updatedGame = updateGameInstallationFields(game, platformId, {
      status: 'installing' as const,
      installPath: canonicalInstallPath,
      installerPath,
      installerArgs,
      containerId: containerInfo.containerId,
      platformId,
      installMethod: 'automated' as const,
    } as any);

    (updatedGame as any).updated = updatedAt;

    await storage.writeEntity('games', fileKey, updatedGame);

    console.log(`✓ Installation started with container: ${containerInfo.containerId}`);

    // Kick off a background monitor so the library status updates even if the UI
    // doesn't poll the /install status endpoint.
    void (async () => {
      try {
        const containerResult = await dockerService.waitForInstallationComplete(containerInfo.containerId);
        const executables = await dockerService.scanForGameExecutables(canonicalInstallPath);
        const hasExecutables = executables.length > 0;

        const nextStatus = hasExecutables
          ? ('installed' as const)
          : (containerResult.success ? ('installed' as const) : ('failed' as const));

        const latest = await storage.readEntity<Game>('games', fileKey);
        if (!latest) return;

        const finishedAt = new Date().toISOString();
        const completedGame = updateGameInstallationFields(latest, platformId, {
          status: nextStatus,
          installedAt: nextStatus === 'installed' ? finishedAt : undefined,
          error: nextStatus === 'failed'
            ? (hasExecutables ? undefined : `Installation failed with exit code ${containerResult.exitCode}`)
            : undefined,
          containerId: undefined,
        } as any);

        // Auto-select an executable when we can find one.
        if (hasExecutables) {
          (completedGame as any).filePath = `${canonicalInstallPath}/${executables[0]}`;
          (completedGame as any).settings = {
            ...(completedGame as any).settings,
            launch: {
              ...((completedGame as any).settings?.launch || {}),
              workingDirectory:
                (completedGame as any).settings?.launch?.workingDirectory || canonicalInstallPath || '',
            },
          };
        }

        (completedGame as any).updated = finishedAt;
        await storage.writeEntity('games', fileKey, completedGame);
      } catch (e) {
        console.error('Background install monitor failed:', e);
      }
    })();

    return NextResponse.json({
      success: true,
      containerId: containerInfo.containerId,
      message: 'Installation started. The installation GUI should appear on your display.',
    });
  } catch (error) {
    console.error('Error starting game installation:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to start installation',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET /api/games/[id]/install - Get installation status
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Game ID is required' },
        { status: 400 }
      );
    }

    const { game, fileKey } = await findGameAndFileKey(id);
    if (!game || !fileKey) {
      return NextResponse.json(
        { success: false, error: 'Game not found' },
        { status: 404 }
      );
    }

    const installation = game.installation;
    if (!installation || !installation.containerId) {
      return NextResponse.json({
        success: true,
        status: installation?.status || 'not_installed',
        isRunning: false,
      });
    }

    // Check if installation container is still running
    try {
      const containerResult = await dockerService.waitForInstallationComplete(installation.containerId);
      
      if (containerResult.exitCode !== -1) {
        // Installation finished - scan for executables
        console.log(`🎮 Installation completed for ${game.title}, scanning for executables...`);
        
        const executables = await dockerService.scanForGameExecutables(installation.installPath || '');
        const hasExecutables = executables.length > 0;
        
        // Update game with installation completion and discovered executables
        const installPlatformId = (installation as any)?.platformId || game.defaultPlatformId || 'windows-wine';
        const finishedAt = new Date().toISOString();
        const finalStatus = hasExecutables
          ? ('installed' as const)
          : (containerResult.success ? ('installed' as const) : ('failed' as const));

        let updatedGame = updateGameInstallationFields(game, installPlatformId, {
          ...installation,
          status: finalStatus,
          installedAt: finalStatus === 'installed' ? finishedAt : undefined,
          error: finalStatus === 'failed'
            ? (hasExecutables ? undefined : `Installation failed with exit code ${containerResult.exitCode}`)
            : undefined,
          containerId: undefined,
        } as any);

        if (hasExecutables) {
          (updatedGame as any).filePath = `${installation.installPath}/${executables[0]}`;
        }

        (updatedGame as any).settings = {
          ...(updatedGame as any).settings,
          launch: {
            ...((updatedGame as any).settings?.launch || {}),
            workingDirectory:
              (updatedGame as any).settings?.launch?.workingDirectory || installation.installPath || '',
          },
        };

        (updatedGame as any).updated = finishedAt;

        await storage.writeEntity('games', fileKey, updatedGame);

        return NextResponse.json({
          success: true,
          status: updatedGame.installation?.status,
          isRunning: false,
          executables: executables,
          autoSelectedExecutable: executables.length > 0 ? executables[0] : null,
        });
      } else {
        // Still running
        return NextResponse.json({
          success: true,
          status: 'installing',
          isRunning: true,
        });
      }
    } catch (error) {
      console.error('Error checking container status:', error);
      return NextResponse.json({
        success: true,
        status: 'failed',
        isRunning: false,
        error: 'Failed to check installation status',
      });
    }
  } catch (error) {
    console.error('Error checking installation status:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check installation status',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
