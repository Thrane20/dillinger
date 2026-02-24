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
const indexPath = path_1.default.join(rootDir, 'packages', 'dillinger-core', 'assets', 'generated', 'protonfixes-index.json');
const submoduleRoot = path_1.default.join(rootDir, 'third_party', 'umu-protonfixes');
const fallbackScriptPath = path_1.default.join(submoduleRoot, 'gamefixes-steam', '999999999.py');
let previousIndexContent = null;
let previousIndexExists = false;
async function writeFreshIndex() {
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
    await fs_extra_1.default.ensureDir(path_1.default.dirname(indexPath));
    await fs_extra_1.default.writeFile(indexPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
}
node_test_1.default.before(async () => {
    previousIndexExists = await fs_extra_1.default.pathExists(indexPath);
    if (previousIndexExists) {
        previousIndexContent = await fs_extra_1.default.readFile(indexPath, 'utf-8');
    }
    await writeFreshIndex();
});
node_test_1.default.after(async () => {
    await fs_extra_1.default.remove(fallbackScriptPath);
    if (previousIndexExists && previousIndexContent !== null) {
        await fs_extra_1.default.writeFile(indexPath, previousIndexContent, 'utf-8');
    }
    else {
        await fs_extra_1.default.remove(indexPath);
    }
});
(0, node_test_1.default)('lookupBySteamAppId and lookupByGogId resolve indexed entries', async () => {
    const parser = await import('../../lib/services/protonfixes-parser.js');
    const steamEntry = await parser.lookupBySteamAppId('12345');
    strict_1.default.ok(steamEntry);
    strict_1.default.equal(steamEntry.title, 'Test Game');
    strict_1.default.deepEqual(steamEntry.winetricks, ['vcrun2019']);
    const gogEntry = await parser.lookupByGogId('77777');
    strict_1.default.ok(gogEntry);
    strict_1.default.equal(gogEntry.script_path, 'gamefixes-steam/12345.py');
});
(0, node_test_1.default)('lookupByTitle performs fuzzy title matching from index', async () => {
    const parser = await import('../../lib/services/protonfixes-parser.js');
    const matches = await parser.lookupByTitle('test');
    strict_1.default.equal(matches.length, 1);
    strict_1.default.equal(matches[0]?.title, 'Test Game');
});
(0, node_test_1.default)('fallback regex parser extracts expected fields when index is stale', async () => {
    const staleDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 9);
    await fs_extra_1.default.utimes(indexPath, staleDate, staleDate);
    await fs_extra_1.default.ensureDir(path_1.default.dirname(fallbackScriptPath));
    await fs_extra_1.default.writeFile(fallbackScriptPath, [
        "util.protontricks('vcrun2019 d3dx9')",
        "util.winedll_override('ddraw', util.OverrideOrder.NATIVE_BUILTIN)",
        "util.set_environment('PULSE_LATENCY_MSEC', '90')",
        "util.del_environment('SteamAppId')",
        "util.replace_command('game.exe', 'launcher.exe')",
        "util.regedit_add('HKCU\\\\Software\\\\Wine', 'Foo', 'REG_SZ', 'Bar')",
        "util.set_dxvk_option('dxgi.nvapiHack', 'False')",
        'util.disable_esync()',
    ].join('\n'), 'utf-8');
    const parser = await import('../../lib/services/protonfixes-parser.js');
    const fallbackEntry = await parser.lookupBySteamAppId('999999999');
    strict_1.default.ok(fallbackEntry);
    strict_1.default.deepEqual(fallbackEntry.winetricks.sort(), ['d3dx9', 'vcrun2019']);
    strict_1.default.equal(fallbackEntry.dll_overrides.ddraw, 'native,builtin');
    strict_1.default.equal(fallbackEntry.env_vars.PULSE_LATENCY_MSEC, '90');
    strict_1.default.deepEqual(fallbackEntry.del_env_vars, ['SteamAppId']);
    strict_1.default.deepEqual(fallbackEntry.command_replacements[0], { from: 'game.exe', to: 'launcher.exe' });
    strict_1.default.equal(fallbackEntry.flags[0], 'disable_esync');
});
