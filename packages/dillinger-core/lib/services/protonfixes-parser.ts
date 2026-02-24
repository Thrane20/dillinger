import fs from 'fs-extra';
import path from 'path';

export interface ProtonfixRegistryEntry {
  path: string;
  name: string;
  type: string;
  value: string;
}

export interface ProtonfixCommandReplacement {
  from: string;
  to: string;
}

export interface ProtonfixEntry {
  title: string;
  stores: string[];
  gog_ids: string[];
  winetricks: string[];
  dll_overrides: Record<string, string>;
  env_vars: Record<string, string>;
  del_env_vars: string[];
  command_replacements: ProtonfixCommandReplacement[];
  registry: ProtonfixRegistryEntry[];
  dxvk_options: Record<string, string>;
  flags: string[];
  has_complex_logic: boolean;
  script_path: string;
  notes: string;
}

interface ProtonfixesIndex {
  generated_at: string;
  commit: string;
  fixes: Record<string, ProtonfixEntry>;
  cross_references: Record<string, string>;
  umu_database: Record<
    string,
    {
      title: string;
      store: string;
      codename: string;
      umu_id: string;
    }
  >;
}

const ROOT_DIR = process.cwd();
const INDEX_PATH = path.join(ROOT_DIR, 'packages', 'dillinger-core', 'assets', 'generated', 'protonfixes-index.json');
const SUBMODULE_ROOT = path.join(ROOT_DIR, 'third_party', 'umu-protonfixes');
const UMU_DB_PATH = path.join(SUBMODULE_ROOT, 'umu-database.csv');
const INDEX_STALE_MS = 1000 * 60 * 60 * 24 * 7;

let cachedIndex: ProtonfixesIndex | null = null;
let cachedIndexMtimeMs = -1;
let fallbackDbCache: Record<string, { title: string; store: string; codename: string; umu_id: string }> | null = null;
const fallbackFixCache = new Map<string, ProtonfixEntry>();
const fallbackCrossRefCache = new Map<string, string>();

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function canonicalKey(key: string, crossReferences: Record<string, string>): string {
  const visited = new Set<string>();
  let current = key;
  while (!visited.has(current) && crossReferences[current]) {
    visited.add(current);
    current = crossReferences[current] as string;
  }
  return current;
}

async function fileIsStale(filePath: string): Promise<boolean> {
  if (!(await fs.pathExists(filePath))) {
    return true;
  }

  const stats = await fs.stat(filePath);
  return Date.now() - stats.mtimeMs > INDEX_STALE_MS;
}

async function loadIndexFromDisk(): Promise<ProtonfixesIndex | null> {
  if (!(await fs.pathExists(INDEX_PATH))) {
    return null;
  }

  const stats = await fs.stat(INDEX_PATH);
  if (cachedIndex && cachedIndexMtimeMs === stats.mtimeMs) {
    return cachedIndex;
  }

  const raw = await fs.readFile(INDEX_PATH, 'utf-8');
  const parsed = JSON.parse(raw) as ProtonfixesIndex;
  cachedIndex = parsed;
  cachedIndexMtimeMs = stats.mtimeMs;
  return parsed;
}

function normalizeOverrideToken(raw: string): string {
  const token = raw.toUpperCase();
  if (token.endsWith('NATIVE_BUILTIN')) return 'native,builtin';
  if (token.endsWith('BUILTIN_NATIVE')) return 'builtin,native';
  if (token.endsWith('NATIVE')) return 'native';
  if (token.endsWith('BUILTIN')) return 'builtin';
  if (token.endsWith('DISABLED')) return 'disabled';
  return raw.toLowerCase();
}

function emptyEntry(scriptPath: string): ProtonfixEntry {
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

function parsePythonFixWithRegex(content: string, scriptPath: string): ProtonfixEntry {
  const parsed = emptyEntry(scriptPath);

  const protontricksRegex = /util\.protontricks\(\s*['"]([^'"]+)['"]\s*\)/g;
  const dllRegex = /util\.winedll_override\(\s*['"]([^'"]+)['"]\s*,\s*((?:util\.)?OverrideOrder\.[A-Za-z_]+)\s*\)/g;
  const setEnvRegex = /util\.set_environment\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]\s*\)/g;
  const delEnvRegex = /util\.del_environment\(\s*['"]([^'"]+)['"]\s*\)/g;
  const replaceRegex = /util\.replace_command\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/g;
  const regeditRegex = /util\.regedit_add\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]/g;
  const dxvkRegex = /util\.set_dxvk_option\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]\s*\)/g;
  const flagRegex = /util\.(disable_nvapi|disable_esync|disable_fsync|install_eac_runtime|install_battleye_runtime)\(\s*\)/g;

  let match: RegExpExecArray | null = null;

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

function keyToScriptPath(key: string): string | null {
  const [store, codename] = key.split(':');
  if (!store || !codename) {
    return null;
  }
  return path.join(SUBMODULE_ROOT, `gamefixes-${store}`, `${codename}.py`);
}

