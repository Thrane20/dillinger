"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const rootDir = process.cwd();
const tempCorePath = path_1.default.join(rootDir, '.tmp', 'makeitrun-service-test-data');
let originalCorePath;
function createGame(overrides) {
    const now = new Date().toISOString();
    return {
        schemaVersion: '1.0.0',
        id: 'game-1',
        slug: 'test-game',
        title: 'Test Game',
        platforms: [
            {
                platformId: 'windows-wine',
                settings: {
                    wine: {
                        version: 'system',
                        umuGameId: 'umu-test-game',
                        arch: 'win64',
                        renderer: 'vulkan',
                        useDxvk: true,
                        useVkd3dProton: false,
                        compatibilityMode: 'none',
                        winetricks: ['vcrun2019'],
                        dlls: { ddraw: 'native,builtin' },
                        registrySettings: [
                            { path: 'HKCU\\Software\\Wine', name: 'Foo', type: 'REG_SZ', value: 'Bar' },
                        ],
                    },
                    launch: {
                        command: 'Game.exe',
                        arguments: ['-windowed'],
                        workingDirectory: 'C:/Games/Test Game',
                        environment: { FOO: 'BAR' },
                    },
                    gamescope: {
                        enabled: true,
                        width: 1920,
                        height: 1080,
                        refreshRate: 60,
                    },
                    mangohud: {
                        enabled: true,
                    },
                },
                installation: {
                    status: 'installed',
                    installMethod: 'automated',
                    installPath: '/installed/test-game',
                    installerPath: '/cache/test-game.exe',
                    wineVersionId: 'system',
                    wineArch: 'win64',
                },
            },
        ],
        collectionIds: [],
        tags: ['test'],
        metadata: {
            description: 'Test game metadata',
            genre: ['Action'],
            developer: 'Test Dev',
            publisher: 'Test Pub',
            releaseDate: '2024-01-01',
        },
        fileInfo: {
            size: 1024,
            lastModified: now,
        },
        created: now,
        updated: now,
        ...overrides,
    };
}
function createCompatibilityReport() {
    return {
        game: {
            title: 'Test Game',
            slug: 'test-game',
            gogId: '123456',
            steamAppId: '54321',
        },
        generatedAt: new Date().toISOString(),
        sources: [
            { name: 'protonfixes', found: true, url: 'https://example.com/protonfix.py' },
            { name: 'lutris', found: true },
            { name: 'umu', found: true },
        ],
        merged: {
            umuGameId: 'umu-54321',
            winetricks: ['vcrun2019', 'd3dx9'],
            dllOverrides: { quartz: 'disabled' },
            envVars: { PULSE_LATENCY_MSEC: '90' },
            delEnvVars: ['SteamAppId'],
            commandReplacements: [{ from: 'Launcher.exe', to: 'Game.exe' }],
            registry: [{ path: 'HKCU\\Software\\Wine', name: 'Bar', type: 'REG_SZ', value: 'Baz' }],
            flags: ['disable_esync'],
            dxvkOptions: { 'dxgi.nvapiHack': 'False' },
            recommendedDxvk: true,
            recommendedVkd3d: false,
            recommendedArch: 'win32',
            suggestedExe: 'Game.exe',
            hasComplexFixes: true,
            complexFixNotes: 'Contains conditional logic',
        },
        protondbTier: 'gold',
        confidence: 'high',
        metadata: {
            cacheKey: 'compat:test-game',
            protonfixesCommit: 'abc123',
        },
    };
}
node_test_1.default.before(async () => {
    originalCorePath = process.env.DILLINGER_CORE_PATH;
    process.env.DILLINGER_CORE_PATH = tempCorePath;
    await fs_extra_1.default.remove(tempCorePath);
});
node_test_1.default.after(async () => {
    await fs_extra_1.default.remove(tempCorePath);
    if (typeof originalCorePath === 'undefined') {
        delete process.env.DILLINGER_CORE_PATH;
    }
    else {
        process.env.DILLINGER_CORE_PATH = originalCorePath;
    }
});
(0, node_test_1.default)('saveConfig and loadConfig persist TOML correctly', async () => {
    const { makeItRunService } = await import('../../lib/services/makeitrun-service.js');
    const game = createGame();
    const config = makeItRunService.generateFromGame(game);
    const saved = await makeItRunService.saveConfig(config);
    const loaded = await makeItRunService.loadConfig(saved.slug);
    strict_1.default.equal(saved.slug, 'test-game');
    strict_1.default.ok(loaded);
    strict_1.default.equal(loaded?.slug, 'test-game');
    strict_1.default.equal(loaded?.install?.wineArch, 'win64');
    strict_1.default.deepEqual(loaded?.winetricks, ['vcrun2019']);
    const configPath = path_1.default.join(tempCorePath, 'storage', 'makeitrun', 'test-game.toml');
    strict_1.default.equal(await fs_extra_1.default.pathExists(configPath), true);
});
(0, node_test_1.default)('generateFromCompatReport maps compatibility data into MakeItRun schema', async () => {
    const { makeItRunService } = await import('../../lib/services/makeitrun-service.js');
    const report = createCompatibilityReport();
    const config = makeItRunService.generateFromCompatReport(report);
    strict_1.default.equal(config.slug, 'test-game');
    strict_1.default.equal(config.sources?.importSource, 'compatibility');
    strict_1.default.equal(config.install?.method, 'lutris');
    strict_1.default.equal(config.install?.wineArch, 'win32');
    strict_1.default.equal(config.install?.umuGameId, 'umu-54321');
    strict_1.default.equal(config.protonfixes?.hasComplexLogic, true);
    strict_1.default.equal(config.rendering?.useDxvk, true);
    strict_1.default.equal(config.rendering?.useVkd3dProton, false);
    strict_1.default.deepEqual(config.winetricks?.sort(), ['d3dx9', 'vcrun2019']);
});
(0, node_test_1.default)('mergeConfigs unions lists and merges nested maps', async () => {
    const { makeItRunService } = await import('../../lib/services/makeitrun-service.js');
    const base = makeItRunService.validateConfig({
        schemaVersion: '1.0',
        slug: 'merge-game',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        winetricks: ['vcrun2019'],
        dllOverrides: { ddraw: 'native' },
        environment: { FOO: 'BAR' },
        launch: { environment: { BASE: '1' } },
        rendering: { dxvkOptions: { a: '1' } },
    });
    const merged = makeItRunService.mergeConfigs(base, {
        winetricks: ['d3dx9', 'vcrun2019'],
        dllOverrides: { quartz: 'disabled' },
        environment: { PULSE_LATENCY_MSEC: '90' },
        launch: { environment: { OVERLAY: '1' } },
        rendering: { dxvkOptions: { b: '2' } },
    });
    strict_1.default.deepEqual(merged.winetricks?.sort(), ['d3dx9', 'vcrun2019']);
    strict_1.default.equal(merged.dllOverrides?.ddraw, 'native');
    strict_1.default.equal(merged.dllOverrides?.quartz, 'disabled');
    strict_1.default.equal(merged.environment?.FOO, 'BAR');
    strict_1.default.equal(merged.environment?.PULSE_LATENCY_MSEC, '90');
    strict_1.default.equal(merged.launch?.environment?.BASE, '1');
    strict_1.default.equal(merged.launch?.environment?.OVERLAY, '1');
    strict_1.default.equal(merged.rendering?.dxvkOptions?.a, '1');
    strict_1.default.equal(merged.rendering?.dxvkOptions?.b, '2');
});
(0, node_test_1.default)('applyToGame maps config into windows-wine platform settings', async () => {
    const { makeItRunService } = await import('../../lib/services/makeitrun-service.js');
    const game = createGame();
    const config = makeItRunService.validateConfig({
        schemaVersion: '1.0',
        slug: 'test-game',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        install: {
            method: 'lutris',
            wineVersionId: 'ge-proton-10-1',
            wineArch: 'win32',
            umuGameId: 'umu-54321',
            installPath: '/installed/new-path',
        },
        winetricks: ['corefonts'],
        dllOverrides: { quartz: 'disabled' },
        environment: { FOO: 'BAZ' },
        launch: {
            command: 'Launcher.exe',
            arguments: ['-novsync'],
            environment: { EXTRA: '1' },
        },
        performance: {
            gamescope: { enabled: true, width: 1280, height: 720 },
            mangohud: { enabled: true },
        },
    });
    const updatedGame = makeItRunService.applyToGame(game, config);
    const platform = updatedGame.platforms.find((p) => p.platformId === 'windows-wine');
    strict_1.default.ok(platform);
    strict_1.default.equal(platform?.settings?.wine?.version, 'ge-proton-10-1');
    strict_1.default.equal(platform?.settings?.wine?.arch, 'win32');
    strict_1.default.equal(platform?.settings?.wine?.umuGameId, 'umu-54321');
    strict_1.default.equal(platform?.settings?.wine?.winetricks?.[0], 'corefonts');
    strict_1.default.equal(platform?.settings?.wine?.dlls?.quartz, 'disabled');
    strict_1.default.equal(platform?.settings?.launch?.command, 'Launcher.exe');
    strict_1.default.equal(platform?.settings?.launch?.environment?.FOO, 'BAZ');
    strict_1.default.equal(platform?.settings?.launch?.environment?.EXTRA, '1');
    strict_1.default.equal(platform?.installation?.installMethod, 'lutris');
    strict_1.default.equal(platform?.installation?.installPath, '/installed/new-path');
});
(0, node_test_1.default)('TOML round-trip parse/serialize preserves key fields', async () => {
    const { makeItRunService } = await import('../../lib/services/makeitrun-service.js');
    const config = makeItRunService.validateConfig({
        schemaVersion: '1.0',
        slug: 'roundtrip-game',
        title: 'Roundtrip Game',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        winetricks: ['vcrun2019'],
        dllOverrides: { ddraw: 'native,builtin' },
        rendering: {
            useDxvk: true,
            dxvkOptions: { 'dxgi.nvapiHack': 'False' },
        },
        launch: {
            command: 'Game.exe',
            arguments: ['-safe'],
            environment: { FOO: 'BAR' },
        },
    });
    const toml = makeItRunService.exportToml(config);
    const reparsed = makeItRunService.parseToml(toml);
    strict_1.default.equal(reparsed.slug, 'roundtrip-game');
    strict_1.default.equal(reparsed.title, 'Roundtrip Game');
    strict_1.default.deepEqual(reparsed.winetricks, ['vcrun2019']);
    strict_1.default.equal(reparsed.dllOverrides?.ddraw, 'native,builtin');
    strict_1.default.equal(reparsed.rendering?.useDxvk, true);
    strict_1.default.equal(reparsed.rendering?.dxvkOptions?.['dxgi.nvapiHack'], 'False');
    strict_1.default.equal(reparsed.launch?.command, 'Game.exe');
    strict_1.default.deepEqual(reparsed.launch?.arguments, ['-safe']);
    strict_1.default.equal(reparsed.launch?.environment?.FOO, 'BAR');
});
(0, node_test_1.default)('integration: game JSON apply flow updates GamePlatformConfig.settings', async () => {
    const { makeItRunService } = await import('../../lib/services/makeitrun-service.js');
    const game = createGame({ id: 'game-apply-1', slug: 'apply-route-game', title: 'Apply Route Game' });
    const gameJson = JSON.stringify(game);
    const parsedGame = JSON.parse(gameJson);
    const config = makeItRunService.validateConfig({
        schemaVersion: '1.0',
        slug: 'apply-route-game',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        install: {
            method: 'lutris',
            wineVersionId: 'ge-proton-9-25',
            wineArch: 'win32',
            umuGameId: 'umu-apply-route-game',
        },
        winetricks: ['corefonts', 'd3dx9'],
        dllOverrides: { quartz: 'disabled' },
        environment: { PULSE_LATENCY_MSEC: '90' },
        launch: { command: 'Launcher.exe' },
    });
    const updated = makeItRunService.applyToGame(parsedGame, config);
    const platform = updated.platforms.find((p) => p.platformId === 'windows-wine');
    strict_1.default.ok(platform);
    strict_1.default.equal(platform?.settings?.wine?.version, 'ge-proton-9-25');
    strict_1.default.equal(platform?.settings?.wine?.arch, 'win32');
    strict_1.default.equal(platform?.settings?.wine?.umuGameId, 'umu-apply-route-game');
    strict_1.default.deepEqual(platform?.settings?.wine?.winetricks, ['corefonts', 'd3dx9']);
    strict_1.default.equal(platform?.settings?.wine?.dlls?.quartz, 'disabled');
    strict_1.default.equal(platform?.settings?.launch?.command, 'Launcher.exe');
    strict_1.default.equal(platform?.settings?.launch?.environment?.PULSE_LATENCY_MSEC, '90');
});
(0, node_test_1.default)('regression: pre-existing launch env vars are preserved when MakeItRun is applied', async () => {
    const { makeItRunService } = await import('../../lib/services/makeitrun-service.js');
    const game = createGame({
        id: 'game-env-regression',
        slug: 'env-regression',
    });
    const windowsPlatform = game.platforms.find((platform) => platform.platformId === 'windows-wine');
    if (!windowsPlatform) {
        throw new Error('Missing windows-wine platform in regression fixture');
    }
    windowsPlatform.settings = {
        ...windowsPlatform.settings,
        wine: {
            ...windowsPlatform.settings?.wine,
            version: 'system',
            arch: 'win64',
            winetricks: ['vcrun2019'],
        },
        launch: {
            ...windowsPlatform.settings?.launch,
            command: 'Game.exe',
            arguments: [],
            environment: {
                EXISTING_ONE: 'keep',
                EXISTING_TWO: 'keep-too',
            },
        },
    };
    const config = makeItRunService.validateConfig({
        schemaVersion: '1.0',
        slug: 'env-regression',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        environment: {
            NEW_FROM_MAKEITRUN: 'yes',
        },
        launch: {
            environment: {
                EXISTING_TWO: 'override',
                NEW_FROM_LAUNCH: 'yes',
            },
        },
    });
    const updated = makeItRunService.applyToGame(game, config);
    const mergedEnv = updated.platforms.find((p) => p.platformId === 'windows-wine')?.settings?.launch?.environment;
    strict_1.default.ok(mergedEnv);
    strict_1.default.equal(mergedEnv?.EXISTING_ONE, 'keep');
    strict_1.default.equal(mergedEnv?.EXISTING_TWO, 'override');
    strict_1.default.equal(mergedEnv?.NEW_FROM_MAKEITRUN, 'yes');
    strict_1.default.equal(mergedEnv?.NEW_FROM_LAUNCH, 'yes');
});
(0, node_test_1.default)('integration: apply MakeItRun then launch path includes merged env vars', async () => {
    const { makeItRunService } = await import('../../lib/services/makeitrun-service.js');
    const { buildLaunchEnvironmentVariables } = await import('../../lib/services/launch-env.js');
    const game = createGame({
        id: 'game-launch-env-1',
        slug: 'launch-env-game',
        title: 'Launch Env Game',
    });
    const config = makeItRunService.validateConfig({
        schemaVersion: '1.0',
        slug: 'launch-env-game',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        environment: {
            PULSE_LATENCY_MSEC: '120',
            NEW_FROM_MAKEITRUN: '1',
        },
        launch: {
            environment: {
                NEW_FROM_LAUNCH: '1',
            },
        },
    });
    const updated = makeItRunService.applyToGame(game, config);
    const platform = updated.platforms.find((p) => p.platformId === 'windows-wine');
    const launchEnvironment = platform?.settings?.launch?.environment || {};
    const envList = buildLaunchEnvironmentVariables(updated.id, 'session-123', launchEnvironment);
    strict_1.default.ok(envList.includes('GAME_ID=game-launch-env-1'));
    strict_1.default.ok(envList.includes('SESSION_ID=session-123'));
    strict_1.default.ok(envList.includes('SAVES_PATH=/data/saves/game-launch-env-1'));
    strict_1.default.ok(envList.includes('FOO=BAR'));
    strict_1.default.ok(envList.includes('PULSE_LATENCY_MSEC=120'));
    strict_1.default.ok(envList.includes('NEW_FROM_MAKEITRUN=1'));
    strict_1.default.ok(envList.includes('NEW_FROM_LAUNCH=1'));
});
