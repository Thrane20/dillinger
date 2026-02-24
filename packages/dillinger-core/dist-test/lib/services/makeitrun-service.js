"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeItRunService = exports.MakeItRunService = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const smol_toml_1 = require("smol-toml");
const DILLINGER_CORE_PATH = process.env.DILLINGER_CORE_PATH || '/data';
const MAKEITRUN_DIR = path_1.default.join(DILLINGER_CORE_PATH, 'storage', 'makeitrun');
function normalizeInstallMethodFromGame(method) {
    if (method === 'lutris')
        return 'lutris';
    if (method === 'manual')
        return 'manual';
    if (method === 'automated')
        return 'standard';
    return undefined;
}
function mapToGameInstallMethod(method) {
    if (method === 'lutris')
        return 'lutris';
    if (method === 'manual')
        return 'manual';
    if (method === 'standard')
        return 'automated';
    return undefined;
}
function normalizeRegistryEntries(registry) {
    const allowed = new Set(['REG_SZ', 'REG_DWORD', 'REG_BINARY', 'REG_MULTI_SZ', 'REG_EXPAND_SZ']);
    return (registry || []).map((entry) => ({
        ...entry,
        type: allowed.has(entry.type) ? entry.type : 'REG_SZ',
    }));
}
function sanitizeSlug(value) {
    return (value || 'config')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'config';
}
function configPathForSlug(slug) {
    return path_1.default.join(MAKEITRUN_DIR, `${sanitizeSlug(slug)}.toml`);
}
function nowIso() {
    return new Date().toISOString();
}
function getWindowsPlatform(game) {
    const existing = game.platforms.find((platform) => platform.platformId === 'windows-wine');
    if (existing) {
        return existing;
    }
    const created = { platformId: 'windows-wine' };
    game.platforms.push(created);
    return created;
}
function applyProtonfixesFromCompatibility(report) {
    return {
        scriptPath: report.game.slug || report.game.title,
        winetricks: report.merged.winetricks || [],
        dllOverrides: report.merged.dllOverrides || {},
        envVars: report.merged.envVars || {},
        delEnvVars: report.merged.delEnvVars || [],
        commandReplacements: report.merged.commandReplacements || [],
        registry: report.merged.registry || [],
        flags: report.merged.flags || [],
        hasComplexLogic: report.merged.hasComplexFixes,
        notes: report.merged.complexFixNotes,
    };
}
class MakeItRunService {
    async ensureDirectory() {
        await fs_extra_1.default.ensureDir(MAKEITRUN_DIR);
    }
    async listConfigs() {
        await this.ensureDirectory();
        const files = (await fs_extra_1.default.readdir(MAKEITRUN_DIR)).filter((file) => file.endsWith('.toml'));
        const summaries = [];
        for (const file of files) {
            try {
                const fullPath = path_1.default.join(MAKEITRUN_DIR, file);
                const content = await fs_extra_1.default.readFile(fullPath, 'utf8');
                const parsed = (0, smol_toml_1.parse)(content);
                const stats = await fs_extra_1.default.stat(fullPath);
                summaries.push({
                    slug: parsed.slug || file.replace(/\.toml$/i, ''),
                    title: parsed.title,
                    updatedAt: parsed.updatedAt || stats.mtime.toISOString(),
                    importSource: parsed.sources?.importSource,
                    protondbTier: parsed.sources?.protondbTier,
                });
            }
            catch {
                continue;
            }
        }
        return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    async loadConfig(slug) {
        await this.ensureDirectory();
        const filePath = configPathForSlug(slug);
        if (!(await fs_extra_1.default.pathExists(filePath))) {
            return null;
        }
        const content = await fs_extra_1.default.readFile(filePath, 'utf8');
        const parsed = (0, smol_toml_1.parse)(content);
        parsed.slug = sanitizeSlug(parsed.slug || slug);
        return this.validateConfig(parsed);
    }
    async saveConfig(config) {
        await this.ensureDirectory();
        const normalized = this.validateConfig({
            ...config,
            slug: sanitizeSlug(config.slug),
            updatedAt: nowIso(),
            createdAt: config.createdAt || nowIso(),
            schemaVersion: '1.0',
        });
        const filePath = configPathForSlug(normalized.slug);
        const toml = (0, smol_toml_1.stringify)(normalized);
        await fs_extra_1.default.writeFile(filePath, toml, 'utf8');
        return normalized;
    }
    async deleteConfig(slug) {
        const filePath = configPathForSlug(slug);
        if (!(await fs_extra_1.default.pathExists(filePath))) {
            return false;
        }
        await fs_extra_1.default.remove(filePath);
        return true;
    }
    exportToml(config) {
        return (0, smol_toml_1.stringify)(config);
    }
    parseToml(content) {
        const parsed = (0, smol_toml_1.parse)(content);
        return this.validateConfig(parsed);
    }
    mergeConfigs(base, overlay) {
        const merged = {
            ...base,
            ...overlay,
            sources: {
                ...base.sources,
                ...overlay.sources,
            },
            install: {
                ...base.install,
                ...overlay.install,
            },
            protonfixes: {
                ...base.protonfixes,
                ...overlay.protonfixes,
            },
            dllOverrides: {
                ...(base.dllOverrides || {}),
                ...(overlay.dllOverrides || {}),
            },
            environment: {
                ...(base.environment || {}),
                ...(overlay.environment || {}),
            },
            rendering: {
                ...base.rendering,
                ...overlay.rendering,
                dxvkOptions: {
                    ...(base.rendering?.dxvkOptions || {}),
                    ...(overlay.rendering?.dxvkOptions || {}),
                },
            },
            launch: {
                ...base.launch,
                ...overlay.launch,
                environment: {
                    ...(base.launch?.environment || {}),
                    ...(overlay.launch?.environment || {}),
                },
            },
            performance: {
                ...base.performance,
                ...overlay.performance,
                gamescope: {
                    ...base.performance?.gamescope,
                    ...overlay.performance?.gamescope,
                },
                mangohud: {
                    ...base.performance?.mangohud,
                    ...overlay.performance?.mangohud,
                },
            },
            winetricks: Array.from(new Set([...(base.winetricks || []), ...(overlay.winetricks || [])])),
            flags: Array.from(new Set([...(base.flags || []), ...(overlay.flags || [])])),
            registry: [...(base.registry || []), ...(overlay.registry || [])],
            updatedAt: nowIso(),
        };
        return this.validateConfig(merged);
    }
    validateConfig(config) {
        const slug = sanitizeSlug(config.slug || config.title || 'config');
        return {
            ...config,
            schemaVersion: '1.0',
            slug,
            createdAt: config.createdAt || nowIso(),
            updatedAt: config.updatedAt || nowIso(),
            winetricks: config.winetricks || [],
            dllOverrides: config.dllOverrides || {},
            registry: config.registry || [],
            environment: config.environment || {},
            flags: config.flags || [],
        };
    }
    generateFromGame(game) {
        const platform = game.platforms.find((item) => item.platformId === 'windows-wine');
        const createdAt = nowIso();
        return this.validateConfig({
            schemaVersion: '1.0',
            slug: sanitizeSlug(game.slug || game.title),
            title: game.title,
            createdAt,
            updatedAt: createdAt,
            sources: {
                importSource: 'manual',
                generatedFromGameId: game.id,
            },
            install: {
                method: normalizeInstallMethodFromGame(platform?.installation?.installMethod),
                installerPath: platform?.installation?.installerPath,
                installPath: platform?.installation?.installPath,
                wineVersionId: platform?.installation?.wineVersionId || platform?.settings?.wine?.version,
                wineArch: platform?.installation?.wineArch || platform?.settings?.wine?.arch,
                umuGameId: platform?.settings?.wine?.umuGameId,
            },
            winetricks: platform?.settings?.wine?.winetricks || [],
            dllOverrides: platform?.settings?.wine?.dlls || {},
            registry: platform?.settings?.wine?.registrySettings || [],
            environment: platform?.settings?.launch?.environment || {},
            rendering: {
                useDxvk: platform?.settings?.wine?.useDxvk,
                useVkd3dProton: platform?.settings?.wine?.useVkd3dProton,
                renderer: platform?.settings?.wine?.renderer,
                compatibilityMode: platform?.settings?.wine?.compatibilityMode,
            },
            performance: {
                gamescope: platform?.settings?.gamescope,
                mangohud: platform?.settings?.mangohud,
            },
            launch: {
                command: platform?.settings?.launch?.command,
                arguments: platform?.settings?.launch?.arguments,
                workingDirectory: platform?.settings?.launch?.workingDirectory,
                environment: platform?.settings?.launch?.environment,
            },
        });
    }
    generateFromCompatReport(report) {
        const createdAt = nowIso();
        const hasLutrisSource = report.sources.some((source) => source.name === 'lutris' && source.found);
        return this.validateConfig({
            schemaVersion: '1.0',
            slug: sanitizeSlug(report.game.slug || report.game.title),
            title: report.game.title,
            createdAt,
            updatedAt: createdAt,
            sources: {
                importSource: 'compatibility',
                compatibilityGeneratedAt: report.generatedAt,
                protondbTier: report.protondbTier,
            },
            install: {
                method: hasLutrisSource ? 'lutris' : 'standard',
                umuGameId: report.merged.umuGameId,
                wineArch: report.merged.recommendedArch,
            },
            protonfixes: {
                enabled: true,
                hasComplexLogic: report.merged.hasComplexFixes,
                notes: report.merged.complexFixNotes,
            },
            winetricks: report.merged.winetricks,
            dllOverrides: report.merged.dllOverrides,
            environment: report.merged.envVars,
            registry: report.merged.registry,
            rendering: {
                useDxvk: report.merged.recommendedDxvk,
                useVkd3dProton: report.merged.recommendedVkd3d,
                dxvkOptions: report.merged.dxvkOptions,
            },
            launch: {
                command: report.merged.suggestedExe,
            },
            flags: report.merged.flags,
        });
    }
    generateFromCompatibility(game, report) {
        const base = this.generateFromGame(game);
        const fromReport = this.generateFromCompatReport(report);
        return this.mergeConfigs(base, {
            ...fromReport,
            sources: {
                ...fromReport.sources,
                generatedFromGameId: game.id,
            },
        });
    }
    applyToGame(game, config) {
        const updatedGame = {
            ...game,
            platforms: [...game.platforms],
            updated: nowIso(),
        };
        const platform = getWindowsPlatform(updatedGame);
        platform.settings = platform.settings || {};
        platform.settings.wine = {
            ...platform.settings.wine,
            version: config.install?.wineVersionId || platform.settings.wine?.version,
            umuGameId: config.install?.umuGameId || platform.settings.wine?.umuGameId,
            arch: config.install?.wineArch || platform.settings.wine?.arch,
            useDxvk: config.rendering?.useDxvk ?? platform.settings.wine?.useDxvk,
            useVkd3dProton: config.rendering?.useVkd3dProton ?? platform.settings.wine?.useVkd3dProton,
            renderer: config.rendering?.renderer || platform.settings.wine?.renderer,
            compatibilityMode: config.rendering?.compatibilityMode || platform.settings.wine?.compatibilityMode,
            winetricks: config.winetricks || platform.settings.wine?.winetricks,
            dlls: config.dllOverrides || platform.settings.wine?.dlls,
            registrySettings: normalizeRegistryEntries(config.registry) || platform.settings.wine?.registrySettings,
        };
        platform.settings.gamescope = {
            ...platform.settings.gamescope,
            ...config.performance?.gamescope,
        };
        platform.settings.mangohud = {
            ...platform.settings.mangohud,
            ...config.performance?.mangohud,
        };
        platform.settings.launch = {
            ...platform.settings.launch,
            command: config.launch?.command || platform.settings.launch?.command,
            arguments: config.launch?.arguments || platform.settings.launch?.arguments,
            workingDirectory: config.launch?.workingDirectory || platform.settings.launch?.workingDirectory,
            environment: {
                ...(platform.settings.launch?.environment || {}),
                ...(config.environment || {}),
                ...(config.launch?.environment || {}),
            },
        };
        platform.installation = {
            ...platform.installation,
            installMethod: mapToGameInstallMethod(config.install?.method) || platform.installation?.installMethod,
            installerPath: config.install?.installerPath || platform.installation?.installerPath,
            installPath: config.install?.installPath || platform.installation?.installPath,
            wineVersionId: config.install?.wineVersionId || platform.installation?.wineVersionId,
            wineArch: config.install?.wineArch || platform.installation?.wineArch,
        };
        return updatedGame;
    }
    importFromLutris(game, payload) {
        const base = this.generateFromGame(game);
        return this.mergeConfigs(base, {
            sources: {
                importSource: 'lutris',
                generatedFromGameId: game.id,
                lutrisInstallerId: payload.installerId,
                lutrisInstallerSlug: payload.installerSlug,
            },
            install: {
                method: 'lutris',
                wineArch: payload.arch,
            },
            winetricks: payload.winetricks || [],
            dllOverrides: payload.dllOverrides || {},
            environment: payload.envVars || {},
        });
    }
    importFromProtonfixes(game, entry) {
        const base = this.generateFromGame(game);
        return this.mergeConfigs(base, {
            sources: {
                importSource: 'protonfixes',
                generatedFromGameId: game.id,
                protonfixScriptPath: entry.scriptPath,
            },
            protonfixes: {
                enabled: true,
                hasComplexLogic: entry.hasComplexLogic,
                notes: entry.notes,
                scriptPath: entry.scriptPath,
                commandReplacements: entry.commandReplacements,
                flags: entry.flags,
            },
            winetricks: entry.winetricks,
            dllOverrides: entry.dllOverrides,
            environment: entry.envVars,
            registry: entry.registry,
            flags: entry.flags,
        });
    }
    compatibilityToProtonfixEntry(report) {
        return applyProtonfixesFromCompatibility(report);
    }
}
exports.MakeItRunService = MakeItRunService;
exports.makeItRunService = new MakeItRunService();