async function resolveCrossReferenceForKey(key: string): Promise<string> {
  if (fallbackCrossRefCache.has(key)) {
    return fallbackCrossRefCache.get(key) as string;
  }

  const scriptPath = keyToScriptPath(key);
  if (!scriptPath || !(await fs.pathExists(scriptPath))) {
    fallbackCrossRefCache.set(key, key);
    return key;
  }

  const stats = await fs.lstat(scriptPath);
  if (!stats.isSymbolicLink()) {
    fallbackCrossRefCache.set(key, key);
    return key;
  }

  try {
    const realPath = await fs.realpath(scriptPath);
    const relative = path.relative(SUBMODULE_ROOT, realPath).replace(/\\/g, '/');
    const match = relative.match(/^gamefixes-([^/]+)\/([^/]+)\.py$/);
    if (match?.[1] && match[2]) {
      const target = `${match[1]}:${match[2]}`;
      fallbackCrossRefCache.set(key, target);
      return target;
    }
  } catch {
    // ignore and fall through
  }

  fallbackCrossRefCache.set(key, key);
  return key;
}

async function parseFixByKeyFallback(key: string): Promise<ProtonfixEntry | null> {
  const canonical = await resolveCrossReferenceForKey(key);
  if (fallbackFixCache.has(canonical)) {
    return fallbackFixCache.get(canonical) as ProtonfixEntry;
  }

  const scriptPath = keyToScriptPath(canonical);
  if (!scriptPath || !(await fs.pathExists(scriptPath))) {
    return null;
  }

  const content = await fs.readFile(scriptPath, 'utf-8');
  const relativeScriptPath = path.relative(SUBMODULE_ROOT, scriptPath).replace(/\\/g, '/');
  const parsed = parsePythonFixWithRegex(content, relativeScriptPath);

  const [store] = canonical.split(':');
  if (store) {
    parsed.stores = [store];
  }

  fallbackFixCache.set(canonical, parsed);
  return parsed;
}

async function readUmuDatabaseFallback(): Promise<Record<string, { title: string; store: string; codename: string; umu_id: string }>> {
  if (fallbackDbCache) {
    return fallbackDbCache;
  }

  const results: Record<string, { title: string; store: string; codename: string; umu_id: string }> = {};
  if (!(await fs.pathExists(UMU_DB_PATH))) {
    fallbackDbCache = results;
    return results;
  }

  const csvRaw = await fs.readFile(UMU_DB_PATH, 'utf-8');
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
    if (!store || !codename) continue;
    results[`${store}:${codename}`] = { title, store, codename, umu_id };
  }

  fallbackDbCache = results;
  return results;
}

async function shouldUseFallback(): Promise<boolean> {
  return fileIsStale(INDEX_PATH);
}

export async function loadIndex(): Promise<ProtonfixesIndex | null> {
  return loadIndexFromDisk();
}

export async function lookupBySteamAppId(appId: string): Promise<ProtonfixEntry | null> {
  const key = `steam:${appId}`;
  if (!(await shouldUseFallback())) {
    const index = await loadIndexFromDisk();
    if (!index) return null;
    const resolved = canonicalKey(key, index.cross_references);
    return index.fixes[resolved] || null;
  }
  return parseFixByKeyFallback(key);
}

export async function lookupByGogId(gogId: string): Promise<ProtonfixEntry | null> {
  const key = `gog:${gogId}`;

  if (!(await shouldUseFallback())) {
    const index = await loadIndexFromDisk();
    if (!index) return null;

    const resolved = canonicalKey(key, index.cross_references);
    const direct = index.fixes[resolved];
    if (direct) return direct;

    for (const fix of Object.values(index.fixes)) {
      if (fix.gog_ids.includes(gogId)) {
        return fix;
      }
    }
    return null;
  }

  const direct = await parseFixByKeyFallback(key);
  if (direct) return direct;

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

export async function lookupBySlug(slug: string): Promise<ProtonfixEntry | null> {
  const key = `umu:${slug}`;
  if (!(await shouldUseFallback())) {
    const index = await loadIndexFromDisk();
    if (!index) return null;
    const resolved = canonicalKey(key, index.cross_references);
    return index.fixes[resolved] || null;
  }

  return parseFixByKeyFallback(key);
}

export async function lookupByTitle(title: string): Promise<ProtonfixEntry[]> {
  const titleNorm = normalizeText(title);
  if (!titleNorm) return [];

  const entries = new Map<string, ProtonfixEntry>();

  if (!(await shouldUseFallback())) {
    const index = await loadIndexFromDisk();
    if (!index) return [];

    for (const [dbKey, dbRow] of Object.entries(index.umu_database)) {
      const rowTitleNorm = normalizeText(dbRow.title || '');
      if (!rowTitleNorm || !rowTitleNorm.includes(titleNorm)) continue;

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
    if (!rowTitleNorm || !rowTitleNorm.includes(titleNorm)) continue;

    const fix = await parseFixByKeyFallback(dbKey);
    if (fix) {
      const canonical = await resolveCrossReferenceForKey(dbKey);
      entries.set(canonical, fix);
    }
  }

  return Array.from(entries.values());
}
