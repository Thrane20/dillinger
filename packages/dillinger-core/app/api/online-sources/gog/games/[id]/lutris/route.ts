import { NextRequest, NextResponse } from 'next/server';
import { searchLutrisInstallers, parseLutrisScript } from '@/lib/services/lutris-service';
import { getGameDetails } from '@/lib/services/gog-auth';

// Disable caching for this dynamic route
export const dynamic = 'force-dynamic';

/**
 * GET /api/online-sources/gog/games/[id]/lutris
 * Search for Lutris installers for a GOG game
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const gogId = parseInt(id, 10);
    
    if (isNaN(gogId)) {
      return NextResponse.json(
        { error: 'Invalid GOG game ID' },
        { status: 400 }
      );
    }
    
    // Get game details to get the title for searching
    const gameDetails = await getGameDetails(id);
    
    if (!gameDetails) {
      return NextResponse.json(
        { error: 'Failed to get game details' },
        { status: 404 }
      );
    }
    
    const gameTitle = gameDetails.title;
    
    if (!gameTitle) {
      return NextResponse.json(
        { error: 'Game does not have a title for Lutris lookup' },
        { status: 400 }
      );
    }
    
    // Search Lutris for installers using title and GOG ID
    const installers = await searchLutrisInstallers(gameTitle, gogId);
    
    // Parse each installer to get summary info
    const installersWithInfo = installers.map(installer => {
      const parsed = parseLutrisScript(installer.script);
      return {
        ...installer,
        parsed: {
          requiresUserFile: parsed.requiresUserFile,
          userFilePrompt: parsed.userFilePrompt,
          wineArch: parsed.wineArch,
          exePath: parsed.exePath,
          winetricks: parsed.winetricks,
          hasExtractStep: parsed.hasExtractStep,
          hasWineExecStep: parsed.hasWineExecStep,
        },
      };
    });
    
    return NextResponse.json({
      gameTitle,
      gogId,
      installers: installersWithInfo,
      total: installersWithInfo.length,
    });
    
  } catch (error) {
    console.error('Failed to search Lutris installers:', error);
    return NextResponse.json(
      { error: 'Failed to search Lutris installers', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
