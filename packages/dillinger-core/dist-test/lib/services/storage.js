"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JSONStorageService = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const path_1 = __importDefault(require("path"));
const shared_1 = require("@dillinger/shared");
// DILLINGER_CORE_PATH is the base directory for all game data and metadata
// This SHOULD point to the dillinger_core Docker volume mount point
// In development: Bind mounted to ./packages/dillinger-core/data via dillinger_core volume
// In production: The dillinger_core Docker volume (typically /data inside container)
const DILLINGER_CORE_PATH = process.env.DILLINGER_CORE_PATH || '/data';
const DATA_PATH = path_1.default.join(DILLINGER_CORE_PATH, 'storage');
class JSONStorageService {
    static instance;
    loggedErrors = new Set(); // Track logged errors to avoid spam
    getSessionsRoot() {
        return path_1.default.join(DATA_PATH, 'sessions');
    }
    async writeJsonAtomic(filePath, data) {
        const dir = path_1.default.dirname(filePath);
        await fs_extra_1.default.ensureDir(dir);
        const tempPath = `${filePath}.tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        await fs_extra_1.default.writeJson(tempPath, data, { spaces: 2 });
        await fs_extra_1.default.move(tempPath, filePath, { overwrite: true });
    }
    async getEntityFilePath(type, id, data) {
        if (type !== 'sessions') {
            return path_1.default.join(DATA_PATH, type, `${id}.json`);
        }
        const sessionsRoot = this.getSessionsRoot();
        const gameId = typeof data?.gameId === 'string' ? data.gameId : null;
        if (gameId) {
            return path_1.default.join(sessionsRoot, gameId, `${id}.json`);
        }
        return path_1.default.join(sessionsRoot, `${id}.json`);
    }
    async findEntityFilePath(type, id) {
        if (type !== 'sessions') {
            return path_1.default.join(DATA_PATH, type, `${id}.json`);
        }
        const sessionsRoot = this.getSessionsRoot();
        const legacyPath = path_1.default.join(sessionsRoot, `${id}.json`);
        if (await fs_extra_1.default.pathExists(legacyPath)) {
            return legacyPath;
        }
        const entries = await fs_extra_1.default.readdir(sessionsRoot, { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
            if (!entry.isDirectory())
                continue;
            const candidate = path_1.default.join(sessionsRoot, entry.name, `${id}.json`);
            if (await fs_extra_1.default.pathExists(candidate)) {
                return candidate;
            }
        }
        return null;
    }
    async listEntityFiles(type, dirPath) {
        const entries = await fs_extra_1.default.readdir(dirPath, { withFileTypes: true });
        const files = [];
        for (const entry of entries) {
            if (entry.isDirectory()) {
                if (type === 'sessions') {
                    const subdir = path_1.default.join(dirPath, entry.name);
                    const subEntries = await fs_extra_1.default.readdir(subdir);
                    subEntries.forEach((file) => {
                        if (file.endsWith('.json') && file !== 'index.json') {
                            files.push(path_1.default.join(entry.name, file));
                        }
                    });
                }
                continue;
            }
            if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'index.json') {
                files.push(entry.name);
            }
        }
        return files;
    }
    static getInstance() {
        if (!JSONStorageService.instance) {
            JSONStorageService.instance = new JSONStorageService();
        }
        return JSONStorageService.instance;
    }
    /**
     * Get the DILLINGER_CORE_PATH path (base directory for all data)
     */
    getDillingerCorePath() {
        return DILLINGER_CORE_PATH;
    }
    getDillingerRoot() {
        return DILLINGER_CORE_PATH;
    }
    /**
     * Get the storage path (metadata/config storage)
     */
    getStoragePath() {
        return DATA_PATH;
    }
    /**
     * Get the games directory path (actual game installations)
     */
    getGamesPath() {
        return path_1.default.join(DILLINGER_CORE_PATH, 'games');
    }
    /**
     * Ensure all required data directories exist
     */
    async ensureDirectories() {
        // Ensure DILLINGER_CORE_PATH exists
        await fs_extra_1.default.ensureDir(DILLINGER_CORE_PATH);
        // Ensure storage subdirectories exist
        const storageDirs = ['games', 'platforms', 'sessions', 'collections', 'metadata', 'volumes', 'makeitrun', 'cache', path_1.default.join('cache', 'compat')];
        await Promise.all(storageDirs.map((dir) => fs_extra_1.default.ensureDir(path_1.default.join(DATA_PATH, dir))));
    }
    /**
     * Write an entity to a JSON file
     * Automatically adds schema version to the data
     */
    async writeEntity(type, id, data) {
        const filePath = await this.getEntityFilePath(type, id, data);
        // Ensure data has schema version
        const versionedData = (0, shared_1.serializeVersionedData)(data);
        if (type === 'sessions') {
            await this.writeJsonAtomic(filePath, versionedData);
        }
        else {
            await fs_extra_1.default.writeJson(filePath, versionedData, { spaces: 2 });
        }
        await this.updateIndex(type);
    }
    /**
     * Read an entity from a JSON file
     * Automatically validates and normalizes schema version
     */
    async readEntity(type, id) {
        const filePath = await this.findEntityFilePath(type, id);
        if (!filePath) {
            return null;
        }
        try {
            const rawData = await fs_extra_1.default.readJson(filePath);
            // Parse and validate schema version
            const parseResult = (0, shared_1.parseVersionedData)(rawData, {
                strict: false, // Don't throw errors, just warn
                autoMigrate: false, // Don't auto-migrate, just normalize
            });
            // Log if migration would be needed
            if (parseResult.wasMigrated) {
                console.info(`Data at ${filePath} was normalized from version ${parseResult.originalVersion || 'none'} to ${parseResult.normalizedVersion}`);
            }
            return parseResult.data;
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return null;
            }
            throw error;
        }
    }
    /**
     * Delete an entity JSON file
     */
    async deleteEntity(type, id) {
        const filePath = await this.findEntityFilePath(type, id);
        if (!filePath) {
            return false;
        }
        try {
            await fs_extra_1.default.remove(filePath);
            await this.updateIndex(type);
            return true;
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return false;
            }
            throw error;
        }
    }
    /**
     * List all entities of a given type
     * Automatically validates schema versions for all entities
     */
    async listEntities(type) {
        const dirPath = path_1.default.join(DATA_PATH, type);
        try {
            const jsonFiles = await this.listEntityFiles(type, dirPath);
            const entities = [];
            // Read each file individually and skip if it doesn't exist or errors
            for (const file of jsonFiles) {
                try {
                    const filePath = path_1.default.join(dirPath, file);
                    const rawData = await fs_extra_1.default.readJson(filePath);
                    // Parse and validate schema version
                    const parseResult = (0, shared_1.parseVersionedData)(rawData, {
                        strict: false,
                        autoMigrate: false,
                    });
                    entities.push(parseResult.data);
                }
                catch (error) {
                    // Skip files that can't be read (deleted, corrupted, etc.)
                    // Only log each unique error once to avoid spam
                    const errorKey = `${type}/${file}`;
                    if (!this.loggedErrors.has(errorKey)) {
                        console.warn(`Skipping ${type}/${file}:`, error.message);
                        this.loggedErrors.add(errorKey);
                    }
                }
            }
            return entities;
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    }
    /**
     * Get entity counts for statistics
     */
    async getEntityCounts() {
        const [games, platforms, sessions, collections] = await Promise.all([
            this.listEntities('games'),
            this.listPlatforms(), // Use listPlatforms to include bundled defaults
            this.listEntities('sessions'),
            this.listEntities('collections'),
        ]);
        return {
            games: games.length,
            platforms: platforms.length,
            sessions: sessions.length,
            collections: collections.length,
        };
    }
    /**
     * Search entities by text query
     */
    async searchEntities(type, query, searchFields) {
        const entities = await this.listEntities(type);
        const lowerQuery = query.toLowerCase();
        return entities.filter((entity) => searchFields.some((field) => {
            const value = this.getNestedValue(entity, field);
            if (typeof value === 'string') {
                return value.toLowerCase().includes(lowerQuery);
            }
            if (Array.isArray(value)) {
                return value.some((item) => typeof item === 'string' && item.toLowerCase().includes(lowerQuery));
            }
            return false;
        }));
    }
    /**
     * Filter entities by field values
     */
    async filterEntities(type, filters) {
        const entities = await this.listEntities(type);
        return entities.filter((entity) => Object.entries(filters).every(([field, expectedValue]) => {
            const actualValue = this.getNestedValue(entity, field);
            if (Array.isArray(expectedValue)) {
                // Filter by array inclusion
                return expectedValue.includes(actualValue);
            }
            if (Array.isArray(actualValue)) {
                // Check if array contains the expected value
                return actualValue.includes(expectedValue);
            }
            return actualValue === expectedValue;
        }));
    }
    /**
     * Get paginated entities with optional sorting
     */
    async getPaginatedEntities(type, limit = 20, offset = 0, sortField, sortDirection = 'desc') {
        const allEntities = await this.listEntities(type);
        // Sort if requested
        if (sortField) {
            allEntities.sort((a, b) => {
                const aValue = this.getNestedValue(a, sortField);
                const bValue = this.getNestedValue(b, sortField);
                let comparison = 0;
                if (aValue < bValue)
                    comparison = -1;
                if (aValue > bValue)
                    comparison = 1;
                return sortDirection === 'desc' ? -comparison : comparison;
            });
        }
        const entities = allEntities.slice(offset, offset + limit);
        return { entities, total: allEntities.length };
    }
    /**
     * Update index file for performance optimization
     * Automatically adds schema version to index files
     */
    async updateIndex(type) {
        const entities = await this.listEntities(type);
        const indexPath = path_1.default.join(DATA_PATH, type, 'index.json');
        if (type === 'games') {
            const gamesIndex = this.buildGamesIndex(entities);
            const versionedIndex = (0, shared_1.serializeVersionedData)(gamesIndex);
            await fs_extra_1.default.writeJson(indexPath, versionedIndex, { spaces: 2 });
        }
        else if (type === 'sessions') {
            const sessionsIndex = this.buildSessionsIndex(entities);
            const versionedIndex = (0, shared_1.serializeVersionedData)(sessionsIndex);
            await fs_extra_1.default.writeJson(indexPath, versionedIndex, { spaces: 2 });
        }
        else {
            // Basic index for other entity types
            const basicIndex = {
                count: entities.length,
                lastUpdated: new Date().toISOString(),
                ids: entities.map((entity) => entity.id),
            };
            const versionedIndex = (0, shared_1.serializeVersionedData)(basicIndex);
            await fs_extra_1.default.writeJson(indexPath, versionedIndex, { spaces: 2 });
        }
    }
    /**
     * Build optimized games index
     */
    buildGamesIndex(games) {
        const byPlatform = {};
        const byCollection = {};
        const byGenre = {};
        const byTag = {};
        const titleWords = {};
        games.forEach((game) => {
            // Platform index
            if (game.platformId) {
                if (!byPlatform[game.platformId]) {
                    byPlatform[game.platformId] = [];
                }
                byPlatform[game.platformId].push(game.id);
            }
            // Collection index
            if (game.collectionIds && Array.isArray(game.collectionIds)) {
                game.collectionIds.forEach((collectionId) => {
                    if (!byCollection[collectionId]) {
                        byCollection[collectionId] = [];
                    }
                    byCollection[collectionId].push(game.id);
                });
            }
            // Genre index
            game.metadata?.genre?.forEach((genre) => {
                const genreKey = genre.toLowerCase();
                if (!byGenre[genreKey]) {
                    byGenre[genreKey] = [];
                }
                byGenre[genreKey].push(game.id);
            });
            // Tag index
            if (game.tags && Array.isArray(game.tags)) {
                game.tags.forEach((tag) => {
                    const tagKey = tag.toLowerCase();
                    if (!byTag[tagKey]) {
                        byTag[tagKey] = [];
                    }
                    byTag[tagKey].push(game.id);
                });
            }
            // Title search index
            const words = game.title.toLowerCase().split(/\s+/);
            words.forEach((word) => {
                if (word.length > 2) {
                    if (!titleWords[word]) {
                        titleWords[word] = [];
                    }
                    titleWords[word].push(game.id);
                }
            });
        });
        // Sort by play time for popular games
        const gamesWithPlayTime = games
            .filter((game) => game.metadata?.playTime)
            .sort((a, b) => (b.metadata?.playTime || 0) - (a.metadata?.playTime || 0));
        // Recent games (last 50)
        const recentGames = games
            .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
            .slice(0, 50);
        return {
            count: games.length,
            lastUpdated: new Date().toISOString(),
            byPlatform,
            byCollection,
            byGenre,
            byTag,
            search: {
                titles: titleWords,
                fuzzy: titleWords, // Simple implementation, can be enhanced
            },
            recent: recentGames.map((game) => game.id),
            popular: gamesWithPlayTime.slice(0, 20).map((game) => game.id),
        };
    }
    /**
     * Build optimized sessions index
     */
    buildSessionsIndex(sessions) {
        const byGame = {};
        const byDate = {};
        const active = [];
        let totalHours = 0;
        let totalSessions = 0;
        const gamePlayTime = {};
        sessions.forEach((session) => {
            // Game index
            if (!byGame[session.gameId]) {
                byGame[session.gameId] = [];
            }
            byGame[session.gameId].push(session.id);
            // Date index
            const dateKey = session.performance.startTime.split('T')[0]; // YYYY-MM-DD
            if (dateKey && !byDate[dateKey]) {
                byDate[dateKey] = [];
            }
            if (dateKey) {
                byDate[dateKey].push(session.id);
            }
            // Active sessions
            if (session.status === 'running' || session.status === 'starting') {
                active.push(session.id);
            }
            // Performance tracking
            if (session.performance.duration) {
                const hours = session.performance.duration / 3600;
                totalHours += hours;
                totalSessions++;
                if (!gamePlayTime[session.gameId]) {
                    gamePlayTime[session.gameId] = 0;
                }
                gamePlayTime[session.gameId] += hours;
            }
        });
        // Top games by play time
        const topGames = Object.entries(gamePlayTime)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([gameId, totalHours]) => ({ gameId, totalHours }));
        return {
            count: sessions.length,
            lastUpdated: new Date().toISOString(),
            active,
            byGame,
            byDate,
            performance: {
                totalHours,
                averageSession: totalSessions > 0 ? (totalHours * 60) / totalSessions : 0,
                topGames,
            },
        };
    }
    /**
     * Get nested object value by dot notation path
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }
    /**
     * Check if storage is healthy
     */
    async healthCheck() {
        try {
            const rootExists = await fs_extra_1.default.pathExists(DILLINGER_CORE_PATH);
            const storageExists = await fs_extra_1.default.pathExists(DATA_PATH);
            if (!rootExists || !storageExists) {
                return {
                    healthy: false,
                    dataPath: DATA_PATH,
                    writable: false,
                    counts: { games: 0, platforms: 0, sessions: 0, collections: 0 },
                };
            }
            // Test write access (without creating missing directories).
            const testPath = path_1.default.join(DATA_PATH, '.health-check');
            await fs_extra_1.default.writeFile(testPath, 'test');
            await fs_extra_1.default.remove(testPath);
            const counts = await this.getEntityCounts();
            return {
                healthy: true,
                dataPath: DATA_PATH,
                writable: true,
                counts,
            };
        }
        catch (error) {
            return {
                healthy: false,
                dataPath: DATA_PATH,
                writable: false,
                counts: { games: 0, platforms: 0, sessions: 0, collections: 0 },
            };
        }
    }
    // ─────────────────────────────────────────────────────────────────────────────
    // Platform-specific methods: merge bundled defaults with user overrides
    // ─────────────────────────────────────────────────────────────────────────────
    /**
     * Get the path to bundled default platform configs.
     * In standalone mode (production), process.cwd() is /app/packages/dillinger-core
     */
    getBundledPlatformsPath() {
        return path_1.default.resolve(process.cwd(), 'assets', 'defaults', 'platforms');
    }
    /**
     * Read a platform config, checking user overrides first, then falling back to bundled defaults.
     * This allows upgrades to automatically include new/updated platform configs.
     */
    async readPlatform(id) {
        // First check user storage (overrides)
        const override = await this.readEntity('platforms', id);
        if (override) {
            return override;
        }
        // Fall back to bundled defaults
        const bundledPath = path_1.default.join(this.getBundledPlatformsPath(), `${id}.json`);
        try {
            const rawData = await fs_extra_1.default.readJson(bundledPath);
            const parseResult = (0, shared_1.parseVersionedData)(rawData, {
                strict: false,
                autoMigrate: false,
            });
            return parseResult.data;
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return null;
            }
            throw error;
        }
    }
    /**
     * List all platforms: merge bundled defaults with user overrides.
     * User overrides take precedence for platforms with the same ID.
     */
    async listPlatforms() {
        const platformsMap = new Map();
        // First, load all bundled defaults
        const bundledPath = this.getBundledPlatformsPath();
        try {
            if (await fs_extra_1.default.pathExists(bundledPath)) {
                const files = await fs_extra_1.default.readdir(bundledPath);
                const jsonFiles = files.filter((f) => f.endsWith('.json'));
                for (const file of jsonFiles) {
                    try {
                        const filePath = path_1.default.join(bundledPath, file);
                        const rawData = await fs_extra_1.default.readJson(filePath);
                        const parseResult = (0, shared_1.parseVersionedData)(rawData, {
                            strict: false,
                            autoMigrate: false,
                        });
                        const platform = parseResult.data;
                        platformsMap.set(platform.id, parseResult.data);
                    }
                    catch (error) {
                        console.warn(`Skipping bundled platform ${file}:`, error.message);
                    }
                }
            }
        }
        catch (error) {
            console.warn('Could not read bundled platforms:', error.message);
        }
        // Then, load user overrides (these take precedence)
        const userPlatforms = await this.listEntities('platforms');
        for (const platform of userPlatforms) {
            const p = platform;
            platformsMap.set(p.id, platform);
        }
        return Array.from(platformsMap.values());
    }
}
exports.JSONStorageService = JSONStorageService;
