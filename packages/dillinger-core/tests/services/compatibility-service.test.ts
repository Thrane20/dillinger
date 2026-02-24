import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';

const rootDir = process.cwd();
const indexPath = path.join(rootDir, 'packages', 'dillinger-core', 'assets', 'generated', 'protonfixes-index.json');

let previousIndexContent: string | null = null;
let previousIndexExists = false;
let originalCorePath: string | undefined;
const tempCorePath = path.join(rootDir, '.tmp', 'core-test-data');

async function writeIndexForCompatibility(): Promise<void> {
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

  await fs.ensureDir(path.dirname(indexPath));
  await fs.writeFile(indexPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
}

test.before(async () => {
  originalCorePath = process.env.DILLINGER_CORE_PATH;
  process.env.DILLINGER_CORE_PATH = tempCorePath;

  previousIndexExists = await fs.pathExists(indexPath);
  if (previousIndexExists) {
    previousIndexContent = await fs.readFile(indexPath, 'utf-8');
  }

  await fs.remove(tempCorePath);
  await writeIndexForCompatibility();
});

test.after(async () => {
  await fs.remove(tempCorePath);

  if (previousIndexExists && previousIndexContent !== null) {
    await fs.writeFile(indexPath, previousIndexContent, 'utf-8');
  } else {
    await fs.remove(indexPath);
  }

  if (typeof originalCorePath === 'undefined') {
    delete process.env.DILLINGER_CORE_PATH;
  } else {
    process.env.DILLINGER_CORE_PATH = originalCorePath;
  }
});

test('lookupCompatibility merges protonfix data and writes cache', async () => {
  const { lookupCompatibility } = await import('../../lib/services/compatibility-service.js');

  const report = await lookupCompatibility({
    title: 'Compat Test Game',
    slug: 'compat-test-game',
  });

  assert.equal(report.game.slug, 'compat-test-game');
  assert.equal(report.confidence, 'low');
  assert.deepEqual(report.merged.winetricks.sort(), ['d3dx9', 'vcrun2019']);
  assert.equal(report.merged.dllOverrides.ddraw, 'native,builtin');
  assert.equal(report.merged.suggestedExe, 'game.exe');
  assert.equal(report.metadata.protonfixesCommit, 'compat-test-commit');

  const cachePath = path.join(tempCorePath, 'storage', 'cache', 'compat', 'compat-test-game.json');
  assert.equal(await fs.pathExists(cachePath), true);
});

test('lookupCompatibility reuses cache unless bustCache is true', async () => {
  const { lookupCompatibility } = await import('../../lib/services/compatibility-service.js');

  const first = await lookupCompatibility({ title: 'Compat Test Game', slug: 'compat-cache-test' });
  const second = await lookupCompatibility({ title: 'Compat Test Game', slug: 'compat-cache-test' });
  assert.equal(second.generatedAt, first.generatedAt);

  await new Promise((resolve) => setTimeout(resolve, 5));

  const busted = await lookupCompatibility({ title: 'Compat Test Game', slug: 'compat-cache-test' }, { bustCache: true });
  assert.notEqual(busted.generatedAt, first.generatedAt);
});

test('lookupCompatibility merges mocked UMU/ProtonDB/PCGW/Lutris responses', async () => {
  const { lookupCompatibility } = await import('../../lib/services/compatibility-service.js');

  const originalFetch = globalThis.fetch;
  const originalAxiosGet = axios.get;

  const mockedFetch: typeof fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes('umu.openwinecomponents.org')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ umu_id: 'umu-54321', steam_appid: '54321' }),
      } as Response;
    }

    if (url.includes('protondb.com/api/v1/reports/summaries/54321.json')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ tier: 'gold', confidence: 'high', total: 42 }),
      } as Response;
    }

    if (url.includes('pcgamingwiki.com/w/api.php')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          cargoquery: [{ title: { title: 'Compat Test Game', API: 'DirectX 12', Steam_AppID: '54321' } }],
        }),
      } as Response;
    }

    throw new Error(`Unexpected fetch URL in test: ${url}`);
  }) as typeof fetch;

  const mockedAxiosGet: typeof axios.get = (async (url: string) => {
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
  }) as typeof axios.get;

  globalThis.fetch = mockedFetch;
  axios.get = mockedAxiosGet;

  try {
    const report = await lookupCompatibility(
      {
        title: 'Compat Test Game',
        slug: 'compat-mocked-apis',
        gogId: '123456',
      },
      { bustCache: true }
    );

    assert.equal(report.game.steamAppId, '54321');
    assert.equal(report.protondbTier, 'gold');
    assert.equal(report.protondbConfidence, 'high');
    assert.equal(report.protondbTotal, 42);
    assert.equal(report.merged.umuGameId, 'umu-54321');
    assert.equal(report.merged.recommendedVkd3d, true);
    assert.equal(report.merged.recommendedDxvk, false);
    assert.equal(report.merged.recommendedArch, 'win32');
    assert.equal(report.merged.suggestedExe, 'lutris-game.exe');
    assert.ok(report.merged.winetricks.includes('corefonts'));
    assert.equal(report.merged.dllOverrides.quartz, 'native,builtin');
    assert.equal(report.confidence, 'high');
  } finally {
    globalThis.fetch = originalFetch;
    axios.get = originalAxiosGet;
  }
});
