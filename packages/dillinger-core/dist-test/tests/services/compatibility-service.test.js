"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const axios_1 = __importDefault(require("axios"));
const rootDir = process.cwd();
const indexPath = path_1.default.join(rootDir, 'packages', 'dillinger-core', 'assets', 'generated', 'protonfixes-index.json');
let previousIndexContent = null;
let previousIndexExists = false;
let originalCorePath;
const tempCorePath = path_1.default.join(rootDir, '.tmp', 'core-test-data');
async function writeIndexForCompatibility() {
    const payload = {
        generated_at: new Date().toISOString(),
        commit: 'compat-test-commit',
        fixes: {
            'steam:54321': {
                title: 'Compat Test Game',
                stores: ['steam'],
                gog_ids: [],
                winetricks: ['vcrun2019', 'd3dx9'],
                dll_overrides: { ddraw: 'native,builtin' },
                env_vars: { PULSE_LATENCY_MSEC: '90' },
                del_env_vars: [],
                command_replacements: [{ from: 'old.exe', to: 'game.exe' }],
                registry: [],
                dxvk_options: {},
                flags: ['disable_esync'],
                has_complex_logic: false,
                script_path: 'gamefixes-steam/54321.py',
                notes: '',
            },
        },
        cross_references: {},
        umu_database: {
            'steam:54321': {
                title: 'Compat Test Game',
                store: 'steam',
                codename: '54321',
                umu_id: 'umu-54321',
            },
        },
    };
    await fs_extra_1.default.ensureDir(path_1.default.dirname(indexPath));
    await fs_extra_1.default.writeFile(indexPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
}
node_test_1.default.before(async () => {
    originalCorePath = process.env.DILLINGER_CORE_PATH;
    process.env.DILLINGER_CORE_PATH = tempCorePath;
    previousIndexExists = await fs_extra_1.default.pathExists(indexPath);
    if (previousIndexExists) {
        previousIndexContent = await fs_extra_1.default.readFile(indexPath, 'utf-8');
    }
    await fs_extra_1.default.remove(tempCorePath);
    await writeIndexForCompatibility();
});
node_test_1.default.after(async () => {
    await fs_extra_1.default.remove(tempCorePath);
    if (previousIndexExists && previousIndexContent !== null) {
        await fs_extra_1.default.writeFile(indexPath, previousIndexContent, 'utf-8');
    }
    else {
        await fs_extra_1.default.remove(indexPath);
    }
    if (typeof originalCorePath === 'undefined') {
        delete process.env.DILLINGER_CORE_PATH;
    }
    else {
        process.env.DILLINGER_CORE_PATH = originalCorePath;
    }
});
(0, node_test_1.default)('lookupCompatibility merges protonfix data and writes cache', async () => {
    const { lookupCompatibility } = await import('../../lib/services/compatibility-service.js');
    const report = await lookupCompatibility({
        title: 'Compat Test Game',
        slug: 'compat-test-game',
    });
    strict_1.default.equal(report.game.slug, 'compat-test-game');
    strict_1.default.equal(report.confidence, 'low');
    strict_1.default.deepEqual(report.merged.winetricks.sort(), ['d3dx9', 'vcrun2019']);
    strict_1.default.equal(report.merged.dllOverrides.ddraw, 'native,builtin');
    strict_1.default.equal(report.merged.suggestedExe, 'game.exe');
    strict_1.default.equal(report.metadata.protonfixesCommit, 'compat-test-commit');
    const cachePath = path_1.default.join(tempCorePath, 'storage', 'cache', 'compat', 'compat-test-game.json');
    strict_1.default.equal(await fs_extra_1.default.pathExists(cachePath), true);
});
(0, node_test_1.default)('lookupCompatibility reuses cache unless bustCache is true', async () => {
    const { lookupCompatibility } = await import('../../lib/services/compatibility-service.js');
    const first = await lookupCompatibility({ title: 'Compat Test Game', slug: 'compat-cache-test' });
    const second = await lookupCompatibility({ title: 'Compat Test Game', slug: 'compat-cache-test' });
    strict_1.default.equal(second.generatedAt, first.generatedAt);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const busted = await lookupCompatibility({ title: 'Compat Test Game', slug: 'compat-cache-test' }, { bustCache: true });
    strict_1.default.notEqual(busted.generatedAt, first.generatedAt);
});
(0, node_test_1.default)('lookupCompatibility merges mocked UMU/ProtonDB/PCGW/Lutris responses', async () => {
    const { lookupCompatibility } = await import('../../lib/services/compatibility-service.js');
    const originalFetch = globalThis.fetch;
    const originalAxiosGet = axios_1.default.get;
    const mockedFetch = (async (input) => {
        const url = String(input);
        if (url.includes('umu.openwinecomponents.org')) {
            return {
                ok: true,
                status: 200,
                json: async () => ({ umu_id: 'umu-54321', steam_appid: '54321' }),
            };
        }
        if (url.includes('protondb.com/api/v1/reports/summaries/54321.json')) {
            return {
                ok: true,
                status: 200,
                json: async () => ({ tier: 'gold', confidence: 'high', total: 42 }),
            };
        }
        if (url.includes('pcgamingwiki.com/w/api.php')) {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    cargoquery: [{ title: { title: 'Compat Test Game', API: 'DirectX 12', Steam_AppID: '54321' } }],
                }),
            };
        }
        throw new Error(`Unexpected fetch URL in test: ${url}`);
    });
    const mockedAxiosGet = (async (url) => {
        if (url.includes('/api/games/compat-test-game')) {
            return {
                data: {
                    name: 'Compat Test Game',
                    slug: 'compat-test-game',
                    year: 2020,
                    platforms: [],
                    genres: [],
                    description: '',
                    banner_url: '',
                    icon_url: '',
                    coverart: '',
                    steamid: null,
                    gogslug: null,
                    humblestoreid: null,
                    installers: [
                        {
                            id: 100,
                            game_id: 1,
                            game_slug: 'compat-test-game',
                            name: 'Compat Test Game',
                            year: 2020,
                            user: 'tester',
                            runner: 'wine',
                            slug: 'compat-test-gog',
                            version: 'gog',
                            description: null,
                            notes: '',
                            credits: '',
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                            draft: false,
                            published: true,
                            rating: '5',
                            steamid: null,
                            gogid: 123456,
                            gogslug: null,
                            humbleid: null,
                            script: {
                                game: {
                                    arch: 'win32',
                                    exe: 'lutris-game.exe',
                                },
                                installer: [
                                    {
                                        task: {
                                            name: 'winetricks',
                                            app: 'vcrun2019 corefonts',
                                        },
                                    },
                                ],
                                wine: {
                                    overrides: {
                                        quartz: 'native,builtin',
                                    },
                                },
                            },
                            content: '',
                        },
                    ],
                },
            };
        }
        if (url.endsWith('/api/games')) {
            return {
                data: {
                    count: 1,
                    next: null,
                    previous: null,
                    results: [
                        {
                            id: 1,
                            name: 'Compat Test Game',
                            slug: 'compat-test-game',
                            year: 2020,
                            banner_url: '',
                            icon_url: '',
                            coverart: null,
                            platforms: [],
                            provider_games: [{ name: 'Compat Test Game', slug: '123456', service: 'gog' }],
                            aliases: [],
                        },
                    ],
                },
            };
        }
        throw new Error(`Unexpected axios URL in test: ${url}`);
    });
    globalThis.fetch = mockedFetch;
    axios_1.default.get = mockedAxiosGet;
    try {
        const report = await lookupCompatibility({
            title: 'Compat Test Game',
            slug: 'compat-mocked-apis',
            gogId: '123456',
        }, { bustCache: true });
        strict_1.default.equal(report.game.steamAppId, '54321');
        strict_1.default.equal(report.protondbTier, 'gold');
        strict_1.default.equal(report.protondbConfidence, 'high');
        strict_1.default.equal(report.protondbTotal, 42);
        strict_1.default.equal(report.merged.umuGameId, 'umu-54321');
        strict_1.default.equal(report.merged.recommendedVkd3d, true);
        strict_1.default.equal(report.merged.recommendedDxvk, false);
        strict_1.default.equal(report.merged.recommendedArch, 'win32');
        strict_1.default.equal(report.merged.suggestedExe, 'lutris-game.exe');
        strict_1.default.ok(report.merged.winetricks.includes('corefonts'));
        strict_1.default.equal(report.merged.dllOverrides.quartz, 'native,builtin');
        strict_1.default.equal(report.confidence, 'high');
    }
    finally {
        globalThis.fetch = originalFetch;
        axios_1.default.get = originalAxiosGet;
    }
});
