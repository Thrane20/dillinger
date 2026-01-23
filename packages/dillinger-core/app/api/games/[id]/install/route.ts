import { NextRequest, NextResponse } from 'next/server';
import { JSONStorageService } from '@/lib/services/storage';
import { DockerService } from '@/lib/services/docker-service';
import { analyzeLutrisScript, summarizeLutrisScript } from '@/lib/services/lutris-executor';
import { v4 as uuidv4 } from 'uuid';
import type { Game, Platform, GamePlatformConfig } from '@dillinger/shared';

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
    const { installerPath, installPath, platformId, installerArgs, debugMode, wineVersionId, wineArch } = body;

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

    // Get platform information (checks user overrides, then bundled defaults)
    const platform = await storage.readPlatform<Platform>(platformId);
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
    console.log(`  Platform: ${platform.name}`);
    if (installerArgs) {
      console.log(`  Installer args: ${installerArgs}`);
    }
    if (wineVersionId) {
      console.log(`  Wine version: ${wineVersionId}`);
    }
    if (wineArch) {
      console.log(`  Wine architecture: ${wineArch}`);
    }
    if (debugMode) {
      console.log(`  🔧 DEBUG MODE: Container will be kept for inspection`);
    }

    // Extract Lutris installer settings from game platform config
    // The lutrisInstaller is stored when adding a GOG game with a Lutris script
    let winetricks: string[] = [];
    let effectiveWineArch = wineArch;
    let dllOverrides: string | undefined;
    let environmentVariables: Record<string, string> = {};
    
    // Lutris execution steps
    let lutrisExtractSteps: Array<{ src: string; dst: string; format?: string }> = [];
    let lutrisMoveSteps: Array<{ src: string; dst: string; operation?: 'move' | 'merge' | 'rename' }> = [];
    let lutrisExecuteSteps: Array<{ command?: string; file?: string; args?: string; description?: string }> = [];
    let lutrisWineexecSteps: Array<{ executable: string; args?: string; prefix?: string; blocking?: boolean }> = [];
    let lutrisRegistrySettings: Array<{ path: string; name: string; type?: string; value: string }> = [];
    
    const platformConfig = game.platforms?.find((p: GamePlatformConfig) => p.platformId === platformId);
    if (platformConfig?.lutrisInstaller?.script) {
      console.log(`  🎯 Using Lutris installer: ${platformConfig.lutrisInstaller.version} (${platformConfig.lutrisInstaller.slug})`);
      
      const script = platformConfig.lutrisInstaller.script;
      
      // Use the comprehensive analyzer to extract all script settings
      const analysis = analyzeLutrisScript(script as any);
      const summary = summarizeLutrisScript(analysis);
      console.log(`  Lutris summary: ${summary}`);
      
      // Log Lutris recommendations for debugging/visibility
      if (Object.keys(analysis.recommendations).length > 0) {
        console.log(`  📋 Lutris recommendations:`);
        if (analysis.recommendations.useDxvk !== undefined) {
          console.log(`    - DXVK: ${analysis.recommendations.useDxvk ? 'recommended' : 'not recommended'}`);
        }
        if (analysis.recommendations.useEsync !== undefined) {
          console.log(`    - esync: ${analysis.recommendations.useEsync ? 'recommended' : 'not recommended'}`);
        }
        if (analysis.recommendations.wineVersion) {
          console.log(`    - Wine version: ${analysis.recommendations.wineVersion}`);
        }
      }
      
      // Get winetricks from analysis
      if (analysis.winetricks.length > 0) {
        winetricks = analysis.winetricks;
        console.log(`  Winetricks (from Lutris): ${winetricks.join(', ')}`);
      }
      
      // If Lutris recommends DXVK, add it to winetricks (unless already present)
      if (analysis.recommendations.useDxvk === true && !winetricks.includes('dxvk')) {
        winetricks.push('dxvk');
        console.log(`  📦 Added DXVK to winetricks (Lutris recommendation)`);
      }
      
      // Use wine arch from analysis if not explicitly specified
      if (!effectiveWineArch && analysis.wineArch) {
        effectiveWineArch = analysis.wineArch;
        console.log(`  Wine arch (from Lutris): ${effectiveWineArch}`);
      }
      
      // Get DLL overrides from analysis
      if (Object.keys(analysis.dllOverrides).length > 0) {
        dllOverrides = Object.entries(analysis.dllOverrides)
          .map(([dll, mode]) => `${dll}=${mode}`)
          .join(';');
        console.log(`  DLL overrides (from Lutris): ${dllOverrides}`);
      }
      
      // Get environment variables from analysis
      if (Object.keys(analysis.environment).length > 0) {
        environmentVariables = { ...analysis.environment };
        console.log(`  Environment vars (from Lutris): ${Object.keys(environmentVariables).join(', ')}`);
      }
      
      // Process execution steps from analysis
      for (const step of analysis.executionSteps) {
        switch (step.type) {
          case 'extract':
            lutrisExtractSteps.push({
              src: (step.params as any).file || '',
              dst: (step.params as any).dst || '',
              format: (step.params as any).format,
            });
            break;
          case 'move':
          case 'rename':
            lutrisMoveSteps.push({
              src: (step.params as any).src || '',
              dst: (step.params as any).dst || '',
              operation: step.type as 'move' | 'rename',
            });
            break;
          case 'merge':
            lutrisMoveSteps.push({
              src: (step.params as any).src || '',
              dst: (step.params as any).dst || '',
              operation: 'merge',
            });
            break;
          case 'execute':
            lutrisExecuteSteps.push({
              command: (step.params as any).command,
              file: (step.params as any).file,
              args: (step.params as any).args,
              description: step.description,
            });
            break;
          case 'wineexec':
            // Skip create_prefix steps (handled automatically)
            if ((step.params as any).name !== 'create_prefix') {
              lutrisWineexecSteps.push({
                executable: (step.params as any).executable || '',
                args: (step.params as any).args,
                blocking: true,
              });
            }
            break;
          case 'set_regedit':
            if ((step.params as any).path && (step.params as any).key) {
              lutrisRegistrySettings.push({
                path: (step.params as any).path,
                name: (step.params as any).key,
                type: (step.params as any).type || 'REG_SZ',
                value: (step.params as any).value || '',
              });
            }
            break;
        }
      }
      
      console.log(`  Lutris steps: ${lutrisExtractSteps.length} extract, ${lutrisMoveSteps.length} move/merge, ${lutrisExecuteSteps.length} execute, ${lutrisWineexecSteps.length} wineexec, ${lutrisRegistrySettings.length} registry`);
    }

    // Start installation container
    const containerInfo = await dockerService.installGame({
      installerPath,
      installPath,
      platform,
      sessionId,
      game,
      installerArgs,
      debugMode,
      wineVersionId,
      wineArch: effectiveWineArch,
      winetricks,
      dllOverrides,
      environmentVariables,
      lutrisExtractSteps: lutrisExtractSteps.length > 0 ? lutrisExtractSteps : undefined,
      lutrisMoveSteps: lutrisMoveSteps.length > 0 ? lutrisMoveSteps : undefined,
      lutrisExecuteSteps: lutrisExecuteSteps.length > 0 ? lutrisExecuteSteps : undefined,
      lutrisWineexecSteps: lutrisWineexecSteps.length > 0 ? lutrisWineexecSteps : undefined,
      lutrisRegistrySettings: lutrisRegistrySettings.length > 0 ? lutrisRegistrySettings : undefined,
    });

    // Update game with installation information
    const updatedAt = new Date().toISOString();
    const updatedGame = updateGameInstallationFields(game, platformId, {
      status: 'installing' as const,
      installPath,
      installerPath,
      installerArgs,
      containerId: containerInfo.containerId,
      platformId,
      installMethod: 'automated' as const,
      wineVersionId: wineVersionId || 'system', // Store the Wine version used for installation
      wineArch: wineArch || 'win64', // Store the Wine architecture used for installation
    } as any);

    (updatedGame as any).updated = updatedAt;

    await storage.writeEntity('games', fileKey, updatedGame);

    console.log(`✓ Installation started with container: ${containerInfo.containerId}`);

    // Kick off a background monitor so the library status updates even if the UI
    // doesn't poll the /install status endpoint.
    void (async () => {
      try {
        const containerResult = await dockerService.waitForInstallationComplete(containerInfo.containerId);
        const executables = await dockerService.scanForGameExecutables(installPath);
        const hasExecutables = executables.length > 0;

        const nextStatus = hasExecutables
          ? ('installed' as const)
          : (containerResult.success ? ('installed' as const) : ('failed' as const));

        const latest = await storage.readEntity<Game>('games', fileKey);
        if (!latest) return;

        // Try to get launch command from Lutris script's game.exe field
        const latestPlatformConfig = latest.platforms?.find((p: GamePlatformConfig) => p.platformId === platformId);
        const lutrisScript = latestPlatformConfig?.lutrisInstaller?.script ||
          latestPlatformConfig?.lutrisInstallers?.find(i => i.id === latestPlatformConfig?.selectedLutrisInstallerId)?.script;
        const lutrisScriptExe = (lutrisScript?.game as Record<string, unknown> | undefined)?.exe as string | undefined;

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
        // Priority: 1) Lutris script game.exe, 2) First scanned executable
        if (lutrisScriptExe) {
          // Lutris exe paths are relative to the install directory, e.g., "drive_c/Program Files/Game/game.exe"
          // or just "game.exe" if it's in the root
          (completedGame as any).filePath = `${installPath}/${lutrisScriptExe}`;
          (completedGame as any).settings = {
            ...(completedGame as any).settings,
            launch: {
              ...((completedGame as any).settings?.launch || {}),
              command: lutrisScriptExe,
              workingDirectory:
                (completedGame as any).settings?.launch?.workingDirectory || installPath || '',
            },
          };
          console.log(`  🎯 Auto-configured launch from Lutris script: ${lutrisScriptExe}`);
        } else if (hasExecutables) {
          (completedGame as any).filePath = `${installPath}/${executables[0]}`;
          (completedGame as any).settings = {
            ...(completedGame as any).settings,
            launch: {
              ...((completedGame as any).settings?.launch || {}),
              workingDirectory:
                (completedGame as any).settings?.launch?.workingDirectory || installPath || '',
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
      containerName: debugMode ? `dillinger-install-debug-${sessionId}` : `dillinger-install-${sessionId}`,
      debugMode: debugMode || false,
      message: debugMode 
        ? 'Installation started in DEBUG MODE. Container will be kept for inspection after exit.'
        : 'Installation started. The installation GUI should appear on your display.',
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

        // Try to get launch command from Lutris script's game.exe field
        const getPlatformConfig = game.platforms?.find((p: GamePlatformConfig) => p.platformId === installPlatformId);
        const getLutrisScript = getPlatformConfig?.lutrisInstaller?.script ||
          getPlatformConfig?.lutrisInstallers?.find(i => i.id === getPlatformConfig?.selectedLutrisInstallerId)?.script;
        const lutrisScriptExe = (getLutrisScript?.game as Record<string, unknown> | undefined)?.exe as string | undefined;

        let updatedGame = updateGameInstallationFields(game, installPlatformId, {
          ...installation,
          status: finalStatus,
          installedAt: finalStatus === 'installed' ? finishedAt : undefined,
          error: finalStatus === 'failed'
            ? (hasExecutables ? undefined : `Installation failed with exit code ${containerResult.exitCode}`)
            : undefined,
          containerId: undefined,
        } as any);

        // Auto-select executable - priority: 1) Lutris script game.exe, 2) First scanned executable
        if (lutrisScriptExe) {
          (updatedGame as any).filePath = `${installation.installPath}/${lutrisScriptExe}`;
          (updatedGame as any).settings = {
            ...(updatedGame as any).settings,
            launch: {
              ...((updatedGame as any).settings?.launch || {}),
              command: lutrisScriptExe,
              workingDirectory:
                (updatedGame as any).settings?.launch?.workingDirectory || installation.installPath || '',
            },
          };
          console.log(`  🎯 Auto-configured launch from Lutris script: ${lutrisScriptExe}`);
        } else if (hasExecutables) {
          (updatedGame as any).filePath = `${installation.installPath}/${executables[0]}`;
          (updatedGame as any).settings = {
            ...(updatedGame as any).settings,
            launch: {
              ...((updatedGame as any).settings?.launch || {}),
              workingDirectory:
                (updatedGame as any).settings?.launch?.workingDirectory || installation.installPath || '',
            },
          };
        } else {
          (updatedGame as any).settings = {
            ...(updatedGame as any).settings,
            launch: {
              ...((updatedGame as any).settings?.launch || {}),
              workingDirectory:
                (updatedGame as any).settings?.launch?.workingDirectory || installation.installPath || '',
            },
          };
        }

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

// DELETE /api/games/[id]/install - Cancel an in-progress installation
export async function DELETE(
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
    const platformId = (installation as any)?.platformId || game.defaultPlatformId || 'windows-wine';

    // Try to stop and remove the container if it exists
    if (installation?.containerId) {
      try {
        console.log(`🛑 Stopping installation container: ${installation.containerId}`);
        await dockerService.stopContainer(installation.containerId);
        await dockerService.removeContainer(installation.containerId, true);
        console.log(`✓ Container removed: ${installation.containerId}`);
      } catch (containerError) {
        // Container might already be stopped/removed, that's OK
        console.warn(`Container cleanup warning: ${containerError}`);
      }
    }

    // Reset installation status to not_installed
    const updatedAt = new Date().toISOString();
    const updatedGame = updateGameInstallationFields(game, platformId, {
      status: 'not_installed' as const,
      installPath: undefined,
      installerPath: undefined,
      installerArgs: undefined,
      containerId: undefined,
      installedAt: undefined,
      error: undefined,
      wineVersionId: undefined,
      wineArch: undefined,
    } as any);

    (updatedGame as any).updated = updatedAt;

    await storage.writeEntity('games', fileKey, updatedGame);

    console.log(`✓ Installation cancelled for ${game.title}`);

    return NextResponse.json({
      success: true,
      message: 'Installation cancelled',
    });
  } catch (error) {
    console.error('Error cancelling installation:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to cancel installation',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
