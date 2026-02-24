import { NextRequest, NextResponse } from 'next/server';
import type { Game } from '@dillinger/shared';
import { JSONStorageService } from '@/lib/services/storage';
import { lookupCompatibility } from '@/lib/services/compatibility-service';
import type { LutrisInstallerSummary } from '@/lib/services/lutris-service';

const storage = JSONStorageService.getInstance();

interface CompatibilitySourceResult {
  name: 'umu' | 'protonfixes' | 'lutris' | 'protondb' | 'pcgamingwiki';
  found: boolean;
  message: string;
  url?: string;
  data?: unknown;
}

interface CompatibilityReport {
  game: {
    id: string;
    title: string;
    slug?: string;
    gogId?: number;
  };
  generatedAt: string;
  sources: CompatibilitySourceResult[];
  suggestions: {
    installMethod: 'lutris' | 'standard' | 'manual';
    lutrisInstallers: Array<{
      id: number;
      slug: string;
      version: string;
      runner: string;
      arch?: 'win32' | 'win64';
      winetricksCount: number;
      dllOverrideCount: number;
    }>;
    suggestedLutrisInstallerId?: number;
    suggestedUmuGameId?: string;
    recommendedArch?: 'win32' | 'win64';
    suggestedExe?: string;
    winetricks: string[];
  };
}

function parseLutrisScriptSummary(script: LutrisInstallerSummary['script']): {
  arch?: 'win32' | 'win64';
  winetricksCount: number;
  dllOverrideCount: number;
} {
  const arch = script.game?.arch;

  let winetricksCount = 0;
  for (const step of script.installer || []) {
    if (step.task?.name === 'winetricks' && step.task.app) {
      winetricksCount += step.task.app.split(/\s+/).filter(Boolean).length;
    }
  }

  const dllOverrideCount = Object.keys(script.wine?.overrides || {}).length;

  return {
    arch: arch === 'win32' || arch === 'win64' ? arch : undefined,
    winetricksCount,
    dllOverrideCount,
  };
}

function extractGogId(game: Game): number | undefined {
  const directMetadataId = (game.metadata as { gogId?: unknown } | undefined)?.gogId;
  if (typeof directMetadataId === 'number' && Number.isFinite(directMetadataId)) {
    return directMetadataId;
  }

  const slugCandidate = game.slug || '';
  const trailingDigits = slugCandidate.match(/(\d{8,})$/)?.[1];
  if (trailingDigits) {
    const parsed = Number(trailingDigits);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

async function findGame(gameId: string): Promise<Game | null> {
  const directGame = await storage.readEntity<Game>('games', gameId);
  if (directGame) {
    return directGame;
  }

  const allGames = await storage.listEntities<Game>('games');
  return allGames.find((game) => game.id === gameId || game.slug === gameId) || null;
}

async function buildCompatibilityReport(game: Game, options: { bustCache?: boolean } = {}): Promise<CompatibilityReport> {
  const gogId = extractGogId(game);

  const report = await lookupCompatibility({
    title: game.title,
    slug: game.slug,
    gogId: gogId ? String(gogId) : undefined,
  }, { bustCache: options.bustCache });

  const sources: CompatibilitySourceResult[] = report.sources.map((source) => ({
    name: source.name,
    found: source.found,
    message: source.error
      ? source.error
      : source.found
        ? 'Compatibility data found'
        : 'No compatibility data found',
    url: source.url,
    data: source.data,
  }));

  const lutrisSource = report.sources.find((source) => source.name === 'lutris');
  const lutrisInstallers = Array.isArray(lutrisSource?.data)
    ? (lutrisSource?.data as LutrisInstallerSummary[])
    : [];

  const normalizedLutrisInstallers = lutrisInstallers.map((installer) => {
    const parsed = parseLutrisScriptSummary(installer.script);
    return {
      id: installer.id,
      slug: installer.slug,
      version: installer.version,
      runner: installer.runner,
      arch: parsed.arch,
      winetricksCount: parsed.winetricksCount,
      dllOverrideCount: parsed.dllOverrideCount,
    };
  });

  const firstInstaller = lutrisInstallers[0];
  const parsedScript = firstInstaller?.script;
  const recommendedArch = report.merged.recommendedArch || parsedScript?.game?.arch;
  const suggestedExe = report.merged.suggestedExe || parsedScript?.game?.exe;

  const normalized: CompatibilityReport = {
    game: {
      id: game.id,
      title: game.title,
      slug: game.slug,
      gogId,
    },
    generatedAt: report.generatedAt,
    sources,
    suggestions: {
      installMethod: lutrisInstallers.length > 0 ? 'lutris' : 'standard',
      lutrisInstallers: normalizedLutrisInstallers,
      suggestedLutrisInstallerId: normalizedLutrisInstallers[0]?.id,
      suggestedUmuGameId: report.merged.umuGameId || (gogId ? `umu-${gogId}` : game.slug ? `umu-${game.slug}` : undefined),
      recommendedArch: recommendedArch === 'win32' || recommendedArch === 'win64' ? recommendedArch : undefined,
      suggestedExe,
      winetricks: report.merged.winetricks || [],
    },
  };

  return normalized;
}

async function handleCompatibilityLookup(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    if (!gameId) {
      return NextResponse.json({ success: false, error: 'Game ID is required' }, { status: 400 });
    }

    const game = await findGame(gameId);
    if (!game) {
      return NextResponse.json({ success: false, error: 'Game not found' }, { status: 404 });
    }

    const shouldBustCache = request.method === 'POST';
    const report = await buildCompatibilityReport(game, { bustCache: shouldBustCache });

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    console.error('Compatibility lookup failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Compatibility lookup failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ gameId: string }> }
) {
  return handleCompatibilityLookup(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ gameId: string }> }
) {
  return handleCompatibilityLookup(request, context);
}
