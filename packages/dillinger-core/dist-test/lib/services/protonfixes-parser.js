"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadIndex = loadIndex;
exports.lookupBySteamAppId = lookupBySteamAppId;
exports.lookupByGogId = lookupByGogId;
exports.lookupBySlug = lookupBySlug;
exports.lookupByTitle = lookupByTitle;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const ROOT_DIR = process.cwd();
const INDEX_PATH = path_1.default.join(ROOT_DIR, 'packages', 'dillinger-core', 'assets', 'generated', 'protonfixes-index.json');
const SUBMODULE_ROOT = path_1.default.join(ROOT_DIR, 'third_party', 'umu-protonfixes');
const UMU_DB_PATH = path_1.default.join(SUBMODULE_ROOT, 'umu-database.csv');
const INDEX_STALE_MS = 1000 * 60 * 60 * 24 * 7;
let cachedIndex = null;
let cachedIndexMtimeMs = -1;
let fallbackDbCache = null;
const fallbackFixCache = new Map();
const fallbackCrossRefCache = new Map();
function normalizeText(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function canonicalKey(key, crossReferences) {
    const visited = new Set();
    let current = key;
    while (!visited.has(current) && crossReferences[current]) {
        visited.add(current);
        current = crossReferences[current];
    }
    return current;
}
async function fileIsStale(filePath) {
    if (!(await fs_extra_1.default.pathExists(filePath))) {
        return true;
    }
    const stats = await fs_extra_1.default.stat(filePath);
    return Date.now() - stats.mtimeMs > INDEX_STALE_MS;
}
async function loadIndexFromDisk() {
    if (!(await fs_extra_1.default.pathExists(INDEX_PATH))) {
        return null;
    }
    const stats = await fs_extra_1.default.stat(INDEX_PATH);
    if (cachedIndex && cachedIndexMtimeMs === stats.mtimeMs) {
        return cachedIndex;
    }
    const raw = await fs_extra_1.default.readFile(INDEX_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    cachedIndex = parsed;
    cachedIndexMtimeMs = stats.mtimeMs;
    return parsed;
}
function normalizeOverrideToken(raw) {
    const token = raw.toUpperCase();
    if (token.endsWith('NATIVE_BUILTIN'))
        return 'native,builtin';
    if (token.endsWith('BUILTIN_NATIVE'))
        return 'builtin,native';
    if (token.endsWith('NATIVE'))
        return 'native';
    if (token.endsWith('BUILTIN'))
        return 'builtin';
    if (token.endsWith('DISABLED'))
        return 'disabled';
    return raw.toLowerCase();
}
function emptyEntry(scriptPath) {
    return {
        title: '',
        stores: [],
        gog_ids: [],
        winetricks: [],
        dll_overrides: {},
        env_vars: {},
        del_env_vars: [],
        command_replacements: [],
        registry: [],
        dxvk_options: {},
        flags: [],
        has_complex_logic: false,
        script_path: scriptPath,
        notes: '',
    };
}
function parsePythonFixWithRegex(content, scriptPath) {
    const parsed = emptyEntry(scriptPath);
    const protontricksRegex = /util\.protontricks\(\s*['"]([^'"]+)['"]\s*\)/g;
    const dllRegex = /util\.winedll_override\(\s*['"]([^'"]+)['"]\s*,\s*((?:util\.)?OverrideOrder\.[A-Za-z_]+)\s*\)/g;
    const setEnvRegex = /util\.set_environment\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]\s*\)/g;
    const delEnvRegex = /util\.del_environment\(\s*['"]([^'"]+)['"]\s*\)/g;
    const replaceRegex = /util\.replace_command\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/g;
    const regeditRegex = /util\.regedit_add\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]/g;
    const dxvkRegex = /util\.set_dxvk_option\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]\s*\)/g;
    const flagRegex = /util\.(disable_nvapi|disable_esync|disable_fsync|install_eac_runtime|install_battleye_runtime)\(\s*\)/g;
    let match = null;
    while ((match = protontricksRegex.exec(content))) {
        const rawVerbs = match[1] || '';
        for (const verb of rawVerbs.split(/[\s,]+/).filter(Boolean)) {
            parsed.winetricks.push(verb);
        }
    }
    while ((match = dllRegex.exec(content))) {
        const dllName = match[1] || '';
        const overrideToken = match[2] || '';
        if (dllName) {
            parsed.dll_overrides[dllName] = normalizeOverrideToken(overrideToken);
        }
    }
    while ((match = setEnvRegex.exec(content))) {
        const key = match[1] || '';
        if (key) {
            parsed.env_vars[key] = match[2] || '';
        }
    }
    while ((match = delEnvRegex.exec(content))) {
        const key = match[1] || '';
        if (key) {
            parsed.del_env_vars.push(key);
        }
    }
    while ((match = replaceRegex.exec(content))) {
        const from = match[1] || '';
        const to = match[2] || '';
        if (from && to) {
            parsed.command_replacements.push({ from, to });
        }
    }
    while ((match = regeditRegex.exec(content))) {
        parsed.registry.push({
            path: match[1] || '',
            name: match[2] || '',
            type: match[3] || '',
            value: match[4] || '',
        });
    }
    while ((match = dxvkRegex.exec(content))) {
        const key = match[1] || '';
        if (key) {
            parsed.dxvk_options[key] = match[2] || '';
        }
    }
    while ((match = flagRegex.exec(content))) {
        const flag = match[1] || '';
        if (flag) {
            parsed.flags.push(flag);
        }
    }
    parsed.has_complex_logic = /^\s*(if|for|while|with|try|match)\b/m.test(content);
    parsed.winetricks = Array.from(new Set(parsed.winetricks));
    parsed.del_env_vars = Array.from(new Set(parsed.del_env_vars));
    parsed.flags = Array.from(new Set(parsed.flags));
    return parsed;
}
function keyToScriptPath(key) {
    const [store, codename] = key.split(':');
    if (!store || !codename) {
        return null;
    }
    return path_1.default.join(SUBMODULE_ROOT, `gamefixes-${store}`, `${codename}.py`);
}
async function resolveCrossReferenceForKey(key) {
    if (fallbackCrossRefCache.has(key)) {
        return fallbackCrossRefCache.get(key);
    }
    const scriptPath = keyToScriptPath(key);
    if (!scriptPath || !(await fs_extra_1.default.pathExists(scriptPath))) {
        fallbackCrossRefCache.set(key, key);
        return key;
    }
    const stats = await fs_extra_1.default.lstat(scriptPath);
    if (!stats.isSymbolicLink()) {
        fallbackCrossRefCache.set(key, key);
        return key;
    }
    try {
        const realPath = await fs_extra_1.default.realpath(scriptPath);
        const relative = path_1.default.relative(SUBMODULE_ROOT, realPath).replace(/\\/g, '/');
        const match = relative.match(/^gamefixes-([^/]+)\/([^/]+)\.py$/);
        if (match?.[1] && match[2]) {
            const target = `${match[1]}:${match[2]}`;
            fallbackCrossRefCache.set(key, target);
            return target;
        }
    }
    catch {
        // ignore and fall through
    }
    fallbackCrossRefCache.set(key, key);
    return key;
}
async function parseFixByKeyFallback(key) {
    const canonical = await resolveCrossReferenceForKey(key);
    if (fallbackFixCache.has(canonical)) {
        return fallbackFixCache.get(canonical);
    }
    const scriptPath = keyToScriptPath(canonical);
    if (!scriptPath || !(await fs_extra_1.default.pathExists(scriptPath))) {
        return null;
    }
    const content = await fs_extra_1.default.readFile(scriptPath, 'utf-8');
    const relativeScriptPath = path_1.default.relative(SUBMODULE_ROOT, scriptPath).replace(/\\/g, '/');
    const parsed = parsePythonFixWithRegex(content, relativeScriptPath);
    const [store] = canonical.split(':');
    if (store) {
        parsed.stores = [store];
    }
    fallbackFixCache.set(canonical, parsed);
    return parsed;
}
async function readUmuDatabaseFallback() {
    if (fallbackDbCache) {
        return fallbackDbCache;
    }
    const results = {};
    if (!(await fs_extra_1.default.pathExists(UMU_DB_PATH))) {
        fallbackDbCache = results;
        return results;
    }
    const csvRaw = await fs_extra_1.default.readFile(UMU_DB_PATH, 'utf-8');
    const lines = csvRaw.split(/\r?\n/).filter(Boolean);
    const header = lines.shift();
    if (!header) {
        fallbackDbCache = results;
        return results;
    }
    const columns = header.split(',').map((value) => value.trim());
    const titleIndex = columns.indexOf('TITLE');
    const storeIndex = columns.indexOf('STORE');
    const codenameIndex = columns.indexOf('CODENAME');
    const umuIndex = columns.indexOf('UMU_ID');
    for (const line of lines) {
        const row = line.split(',');
        const title = (row[titleIndex] || '').trim();
        const store = (row[storeIndex] || '').trim();
        const codename = (row[codenameIndex] || '').trim();
        const umu_id = (row[umuIndex] || '').trim();
        if (!store || !codename)
            continue;
        results[`${store}:${codename}`] = { title, store, codename, umu_id };
    }
    fallbackDbCache = results;
    return results;
}
async function shouldUseFallback() {
    return fileIsStale(INDEX_PATH);
}
async function loadIndex() {
    return loadIndexFromDisk();
}
async function lookupBySteamAppId(appId) {
    const key = `steam:${appId}`;
    if (!(await shouldUseFallback())) {
        const index = await loadIndexFromDisk();
        if (!index)
            return null;
        const resolved = canonicalKey(key, index.cross_references);
        return index.fixes[resolved] || null;
    }
    return parseFixByKeyFallback(key);
}
async function lookupByGogId(gogId) {
    const key = `gog:${gogId}`;
    if (!(await shouldUseFallback())) {
        const index = await loadIndexFromDisk();
        if (!index)
            return null;
        const resolved = canonicalKey(key, index.cross_references);
        const direct = index.fixes[resolved];
        if (direct)
            return direct;
        for (const fix of Object.values(index.fixes)) {
            if (fix.gog_ids.includes(gogId)) {
                return fix;
            }
        }
        return null;
    }
    const direct = await parseFixByKeyFallback(key);
    if (direct)
        return direct;
    const db = await readUmuDatabaseFallback();
    const hit = db[key];
    if (hit?.umu_id) {
        const matches = Object.entries(db)
            .filter(([, row]) => row.umu_id && row.umu_id === hit.umu_id)
            .map(([rowKey]) => rowKey);
        const steamKey = matches.find((candidate) => candidate.startsWith('steam:')) || matches[0];
        if (steamKey) {
            return parseFixByKeyFallback(steamKey);
        }
    }
    return null;
}
async function lookupBySlug(slug) {
    const key = `umu:${slug}`;
    if (!(await shouldUseFallback())) {
        const index = await loadIndexFromDisk();
        if (!index)
            return null;
        const resolved = canonicalKey(key, index.cross_references);
        return index.fixes[resolved] || null;
    }
    return parseFixByKeyFallback(key);
}
async function lookupByTitle(title) {
    const titleNorm = normalizeText(title);
    if (!titleNorm)
        return [];
    const entries = new Map();
    if (!(await shouldUseFallback())) {
        const index = await loadIndexFromDisk();
        if (!index)
            return [];
        for (const [dbKey, dbRow] of Object.entries(index.umu_database)) {
            const rowTitleNorm = normalizeText(dbRow.title || '');
            if (!rowTitleNorm || !rowTitleNorm.includes(titleNorm))
                continue;
            const resolved = canonicalKey(dbKey, index.cross_references);
            const fix = index.fixes[resolved];
            if (fix) {
                entries.set(resolved, fix);
            }
        }
        return Array.from(entries.values());
    }
    const db = await readUmuDatabaseFallback();
    for (const [dbKey, dbRow] of Object.entries(db)) {
        const rowTitleNorm = normalizeText(dbRow.title || '');
        if (!rowTitleNorm || !rowTitleNorm.includes(titleNorm))
            continue;
        const fix = await parseFixByKeyFallback(dbKey);
        if (fix) {
            const canonical = await resolveCrossReferenceForKey(dbKey);
            entries.set(canonical, fix);
        }
    }
    return Array.from(entries.values());
}
