import fs from 'fs-extra';
import path from 'path';
import { DILLINGER_CORE_PATH } from './settings';
import { searchLutrisInstallers, type LutrisInstallerSummary } from './lutris-service';
import { loadIndex, lookupByGogId, lookupBySlug, lookupBySteamAppId, lookupByTitle, type ProtonfixEntry } from './protonfixes-parser';

export interface CompatibilitySource {
  name: 'protonfixes' | 'lutris' | 'protondb' | 'pcgamingwiki' | 'umu';
  found: boolean;
  url?: string;
  data?: unknown;
  error?: string;
}

export interface MergedFixes {
  umuGameId?: string;
  winetricks: string[];
  dllOverrides: Record<string, string>;
  envVars: Record<string, string>;
  delEnvVars: string[];
  commandReplacements: Array<{ from: string; to: string }>;
  registry: Array<{ path: string; name: string; type: string; value: string }>;
  flags: string[];
  dxvkOptions: Record<string, string>;
  recommendedDxvk: boolean;
  recommendedVkd3d: boolean;
  recommendedArch: 'win32' | 'win64';
  suggestedExe?: string;
  hasComplexFixes: boolean;
  complexFixNotes?: string;
}

export interface CompatibilityReport {
  game: {
    title: string;
    slug: string;
    gogId?: string;
    steamAppId?: string;
  };
  generatedAt: string;
  sources: CompatibilitySource[];
  merged: MergedFixes;
  protondbTier?: 'native' | 'platinum' | 'gold' | 'silver' | 'bronze' | 'borked';
  protondbConfidence?: string;
  protondbTotal?: number;
  confidence: 'high' | 'medium' | 'low' | 'none';
  metadata: {
    cacheKey: string;
    protonfixesCommit?: string;
  };
}

export interface CompatibilityLookupInput {
  title: string;
  slug?: string;
  gogId?: string;
}

interface UmuLookupResult {
  umuGameId?: string;
  steamAppId?: string;
  raw?: unknown;
}

const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const CACHE_DIR = path.join(DILLINGER_CORE_PATH, 'storage', 'cache', 'compat');

function normalizeSlug(value: string | undefined): string {
  const base = (value || 'game').trim().toLowerCase();
  return base.replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'game';
}

