"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.lookupCompatibility = lookupCompatibility;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const settings_1 = require("./settings");
const lutris_service_1 = require("./lutris-service");
const protonfixes_parser_1 = require("./protonfixes-parser");
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const CACHE_DIR = path_1.default.join(settings_1.DILLINGER_CORE_PATH, 'storage', 'cache', 'compat');
function normalizeSlug(value) {
    const base = (value || 'game').trim().toLowerCase();
    return base.replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'game';
}
function toSetArray(values) {
    return Array.from(new Set(values.filter(Boolean)));
}
function isDx12Like(value) {
    const lower = value.toLowerCase();
    return lower.includes('directx 12') || lower.includes('dx12') || lower.includes('d3d12') || lower.includes('vulkan');
}
function parseSteamAppId(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(Math.trunc(value));
    }
    if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
        return value.trim();
    }
    return undefined;
}
async function fetchJsonWithTimeout(url, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return await response.json();
    }
    finally {
        clearTimeout(timer);
    }
}
async function lookupUmu(gogId) {
    if (!gogId) {
        return {};
    }
    const url = `https://umu.openwinecomponents.org/umu_api.php?codename=${encodeURIComponent(gogId)}&store=gog`;
    const payload = await fetchJsonWithTimeout(url);
    const asRecord = (payload && typeof payload === 'object' ? payload : null);
    const umuGameId = typeof asRecord?.umu_id === 'string'
        ? asRecord.umu_id
        : typeof asRecord?.UMU_ID === 'string'
            ? asRecord.UMU_ID
            : undefined;
    const steamAppId = parseSteamAppId(asRecord?.steam_appid) ||
        parseSteamAppId(asRecord?.steamAppId) ||
        parseSteamAppId(asRecord?.steam_id) ||
        parseSteamAppId(asRecord?.STEAM_APPID);
    return {
        umuGameId,
        steamAppId,
        raw: payload,
    };
}
function extractWinetricksFromLutris(installers) {
    const collected = [];
    for (const installer of installers) {
        for (const step of installer.script.installer || []) {
            if (step.task?.name === 'winetricks' && step.task.app) {
                collected.push(...step.task.app.split(/[\s,]+/).filter(Boolean));
            }
        }
    }
    return toSetArray(collected);
}
function pickRecommendedArch(installers) {
    for (const installer of installers) {
        const arch = installer.script.game?.arch;
        if (arch === 'win32' || arch === 'win64') {
            return arch;
        }
    }
    return 'win64';
}
function determineConfidence(sources) {
    const foundCount = sources.filter((source) => source.found).length;
    if (foundCount >= 3)
        return 'high';
    if (foundCount === 2)
        return 'medium';
    if (foundCount === 1)
        return 'low';
    return 'none';
}
async function getCachePath(cacheKey) {
    await fs_extra_1.default.ensureDir(CACHE_DIR);
    return path_1.default.join(CACHE_DIR, `${cacheKey}.json`);
}
async function readCachedReport(cacheKey, currentCommit) {
    const cachePath = await getCachePath(cacheKey);
    if (!(await fs_extra_1.default.pathExists(cachePath))) {
        return null;
    }
    const stats = await fs_extra_1.default.stat(cachePath);
    if (Date.now() - stats.mtimeMs > CACHE_TTL_MS) {
        return null;
    }
    const cached = (await fs_extra_1.default.readJson(cachePath));
    if (!cached?.metadata?.cacheKey || cached.metadata.cacheKey !== cacheKey) {
        return null;
    }
    if (currentCommit && cached.metadata?.protonfixesCommit && cached.metadata.protonfixesCommit !== currentCommit) {
        return null;
    }
    return cached;
}
async function writeCachedReport(report) {
    const cachePath = await getCachePath(report.metadata.cacheKey);
    await fs_extra_1.default.writeJson(cachePath, report, { spaces: 2 });
}
async function lookupCompatibility(input, options = {}) {
    const normalizedSlug = normalizeSlug(input.slug || input.title);
    const cacheKey = normalizedSlug;
    const index = await (0, protonfixes_parser_1.loadIndex)();
    const protonfixesCommit = index?.commit;
    if (!options.bustCache) {
        const cached = await readCachedReport(cacheKey, protonfixesCommit);
        if (cached) {
            return cached;
        }
    }
    const sources = [];
    let umuLookup = {};
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
    }
    catch (error) {
        sources.push({
            name: 'umu',
            found: false,
            error: error instanceof Error ? error.message : 'UMU lookup failed',
        });
    }
    const steamAppId = umuLookup.steamAppId;
    const [protonfixResult, lutrisResult, protondbResult, pcgwResult,] = await Promise.all([
        (async () => {
            let protonfixEntry = null;
            try {
                if (input.gogId) {
                    protonfixEntry = await (0, protonfixes_parser_1.lookupByGogId)(input.gogId);
                }
                if (!protonfixEntry && steamAppId) {
                    protonfixEntry = await (0, protonfixes_parser_1.lookupBySteamAppId)(steamAppId);
                }
                if (!protonfixEntry && input.slug) {
                    protonfixEntry = await (0, protonfixes_parser_1.lookupBySlug)(input.slug);
                }
                if (!protonfixEntry) {
                    const titleMatches = await (0, protonfixes_parser_1.lookupByTitle)(input.title);
                    protonfixEntry = titleMatches[0] || null;
                }
                return {
                    protonfixEntry,
                    source: {
                        name: 'protonfixes',
                        found: Boolean(protonfixEntry),
                        url: protonfixEntry
                            ? `https://github.com/Open-Wine-Components/umu-protonfixes/blob/main/${protonfixEntry.script_path}`
                            : undefined,
                        data: protonfixEntry || undefined,
                    },
                };
            }
            catch (error) {
                return {
                    protonfixEntry: null,
                    source: {
                        name: 'protonfixes',
                        found: false,
                        error: error instanceof Error ? error.message : 'Protonfixes lookup failed',
                    },
                };
            }
        })(),
        (async () => {
            let lutrisInstallers = [];
            try {
                if (input.gogId) {
                    lutrisInstallers = await (0, lutris_service_1.searchLutrisInstallers)(input.title, Number(input.gogId));
                }
                return {
                    lutrisInstallers,
                    source: {
                        name: 'lutris',
                        found: lutrisInstallers.length > 0,
                        url: `https://lutris.net/games?q=${encodeURIComponent(input.title)}`,
                        data: lutrisInstallers,
                    },
                };
            }
            catch (error) {
                return {
                    lutrisInstallers,
                    source: {
                        name: 'lutris',
                        found: false,
                        error: error instanceof Error ? error.message : 'Lutris lookup failed',
                    },
                };
            }
        })(),
        (async () => {
            let protondbTier;
            let protondbConfidence;
            let protondbTotal;
            try {
                if (!steamAppId) {
                    return {
                        protondbTier,
                        protondbConfidence,
                        protondbTotal,
                        source: {
                            name: 'protondb',
                            found: false,
                            error: 'No Steam App ID available',
                        },
                    };
                }
                const protondbUrl = `https://www.protondb.com/api/v1/reports/summaries/${steamAppId}.json`;
                const protondb = (await fetchJsonWithTimeout(protondbUrl));
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
                        name: 'protondb',
                        found: Boolean(protondbTier),
                        url: `https://www.protondb.com/app/${steamAppId}`,
                        data: protondb,
                    },
                };
            }
            catch (error) {
                return {
                    protondbTier,
                    protondbConfidence,
                    protondbTotal,
                    source: {
                        name: 'protondb',
                        found: false,
                        error: error instanceof Error ? error.message : 'ProtonDB lookup failed',
                    },
                };
            }
        })(),
        (async () => {
            let pcgwData;
            let pcgwDirectX = '';
            try {
                if (!steamAppId) {
                    return {
                        pcgwData,
                        pcgwDirectX,
                        source: {
                            name: 'pcgamingwiki',
                            found: false,
                            error: 'No Steam App ID available',
                        },
                    };
                }
                const pcgwUrl = 'https://www.pcgamingwiki.com/w/api.php?action=cargoquery&format=json' +
                    '&tables=Infobox_game' +
                    '&fields=Infobox_game._pageName%3Dtitle,Infobox_game.API,Infobox_game.Steam_AppID' +
                    `&where=Infobox_game.Steam_AppID+HOLDS+%22${encodeURIComponent(steamAppId)}%22`;
                const payload = (await fetchJsonWithTimeout(pcgwUrl));
                const rows = Array.isArray(payload.cargoquery)
                    ? payload.cargoquery.map((row) => row.title || {})
                    : [];
                pcgwData = { rows };
                const first = rows[0] || {};
                const apiField = first.API || '';
                pcgwDirectX = typeof apiField === 'string' ? apiField : '';
                return {
                    pcgwData,
                    pcgwDirectX,
                    source: {
                        name: 'pcgamingwiki',
                        found: rows.length > 0,
                        url: `https://www.pcgamingwiki.com/wiki/Special:CargoQuery?tables=Infobox_game&fields=title,API,Steam_AppID&where=Steam_AppID+HOLDS+%22${steamAppId}%22`,
                        data: pcgwData,
                    },
                };
            }
            catch (error) {
                return {
                    pcgwData,
                    pcgwDirectX,
                    source: {
                        name: 'pcgamingwiki',
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
    const merged = {
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
        suggestedExe: lutrisSuggestedExe ||
            protonfixEntry?.command_replacements[0]?.to ||
            protonfixEntry?.command_replacements[0]?.from,
        hasComplexFixes: Boolean(protonfixEntry?.has_complex_logic),
        complexFixNotes: protonfixEntry?.has_complex_logic ? protonfixEntry?.notes || 'Complex logic detected in protonfix script.' : undefined,
    };
    const report = {
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
