// UUID utilities - will be implemented after package installation
export function isValidUUID(id) {
    // Basic UUID v4 format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return typeof id === 'string' && uuidRegex.test(id);
}
export function generateUUID() {
    // Simple UUID v4 generation - will be replaced with proper library
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c == 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
// Date validation
export function isValidISOTimestamp(timestamp) {
    const date = new Date(timestamp);
    return !isNaN(date.getTime()) && date.toISOString() === timestamp;
}
export function createTimestamp() {
    return new Date().toISOString();
}
// File path validation
export function isValidFilePath(path) {
    // Basic file path validation - must be absolute and not empty
    return typeof path === 'string' && path.length > 0 && path.startsWith('/');
}
// Enum validation helpers
export function isValidPlatformType(type) {
    return ['native', 'wine', 'emulator'].includes(type);
}
export function isValidSessionStatus(status) {
    return ['starting', 'running', 'paused', 'stopped', 'error'].includes(status);
}
export function isValidSortField(field) {
    return ['title', 'lastPlayed', 'rating', 'created'].includes(field);
}
export function isValidSortDirection(direction) {
    return ['asc', 'desc'].includes(direction);
}
export function isValidMetadataSource(source) {
    return ['igdb', 'manual', 'file'].includes(source);
}
export function isValidCacheStatus(status) {
    return ['fetching', 'complete', 'error', 'stale'].includes(status);
}
export function isValidStreamingMethod(method) {
    return ['games-on-whales', 'wolf', 'x11'].includes(method);
}
// Entity validation functions
export class ValidationError extends Error {
    field;
    constructor(message, field) {
        super(message);
        this.field = field;
        this.name = 'ValidationError';
    }
}
export function validateGame(data) {
    if (typeof data !== 'object' || !data) {
        throw new ValidationError('Invalid game data: must be an object');
    }
    const game = data;
    // Required fields
    if (typeof game.id !== 'string' || !isValidUUID(game.id)) {
        throw new ValidationError('Invalid game ID: must be a valid UUID', 'id');
    }
    if (typeof game.title !== 'string' || game.title.length === 0 || game.title.length > 255) {
        throw new ValidationError('Invalid game title: must be a non-empty string (max 255 characters)', 'title');
    }
    if (typeof game.filePath !== 'string' || !isValidFilePath(game.filePath)) {
        throw new ValidationError('Invalid file path: must be an absolute path', 'filePath');
    }
    if (typeof game.platformId !== 'string' || !isValidUUID(game.platformId)) {
        throw new ValidationError('Invalid platform ID: must be a valid UUID', 'platformId');
    }
    if (!Array.isArray(game.collectionIds)) {
        throw new ValidationError('Invalid collection IDs: must be an array', 'collectionIds');
    }
    for (const id of game.collectionIds) {
        if (typeof id !== 'string' || !isValidUUID(id)) {
            throw new ValidationError('Invalid collection ID: all collection IDs must be valid UUIDs', 'collectionIds');
        }
    }
    if (!Array.isArray(game.tags)) {
        throw new ValidationError('Invalid tags: must be an array', 'tags');
    }
    if (typeof game.created !== 'string' || !isValidISOTimestamp(game.created)) {
        throw new ValidationError('Invalid created timestamp: must be a valid ISO timestamp', 'created');
    }
    if (typeof game.updated !== 'string' || !isValidISOTimestamp(game.updated)) {
        throw new ValidationError('Invalid updated timestamp: must be a valid ISO timestamp', 'updated');
    }
    // File info validation
    if (typeof game.fileInfo !== 'object' || !game.fileInfo) {
        throw new ValidationError('Invalid file info: must be an object', 'fileInfo');
    }
    const fileInfo = game.fileInfo;
    if (typeof fileInfo.size !== 'number' || fileInfo.size < 0) {
        throw new ValidationError('Invalid file size: must be a non-negative number', 'fileInfo.size');
    }
    if (typeof fileInfo.lastModified !== 'string' ||
        !isValidISOTimestamp(fileInfo.lastModified)) {
        throw new ValidationError('Invalid last modified timestamp: must be a valid ISO timestamp', 'fileInfo.lastModified');
    }
    return game;
}
export function validatePlatform(data) {
    if (typeof data !== 'object' || !data) {
        throw new ValidationError('Invalid platform data: must be an object');
    }
    const platform = data;
    if (typeof platform.id !== 'string' || !isValidUUID(platform.id)) {
        throw new ValidationError('Invalid platform ID: must be a valid UUID', 'id');
    }
    if (typeof platform.name !== 'string' ||
        platform.name.length === 0 ||
        platform.name.length > 100) {
        throw new ValidationError('Invalid platform name: must be a non-empty string (max 100 characters)', 'name');
    }
    if (typeof platform.type !== 'string' || !isValidPlatformType(platform.type)) {
        throw new ValidationError('Invalid platform type: must be native, wine, or emulator', 'type');
    }
    if (typeof platform.isActive !== 'boolean') {
        throw new ValidationError('Invalid isActive: must be a boolean', 'isActive');
    }
    if (typeof platform.created !== 'string' || !isValidISOTimestamp(platform.created)) {
        throw new ValidationError('Invalid created timestamp: must be a valid ISO timestamp', 'created');
    }
    if (typeof platform.updated !== 'string' || !isValidISOTimestamp(platform.updated)) {
        throw new ValidationError('Invalid updated timestamp: must be a valid ISO timestamp', 'updated');
    }
    // Configuration validation
    if (typeof platform.configuration !== 'object' || !platform.configuration) {
        throw new ValidationError('Invalid configuration: must be an object', 'configuration');
    }
    const config = platform.configuration;
    if (!Array.isArray(config.supportedExtensions) ||
        config.supportedExtensions.length === 0) {
        throw new ValidationError('Invalid supported extensions: must be a non-empty array', 'configuration.supportedExtensions');
    }
    return platform;
}
export function validateGameSession(data) {
    if (typeof data !== 'object' || !data) {
        throw new ValidationError('Invalid game session data: must be an object');
    }
    const session = data;
    if (typeof session.id !== 'string' || !isValidUUID(session.id)) {
        throw new ValidationError('Invalid session ID: must be a valid UUID', 'id');
    }
    if (typeof session.gameId !== 'string' || !isValidUUID(session.gameId)) {
        throw new ValidationError('Invalid game ID: must be a valid UUID', 'gameId');
    }
    if (typeof session.platformId !== 'string' || !isValidUUID(session.platformId)) {
        throw new ValidationError('Invalid platform ID: must be a valid UUID', 'platformId');
    }
    if (typeof session.status !== 'string' || !isValidSessionStatus(session.status)) {
        throw new ValidationError('Invalid status: must be starting, running, paused, stopped, or error', 'status');
    }
    if (typeof session.created !== 'string' || !isValidISOTimestamp(session.created)) {
        throw new ValidationError('Invalid created timestamp: must be a valid ISO timestamp', 'created');
    }
    if (typeof session.updated !== 'string' || !isValidISOTimestamp(session.updated)) {
        throw new ValidationError('Invalid updated timestamp: must be a valid ISO timestamp', 'updated');
    }
    return session;
}
export function validateCollection(data) {
    if (typeof data !== 'object' || !data) {
        throw new ValidationError('Invalid collection data: must be an object');
    }
    const collection = data;
    if (typeof collection.id !== 'string' || !isValidUUID(collection.id)) {
        throw new ValidationError('Invalid collection ID: must be a valid UUID', 'id');
    }
    if (typeof collection.name !== 'string' ||
        collection.name.length === 0 ||
        collection.name.length > 100) {
        throw new ValidationError('Invalid collection name: must be a non-empty string (max 100 characters)', 'name');
    }
    if (!Array.isArray(collection.gameIds)) {
        throw new ValidationError('Invalid game IDs: must be an array', 'gameIds');
    }
    for (const id of collection.gameIds) {
        if (typeof id !== 'string' || !isValidUUID(id)) {
            throw new ValidationError('Invalid game ID: all game IDs must be valid UUIDs', 'gameIds');
        }
    }
    if (typeof collection.isSystem !== 'boolean') {
        throw new ValidationError('Invalid isSystem: must be a boolean', 'isSystem');
    }
    if (typeof collection.isPublic !== 'boolean') {
        throw new ValidationError('Invalid isPublic: must be a boolean', 'isPublic');
    }
    if (typeof collection.created !== 'string' || !isValidISOTimestamp(collection.created)) {
        throw new ValidationError('Invalid created timestamp: must be a valid ISO timestamp', 'created');
    }
    if (typeof collection.updated !== 'string' || !isValidISOTimestamp(collection.updated)) {
        throw new ValidationError('Invalid updated timestamp: must be a valid ISO timestamp', 'updated');
    }
    return collection;
}
// Input sanitization
export function sanitizeString(input, maxLength = 255) {
    return input.trim().slice(0, maxLength);
}
export function sanitizeArray(input) {
    return input
        .filter((item) => typeof item === 'string')
        .map((item) => sanitizeString(item))
        .filter((item) => item.length > 0);
}
// Search and filter validation
export function validateSearchQuery(query) {
    if (typeof query !== 'string') {
        throw new ValidationError('Search query must be a string');
    }
    const sanitized = sanitizeString(query, 100);
    if (sanitized.length < 2) {
        throw new ValidationError('Search query must be at least 2 characters');
    }
    return sanitized;
}
export function validatePaginationParams(limit, offset) {
    const validatedLimit = Math.min(Math.max(limit || 20, 1), 100);
    const validatedOffset = Math.max(offset || 0, 0);
    return { limit: validatedLimit, offset: validatedOffset };
}
// File extension validation
export function validateFileExtension(filePath, allowedExtensions) {
    const extension = filePath.toLowerCase().split('.').pop();
    return extension ? allowedExtensions.includes(extension) : false;
}
// Partial validation for updates
export function validatePartialGame(data) {
    if (typeof data !== 'object' || !data) {
        throw new ValidationError('Invalid game data: must be an object');
    }
    const updates = data;
    const validated = {};
    if (updates.title !== undefined) {
        if (typeof updates.title !== 'string' || updates.title.length === 0 || updates.title.length > 255) {
            throw new ValidationError('Invalid title: must be a non-empty string (max 255 characters)', 'title');
        }
        validated.title = updates.title;
    }
    if (updates.tags !== undefined) {
        if (!Array.isArray(updates.tags)) {
            throw new ValidationError('Invalid tags: must be an array', 'tags');
        }
        validated.tags = sanitizeArray(updates.tags);
    }
    return validated;
}
export function validatePartialCollection(data) {
    if (typeof data !== 'object' || !data) {
        throw new ValidationError('Invalid collection data: must be an object');
    }
    const updates = data;
    const validated = {};
    if (updates.name !== undefined) {
        if (typeof updates.name !== 'string' || updates.name.length === 0 || updates.name.length > 100) {
            throw new ValidationError('Invalid name: must be a non-empty string (max 100 characters)', 'name');
        }
        validated.name = updates.name;
    }
    if (updates.description !== undefined) {
        if (typeof updates.description === 'string') {
            validated.description = sanitizeString(updates.description, 1000);
        }
    }
    return validated;
}