function toSetArray(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function isDx12Like(value: string): boolean {
  const lower = value.toLowerCase();
  return lower.includes('directx 12') || lower.includes('dx12') || lower.includes('d3d12') || lower.includes('vulkan');
}

function parseSteamAppId(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return value.trim();
  }
  return undefined;
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 8000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function lookupUmu(gogId: string | undefined): Promise<UmuLookupResult> {
  if (!gogId) {
    return {};
  }

  const url = `https://umu.openwinecomponents.org/umu_api.php?codename=${encodeURIComponent(gogId)}&store=gog`;
  const payload = await fetchJsonWithTimeout(url);

  const asRecord = (payload && typeof payload === 'object' ? payload : null) as Record<string, unknown> | null;
  const umuGameId = typeof asRecord?.umu_id === 'string'
    ? asRecord.umu_id
    : typeof asRecord?.UMU_ID === 'string'
      ? asRecord.UMU_ID
      : undefined;

  const steamAppId =
    parseSteamAppId(asRecord?.steam_appid) ||
    parseSteamAppId(asRecord?.steamAppId) ||
    parseSteamAppId(asRecord?.steam_id) ||
    parseSteamAppId(asRecord?.STEAM_APPID);

  return {
    umuGameId,
    steamAppId,
    raw: payload,
  };
}

function extractWinetricksFromLutris(installers: LutrisInstallerSummary[]): string[] {
  const collected: string[] = [];
  for (const installer of installers) {
    for (const step of installer.script.installer || []) {
      if (step.task?.name === 'winetricks' && step.task.app) {
        collected.push(...step.task.app.split(/[\s,]+/).filter(Boolean));
      }
    }
  }
  return toSetArray(collected);
}

function pickRecommendedArch(installers: LutrisInstallerSummary[]): 'win32' | 'win64' {
  for (const installer of installers) {
    const arch = installer.script.game?.arch;
    if (arch === 'win32' || arch === 'win64') {
      return arch;
    }
  }
  return 'win64';
}

function determineConfidence(sources: CompatibilitySource[]): 'high' | 'medium' | 'low' | 'none' {
  const foundCount = sources.filter((source) => source.found).length;
  if (foundCount >= 3) return 'high';
  if (foundCount === 2) return 'medium';
  if (foundCount === 1) return 'low';
  return 'none';
}

async function getCachePath(cacheKey: string): Promise<string> {
  await fs.ensureDir(CACHE_DIR);
  return path.join(CACHE_DIR, `${cacheKey}.json`);
}

async function readCachedReport(cacheKey: string, currentCommit?: string): Promise<CompatibilityReport | null> {
  const cachePath = await getCachePath(cacheKey);
  if (!(await fs.pathExists(cachePath))) {
    return null;
  }

  const stats = await fs.stat(cachePath);
  if (Date.now() - stats.mtimeMs > CACHE_TTL_MS) {
    return null;
  }

  const cached = (await fs.readJson(cachePath)) as CompatibilityReport;
  if (!cached?.metadata?.cacheKey || cached.metadata.cacheKey !== cacheKey) {
    return null;
  }

  if (currentCommit && cached.metadata?.protonfixesCommit && cached.metadata.protonfixesCommit !== currentCommit) {
    return null;
  }

  return cached;
}

async function writeCachedReport(report: CompatibilityReport): Promise<void> {
  const cachePath = await getCachePath(report.metadata.cacheKey);
  await fs.writeJson(cachePath, report, { spaces: 2 });
}

export async function lookupCompatibility(
  input: CompatibilityLookupInput,
  options: { bustCache?: boolean } = {}
): Promise<CompatibilityReport> {
  const normalizedSlug = normalizeSlug(input.slug || input.title);
  const cacheKey = normalizedSlug;

  const index = await loadIndex();
  const protonfixesCommit = index?.commit;

  if (!options.bustCache) {
    const cached = await readCachedReport(cacheKey, protonfixesCommit);
    if (cached) {
      return cached;
    }
  }

  const sources: CompatibilitySource[] = [];

  let umuLookup: UmuLookupResult = {};
  try {
    umuLookup = await lookupUmu(input.gogId);
    sources.push({
      name: 'umu',
      found: Boolean(umuLookup.umuGameId || umuLookup.steamAppId),
      url: input.gogId
        ? `https://umu.openwinecomponents.org/umu_api.php?codename=${encodeURIComponent(input.gogId)}&store=gog`
        : undefined,
      data: umuLookup.raw,
    });
  } catch (error) {
    sources.push({
      name: 'umu',
      found: false,
      error: error instanceof Error ? error.message : 'UMU lookup failed',
    });
  }

  const steamAppId = umuLookup.steamAppId;

  const [
    protonfixResult,
    lutrisResult,
    protondbResult,
    pcgwResult,
  ] = await Promise.all([
    (async () => {
      let protonfixEntry: ProtonfixEntry | null = null;
      try {
        if (input.gogId) {
          protonfixEntry = await lookupByGogId(input.gogId);
        }
        if (!protonfixEntry && steamAppId) {
          protonfixEntry = await lookupBySteamAppId(steamAppId);
        }
        if (!protonfixEntry && input.slug) {
          protonfixEntry = await lookupBySlug(input.slug);
        }
        if (!protonfixEntry) {
          const titleMatches = await lookupByTitle(input.title);
          protonfixEntry = titleMatches[0] || null;
        }

        return {
          protonfixEntry,
          source: {
            name: 'protonfixes' as const,
            found: Boolean(protonfixEntry),
            url: protonfixEntry
              ? `https://github.com/Open-Wine-Components/umu-protonfixes/blob/main/${protonfixEntry.script_path}`
              : undefined,
            data: protonfixEntry || undefined,
          },
        };
      } catch (error) {
        return {
          protonfixEntry: null,
          source: {
            name: 'protonfixes' as const,
            found: false,
            error: error instanceof Error ? error.message : 'Protonfixes lookup failed',
          },
        };
      }
    })(),
    (async () => {
      let lutrisInstallers: LutrisInstallerSummary[] = [];
      try {
        if (input.gogId) {
          lutrisInstallers = await searchLutrisInstallers(input.title, Number(input.gogId));
        }
        return {
          lutrisInstallers,
          source: {
            name: 'lutris' as const,
            found: lutrisInstallers.length > 0,
            url: `https://lutris.net/games?q=${encodeURIComponent(input.title)}`,
            data: lutrisInstallers,
          },
        };
      } catch (error) {
        return {
          lutrisInstallers,
          source: {
            name: 'lutris' as const,
            found: false,
            error: error instanceof Error ? error.message : 'Lutris lookup failed',
          },
        };
      }
    })(),
    (async () => {
      let protondbTier: CompatibilityReport['protondbTier'];
      let protondbConfidence: string | undefined;
      let protondbTotal: number | undefined;

      try {
        if (!steamAppId) {
          return {
            protondbTier,
            protondbConfidence,
            protondbTotal,
            source: {
              name: 'protondb' as const,
              found: false,
              error: 'No Steam App ID available',
            },
          };
        }

        const protondbUrl = `https://www.protondb.com/api/v1/reports/summaries/${steamAppId}.json`;
        const protondb = (await fetchJsonWithTimeout(protondbUrl)) as Record<string, unknown>;
        const tier = typeof protondb.tier === 'string' ? protondb.tier.toLowerCase() : undefined;
        if (tier === 'native' || tier === 'platinum' || tier === 'gold' || tier === 'silver' || tier === 'bronze' || tier === 'borked') {
          protondbTier = tier;
        }
        protondbConfidence = typeof protondb.confidence === 'string' ? protondb.confidence : undefined;
        protondbTotal = typeof protondb.total === 'number' ? protondb.total : undefined;

        return {
          protondbTier,
          protondbConfidence,
          protondbTotal,
          source: {
            name: 'protondb' as const,
            found: Boolean(protondbTier),
            url: `https://www.protondb.com/app/${steamAppId}`,
            data: protondb,
          },
        };
      } catch (error) {
        return {
          protondbTier,
          protondbConfidence,
          protondbTotal,
          source: {
            name: 'protondb' as const,
            found: false,
            error: error instanceof Error ? error.message : 'ProtonDB lookup failed',
          },
        };
      }
    })(),
    (async () => {
      let pcgwData: Record<string, unknown> | undefined;
      let pcgwDirectX = '';

      try {
        if (!steamAppId) {
          return {
            pcgwData,
            pcgwDirectX,
            source: {
              name: 'pcgamingwiki' as const,
              found: false,
              error: 'No Steam App ID available',
            },
          };
        }

        const pcgwUrl =
          'https://www.pcgamingwiki.com/w/api.php?action=cargoquery&format=json' +
          '&tables=Infobox_game' +
          '&fields=Infobox_game._pageName%3Dtitle,Infobox_game.API,Infobox_game.Steam_AppID' +
          `&where=Infobox_game.Steam_AppID+HOLDS+%22${encodeURIComponent(steamAppId)}%22`;

        const payload = (await fetchJsonWithTimeout(pcgwUrl)) as Record<string, unknown>;
        const rows = Array.isArray(payload.cargoquery)
          ? (payload.cargoquery as Array<{ title?: Record<string, string> }>).map((row) => row.title || {})
          : [];
        pcgwData = { rows };

        const first = rows[0] || {};
        const apiField = first.API || '';
        pcgwDirectX = typeof apiField === 'string' ? apiField : '';

        return {
          pcgwData,
          pcgwDirectX,
          source: {
            name: 'pcgamingwiki' as const,
            found: rows.length > 0,
            url: `https://www.pcgamingwiki.com/wiki/Special:CargoQuery?tables=Infobox_game&fields=title,API,Steam_AppID&where=Steam_AppID+HOLDS+%22${steamAppId}%22`,
            data: pcgwData,
          },
        };
      } catch (error) {
        return {
          pcgwData,
          pcgwDirectX,
          source: {
            name: 'pcgamingwiki' as const,
            found: false,
            error: error instanceof Error ? error.message : 'PCGamingWiki lookup failed',
          },
        };
      }
    })(),
  ]);

  const protonfixEntry = protonfixResult.protonfixEntry;
  const lutrisInstallers = lutrisResult.lutrisInstallers;
  const protondbTier = protondbResult.protondbTier;
  const protondbConfidence = protondbResult.protondbConfidence;
  const protondbTotal = protondbResult.protondbTotal;
  const pcgwDirectX = pcgwResult.pcgwDirectX;

  sources.push(protonfixResult.source, lutrisResult.source, protondbResult.source, pcgwResult.source);

  const lutrisWinetricks = extractWinetricksFromLutris(lutrisInstallers);
  const lutrisDllOverrides = lutrisInstallers[0]?.script?.wine?.overrides || {};
  const lutrisSuggestedExe = lutrisInstallers[0]?.script?.game?.exe;

  const merged: MergedFixes = {
    umuGameId: umuLookup.umuGameId,
    winetricks: toSetArray([...(protonfixEntry?.winetricks || []), ...lutrisWinetricks]),
    dllOverrides: {
      ...(protonfixEntry?.dll_overrides || {}),
      ...lutrisDllOverrides,
    },
    envVars: {
      ...(protonfixEntry?.env_vars || {}),
    },
    delEnvVars: toSetArray([...(protonfixEntry?.del_env_vars || [])]),
    commandReplacements: [...(protonfixEntry?.command_replacements || [])],
    registry: [...(protonfixEntry?.registry || [])],
    flags: toSetArray([...(protonfixEntry?.flags || [])]),
    dxvkOptions: {
      ...(protonfixEntry?.dxvk_options || {}),
    },
    recommendedDxvk: !pcgwDirectX || !isDx12Like(pcgwDirectX),
    recommendedVkd3d: isDx12Like(pcgwDirectX),
    recommendedArch: pickRecommendedArch(lutrisInstallers),
    suggestedExe:
      lutrisSuggestedExe ||
      protonfixEntry?.command_replacements[0]?.to ||
      protonfixEntry?.command_replacements[0]?.from,
    hasComplexFixes: Boolean(protonfixEntry?.has_complex_logic),
    complexFixNotes: protonfixEntry?.has_complex_logic ? protonfixEntry?.notes || 'Complex logic detected in protonfix script.' : undefined,
  };

  const report: CompatibilityReport = {
    game: {
      title: input.title,
      slug: normalizedSlug,
      gogId: input.gogId,
      steamAppId,
    },
    generatedAt: new Date().toISOString(),
    sources,
    merged,
    protondbTier,
    protondbConfidence,
    protondbTotal,
    confidence: determineConfidence(sources),
    metadata: {
      cacheKey,
      protonfixesCommit,
    },
  };

  await writeCachedReport(report);
  return report;
}
