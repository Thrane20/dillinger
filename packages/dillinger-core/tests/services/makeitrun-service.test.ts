import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import path from 'path';
import type { Game } from '@dillinger/shared';
import type { CompatibilityReport } from '../../lib/services/compatibility-service.js';

const rootDir = process.cwd();
const tempCorePath = path.join(rootDir, '.tmp', 'makeitrun-service-test-data');

let originalCorePath: string | undefined;

function createGame(overrides?: Partial<Game>): Game {
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

function createCompatibilityReport(): CompatibilityReport {
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

test.before(async () => {
  originalCorePath = process.env.DILLINGER_CORE_PATH;
  process.env.DILLINGER_CORE_PATH = tempCorePath;
  await fs.remove(tempCorePath);
});

test.after(async () => {
  await fs.remove(tempCorePath);
  if (typeof originalCorePath === 'undefined') {
    delete process.env.DILLINGER_CORE_PATH;
  } else {
    process.env.DILLINGER_CORE_PATH = originalCorePath;
  }
});

test('saveConfig and loadConfig persist TOML correctly', async () => {
  const { makeItRunService } = await import('../../lib/services/makeitrun-service.js');

  const game = createGame();
  const config = makeItRunService.generateFromGame(game);
  const saved = await makeItRunService.saveConfig(config);
  const loaded = await makeItRunService.loadConfig(saved.slug);

  assert.equal(saved.slug, 'test-game');
  assert.ok(loaded);
  assert.equal(loaded?.slug, 'test-game');
  assert.equal(loaded?.install?.wineArch, 'win64');
  assert.deepEqual(loaded?.winetricks, ['vcrun2019']);

  const configPath = path.join(tempCorePath, 'storage', 'makeitrun', 'test-game.toml');
  assert.equal(await fs.pathExists(configPath), true);
});

test('generateFromCompatReport maps compatibility data into MakeItRun schema', async () => {
  const { makeItRunService } = await import('../../lib/services/makeitrun-service.js');

  const report = createCompatibilityReport();
  const config = makeItRunService.generateFromCompatReport(report);

  assert.equal(config.slug, 'test-game');
  assert.equal(config.sources?.importSource, 'compatibility');
  assert.equal(config.install?.method, 'lutris');
  assert.equal(config.install?.wineArch, 'win32');
  assert.equal(config.install?.umuGameId, 'umu-54321');
  assert.equal(config.protonfixes?.hasComplexLogic, true);
  assert.equal(config.rendering?.useDxvk, true);
  assert.equal(config.rendering?.useVkd3dProton, false);
  assert.deepEqual(config.winetricks?.sort(), ['d3dx9', 'vcrun2019']);
});

test('mergeConfigs unions lists and merges nested maps', async () => {
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

  assert.deepEqual(merged.winetricks?.sort(), ['d3dx9', 'vcrun2019']);
  assert.equal(merged.dllOverrides?.ddraw, 'native');
  assert.equal(merged.dllOverrides?.quartz, 'disabled');
  assert.equal(merged.environment?.FOO, 'BAR');
  assert.equal(merged.environment?.PULSE_LATENCY_MSEC, '90');
  assert.equal(merged.launch?.environment?.BASE, '1');
  assert.equal(merged.launch?.environment?.OVERLAY, '1');
  assert.equal(merged.rendering?.dxvkOptions?.a, '1');
  assert.equal(merged.rendering?.dxvkOptions?.b, '2');
});

test('applyToGame maps config into windows-wine platform settings', async () => {
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

  assert.ok(platform);
  assert.equal(platform?.settings?.wine?.version, 'ge-proton-10-1');
  assert.equal(platform?.settings?.wine?.arch, 'win32');
  assert.equal(platform?.settings?.wine?.umuGameId, 'umu-54321');
  assert.equal(platform?.settings?.wine?.winetricks?.[0], 'corefonts');
  assert.equal(platform?.settings?.wine?.dlls?.quartz, 'disabled');
  assert.equal(platform?.settings?.launch?.command, 'Launcher.exe');
  assert.equal(platform?.settings?.launch?.environment?.FOO, 'BAZ');
  assert.equal(platform?.settings?.launch?.environment?.EXTRA, '1');
  assert.equal(platform?.installation?.installMethod, 'lutris');
  assert.equal(platform?.installation?.installPath, '/installed/new-path');
});

test('TOML round-trip parse/serialize preserves key fields', async () => {
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

  assert.equal(reparsed.slug, 'roundtrip-game');
  assert.equal(reparsed.title, 'Roundtrip Game');
  assert.deepEqual(reparsed.winetricks, ['vcrun2019']);
  assert.equal(reparsed.dllOverrides?.ddraw, 'native,builtin');
  assert.equal(reparsed.rendering?.useDxvk, true);
  assert.equal(reparsed.rendering?.dxvkOptions?.['dxgi.nvapiHack'], 'False');
  assert.equal(reparsed.launch?.command, 'Game.exe');
  assert.deepEqual(reparsed.launch?.arguments, ['-safe']);
  assert.equal(reparsed.launch?.environment?.FOO, 'BAR');
});

test('integration: game JSON apply flow updates GamePlatformConfig.settings', async () => {
  const { makeItRunService } = await import('../../lib/services/makeitrun-service.js');

  const game = createGame({ id: 'game-apply-1', slug: 'apply-route-game', title: 'Apply Route Game' });
  const gameJson = JSON.stringify(game);
  const parsedGame = JSON.parse(gameJson) as Game;

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

  assert.ok(platform);
  assert.equal(platform?.settings?.wine?.version, 'ge-proton-9-25');
  assert.equal(platform?.settings?.wine?.arch, 'win32');
  assert.equal(platform?.settings?.wine?.umuGameId, 'umu-apply-route-game');
  assert.deepEqual(platform?.settings?.wine?.winetricks, ['corefonts', 'd3dx9']);
  assert.equal(platform?.settings?.wine?.dlls?.quartz, 'disabled');
  assert.equal(platform?.settings?.launch?.command, 'Launcher.exe');
  assert.equal(platform?.settings?.launch?.environment?.PULSE_LATENCY_MSEC, '90');
});

test('regression: pre-existing launch env vars are preserved when MakeItRun is applied', async () => {
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

  assert.ok(mergedEnv);
  assert.equal(mergedEnv?.EXISTING_ONE, 'keep');
  assert.equal(mergedEnv?.EXISTING_TWO, 'override');
  assert.equal(mergedEnv?.NEW_FROM_MAKEITRUN, 'yes');
  assert.equal(mergedEnv?.NEW_FROM_LAUNCH, 'yes');
});

test('integration: apply MakeItRun then launch path includes merged env vars', async () => {
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

  assert.ok(envList.includes('GAME_ID=game-launch-env-1'));
  assert.ok(envList.includes('SESSION_ID=session-123'));
  assert.ok(envList.includes('SAVES_PATH=/data/saves/game-launch-env-1'));
  assert.ok(envList.includes('FOO=BAR'));
  assert.ok(envList.includes('PULSE_LATENCY_MSEC=120'));
  assert.ok(envList.includes('NEW_FROM_MAKEITRUN=1'));
  assert.ok(envList.includes('NEW_FROM_LAUNCH=1'));
});
