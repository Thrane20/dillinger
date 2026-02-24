import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs-extra';
import path from 'path';

const rootDir = process.cwd();
const indexPath = path.join(rootDir, 'packages', 'dillinger-core', 'assets', 'generated', 'protonfixes-index.json');
const submoduleRoot = path.join(rootDir, 'third_party', 'umu-protonfixes');
const fallbackScriptPath = path.join(submoduleRoot, 'gamefixes-steam', '999999999.py');

let previousIndexContent: string | null = null;
let previousIndexExists = false;

async function writeFreshIndex(): Promise<void> {
  const payload = {
    generated_at: new Date().toISOString(),
    commit: 'test-commit',
    fixes: {
      'steam:12345': {
        title: 'Test Game',
        stores: ['steam', 'gog'],
        gog_ids: ['55555'],
        winetricks: ['vcrun2019'],
        dll_overrides: { ddraw: 'native,builtin' },
        env_vars: { FOO: 'BAR' },
        del_env_vars: ['OLD_VAR'],
        command_replacements: [{ from: 'old.exe', to: 'new.exe' }],
        registry: [],
        dxvk_options: { dxgi: 'nvapiHack=false' },
        flags: ['disable_esync'],
        has_complex_logic: false,
        script_path: 'gamefixes-steam/12345.py',
        notes: '',
      },
    },
    cross_references: {
      'gog:77777': 'steam:12345',
    },
    umu_database: {
      'steam:12345': {
        title: 'Test Game',
        store: 'steam',
        codename: '12345',
        umu_id: 'umu-12345',
      },
      'gog:77777': {
        title: 'Test Game',
        store: 'gog',
        codename: '77777',
        umu_id: 'umu-12345',
      },
    },
  };

  await fs.ensureDir(path.dirname(indexPath));
  await fs.writeFile(indexPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
}

test.before(async () => {
  previousIndexExists = await fs.pathExists(indexPath);
  if (previousIndexExists) {
    previousIndexContent = await fs.readFile(indexPath, 'utf-8');
  }
  await writeFreshIndex();
});

test.after(async () => {
  await fs.remove(fallbackScriptPath);
  if (previousIndexExists && previousIndexContent !== null) {
    await fs.writeFile(indexPath, previousIndexContent, 'utf-8');
  } else {
    await fs.remove(indexPath);
  }
});

test('lookupBySteamAppId and lookupByGogId resolve indexed entries', async () => {
  const parser = await import('../../lib/services/protonfixes-parser.js');

  const steamEntry = await parser.lookupBySteamAppId('12345');
  assert.ok(steamEntry);
  assert.equal(steamEntry.title, 'Test Game');
  assert.deepEqual(steamEntry.winetricks, ['vcrun2019']);

  const gogEntry = await parser.lookupByGogId('77777');
  assert.ok(gogEntry);
  assert.equal(gogEntry.script_path, 'gamefixes-steam/12345.py');
});

test('lookupByTitle performs fuzzy title matching from index', async () => {
  const parser = await import('../../lib/services/protonfixes-parser.js');

  const matches = await parser.lookupByTitle('test');
  assert.equal(matches.length, 1);
  assert.equal(matches[0]?.title, 'Test Game');
});

test('fallback regex parser extracts expected fields when index is stale', async () => {
  const staleDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 9);
  await fs.utimes(indexPath, staleDate, staleDate);

  await fs.ensureDir(path.dirname(fallbackScriptPath));
  await fs.writeFile(
    fallbackScriptPath,
    [
      "util.protontricks('vcrun2019 d3dx9')",
      "util.winedll_override('ddraw', util.OverrideOrder.NATIVE_BUILTIN)",
      "util.set_environment('PULSE_LATENCY_MSEC', '90')",
      "util.del_environment('SteamAppId')",
      "util.replace_command('game.exe', 'launcher.exe')",
      "util.regedit_add('HKCU\\\\Software\\\\Wine', 'Foo', 'REG_SZ', 'Bar')",
      "util.set_dxvk_option('dxgi.nvapiHack', 'False')",
      'util.disable_esync()',
    ].join('\n'),
    'utf-8'
  );

  const parser = await import('../../lib/services/protonfixes-parser.js');
  const fallbackEntry = await parser.lookupBySteamAppId('999999999');

  assert.ok(fallbackEntry);
  assert.deepEqual(fallbackEntry.winetricks.sort(), ['d3dx9', 'vcrun2019']);
  assert.equal(fallbackEntry.dll_overrides.ddraw, 'native,builtin');
  assert.equal(fallbackEntry.env_vars.PULSE_LATENCY_MSEC, '90');
  assert.deepEqual(fallbackEntry.del_env_vars, ['SteamAppId']);
  assert.deepEqual(fallbackEntry.command_replacements[0], { from: 'game.exe', to: 'launcher.exe' });
  assert.equal(fallbackEntry.flags[0], 'disable_esync');
});
