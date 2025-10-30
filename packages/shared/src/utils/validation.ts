import type {
  Game,
  Platform,
  GameSession,
  Collection,
  PlatformType,
  SessionStatus,
  SortField,
  SortDirection,
  MetadataSource,
  CacheStatus,
  StreamingMethod,
} from '../types/game.js';

// UUID utilities - will be implemented after package installation
export function isValidUUID(id: string): boolean {
  // Basic UUID v4 format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return typeof id === 'string' && uuidRegex.test(id);
}

export function generateUUID(): string {
  // Simple UUID v4 generation - will be replaced with proper library
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c == 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Date validation
export function isValidISOTimestamp(timestamp: string): boolean {
  const date = new Date(timestamp);
  return !isNaN(date.getTime()) && date.toISOString() === timestamp;
}

export function createTimestamp(): string {
  return new Date().toISOString();
}

// File path validation
export function isValidFilePath(path: string): boolean {
  // Basic file path validation - must be absolute and not empty
  return typeof path === 'string' && path.length > 0 && path.startsWith('/');
}

// Enum validation helpers
export function isValidPlatformType(type: string): type is PlatformType {
  return ['native', 'wine', 'emulator'].includes(type);
}

export function isValidSessionStatus(status: string): status is SessionStatus {
  return ['starting', 'running', 'paused', 'stopped', 'error'].includes(status);
}

export function isValidSortField(field: string): field is SortField {
  return ['title', 'lastPlayed', 'rating', 'created'].includes(field);
}

export function isValidSortDirection(direction: string): direction is SortDirection {
  return ['asc', 'desc'].includes(direction);
}

export function isValidMetadataSource(source: string): source is MetadataSource {
  return ['igdb', 'manual', 'file'].includes(source);
}

export function isValidCacheStatus(status: string): status is CacheStatus {
  return ['fetching', 'complete', 'error', 'stale'].includes(status);
}

export function isValidStreamingMethod(method: string): method is StreamingMethod {
  return ['games-on-whales', 'wolf', 'x11'].includes(method);
}

// Entity validation functions
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateGame(data: unknown): Game {
  if (typeof data !== 'object' || !data) {
    throw new ValidationError('Invalid game data: must be an object');
  }

  const game = data as Record<string, unknown>;

  // Required fields
  if (typeof game.id !== 'string' || !isValidUUID(game.id)) {
    throw new ValidationError('Invalid game ID: must be a valid UUID', 'id');
  }

  if (typeof game.title !== 'string' || game.title.length === 0 || game.title.length > 255) {
    throw new ValidationError(
      'Invalid game title: must be a non-empty string (max 255 characters)',
      'title'
    );
  }

  if (typeof game.filePath !== 'string' || !isValidFilePath(game.filePath)) {
    throw new ValidationError(
      'Invalid file path: must be an absolute path',
      'filePath'
    );
  }

  if (typeof game.platformId !== 'string' || !isValidUUID(game.platformId)) {
    throw new ValidationError(
      'Invalid platform ID: must be a valid UUID',
      'platformId'
    );
  }

  if (!Array.isArray(game.collectionIds)) {
    throw new ValidationError(
      'Invalid collection IDs: must be an array',
      'collectionIds'
    );
  }

  for (const id of game.collectionIds) {
    if (typeof id !== 'string' || !isValidUUID(id)) {
      throw new ValidationError(
        'Invalid collection ID: all collection IDs must be valid UUIDs',
        'collectionIds'
      );
    }
  }

  if (!Array.isArray(game.tags)) {
    throw new ValidationError('Invalid tags: must be an array', 'tags');
  }

  if (typeof game.created !== 'string' || !isValidISOTimestamp(game.created)) {
    throw new ValidationError(
      'Invalid created timestamp: must be a valid ISO timestamp',
      'created'
    );
  }

  if (typeof game.updated !== 'string' || !isValidISOTimestamp(game.updated)) {
    throw new ValidationError(
      'Invalid updated timestamp: must be a valid ISO timestamp',
      'updated'
    );
  }

  // File info validation
  if (typeof game.fileInfo !== 'object' || !game.fileInfo) {
    throw new ValidationError('Invalid file info: must be an object', 'fileInfo');
  }

  const fileInfo = game.fileInfo as Record<string, unknown>;
  if (typeof fileInfo.size !== 'number' || fileInfo.size < 0) {
    throw new ValidationError(
      'Invalid file size: must be a non-negative number',
      'fileInfo.size'
    );
  }

  if (
    typeof fileInfo.lastModified !== 'string' ||
    !isValidISOTimestamp(fileInfo.lastModified)
  ) {
    throw new ValidationError(
      'Invalid last modified timestamp: must be a valid ISO timestamp',
      'fileInfo.lastModified'
    );
  }

  return game as unknown as Game;
}

export function validatePlatform(data: unknown): Platform {
  if (typeof data !== 'object' || !data) {
    throw new ValidationError('Invalid platform data: must be an object');
  }

  const platform = data as Record<string, unknown>;

  if (typeof platform.id !== 'string' || !isValidUUID(platform.id)) {
    throw new ValidationError('Invalid platform ID: must be a valid UUID', 'id');
  }

  if (
    typeof platform.name !== 'string' ||
    platform.name.length === 0 ||
    platform.name.length > 100
  ) {
    throw new ValidationError(
      'Invalid platform name: must be a non-empty string (max 100 characters)',
      'name'
    );
  }

  if (typeof platform.type !== 'string' || !isValidPlatformType(platform.type)) {
    throw new ValidationError(
      'Invalid platform type: must be native, wine, or emulator',
      'type'
    );
  }

  if (typeof platform.isActive !== 'boolean') {
    throw new ValidationError('Invalid isActive: must be a boolean', 'isActive');
  }

  if (typeof platform.created !== 'string' || !isValidISOTimestamp(platform.created)) {
    throw new ValidationError(
      'Invalid created timestamp: must be a valid ISO timestamp',
      'created'
    );
  }

  if (typeof platform.updated !== 'string' || !isValidISOTimestamp(platform.updated)) {
    throw new ValidationError(
      'Invalid updated timestamp: must be a valid ISO timestamp',
      'updated'
    );
  }

  // Configuration validation
  if (typeof platform.configuration !== 'object' || !platform.configuration) {
    throw new ValidationError(
      'Invalid configuration: must be an object',
      'configuration'
    );
  }

  const config = platform.configuration as Record<string, unknown>;
  if (
    !Array.isArray(config.supportedExtensions) ||
    config.supportedExtensions.length === 0
  ) {
    throw new ValidationError(
      'Invalid supported extensions: must be a non-empty array',
      'configuration.supportedExtensions'
    );
  }

  return platform as unknown as Platform;
}

export function validateGameSession(data: unknown): GameSession {
  if (typeof data !== 'object' || !data) {
    throw new ValidationError('Invalid game session data: must be an object');
  }

  const session = data as Record<string, unknown>;

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
    throw new ValidationError(
      'Invalid status: must be starting, running, paused, stopped, or error',
      'status'
    );
  }

  if (typeof session.created !== 'string' || !isValidISOTimestamp(session.created)) {
    throw new ValidationError(
      'Invalid created timestamp: must be a valid ISO timestamp',
      'created'
    );
  }

  if (typeof session.updated !== 'string' || !isValidISOTimestamp(session.updated)) {
    throw new ValidationError(
      'Invalid updated timestamp: must be a valid ISO timestamp',
      'updated'
    );
  }

  return session as unknown as GameSession;
}

export function validateCollection(data: unknown): Collection {
  if (typeof data !== 'object' || !data) {
    throw new ValidationError('Invalid collection data: must be an object');
  }

  const collection = data as Record<string, unknown>;

  if (typeof collection.id !== 'string' || !isValidUUID(collection.id)) {
    throw new ValidationError('Invalid collection ID: must be a valid UUID', 'id');
  }

  if (
    typeof collection.name !== 'string' ||
    collection.name.length === 0 ||
    collection.name.length > 100
  ) {
    throw new ValidationError(
      'Invalid collection name: must be a non-empty string (max 100 characters)',
      'name'
    );
  }

  if (!Array.isArray(collection.gameIds)) {
    throw new ValidationError('Invalid game IDs: must be an array', 'gameIds');
  }

  for (const id of collection.gameIds) {
    if (typeof id !== 'string' || !isValidUUID(id)) {
      throw new ValidationError(
        'Invalid game ID: all game IDs must be valid UUIDs',
        'gameIds'
      );
    }
  }

  if (typeof collection.isSystem !== 'boolean') {
    throw new ValidationError('Invalid isSystem: must be a boolean', 'isSystem');
  }

  if (typeof collection.isPublic !== 'boolean') {
    throw new ValidationError('Invalid isPublic: must be a boolean', 'isPublic');
  }

  if (typeof collection.created !== 'string' || !isValidISOTimestamp(collection.created)) {
    throw new ValidationError(
      'Invalid created timestamp: must be a valid ISO timestamp',
      'created'
    );
  }

  if (typeof collection.updated !== 'string' || !isValidISOTimestamp(collection.updated)) {
    throw new ValidationError(
      'Invalid updated timestamp: must be a valid ISO timestamp',
      'updated'
    );
  }

  return collection as unknown as Collection;
}

// Input sanitization
export function sanitizeString(input: string, maxLength: number = 255): string {
  return input.trim().slice(0, maxLength);
}

export function sanitizeArray(input: unknown[]): string[] {
  return input
    .filter((item) => typeof item === 'string')
    .map((item) => sanitizeString(item as string))
    .filter((item) => item.length > 0);
}

// Search and filter validation
export function validateSearchQuery(query: string): string {
  if (typeof query !== 'string') {
    throw new ValidationError('Search query must be a string');
  }
  const sanitized = sanitizeString(query, 100);
  if (sanitized.length < 2) {
    throw new ValidationError('Search query must be at least 2 characters');
  }
  return sanitized;
}

export function validatePaginationParams(limit?: number, offset?: number): {
  limit: number;
  offset: number;
} {
  const validatedLimit = Math.min(Math.max(limit || 20, 1), 100);
  const validatedOffset = Math.max(offset || 0, 0);
  return { limit: validatedLimit, offset: validatedOffset };
}

// File extension validation
export function validateFileExtension(filePath: string, allowedExtensions: string[]): boolean {
  const extension = filePath.toLowerCase().split('.').pop();
  return extension ? allowedExtensions.includes(extension) : false;
}

// Partial validation for updates
export function validatePartialGame(data: unknown): Partial<Game> {
  if (typeof data !== 'object' || !data) {
    throw new ValidationError('Invalid game data: must be an object');
  }

  const updates = data as Record<string, unknown>;
  const validated: Partial<Game> = {};

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

export function validatePartialCollection(data: unknown): Partial<Collection> {
  if (typeof data !== 'object' || !data) {
    throw new ValidationError('Invalid collection data: must be an object');
  }

  const updates = data as Record<string, unknown>;
  const validated: Partial<Collection> = {};

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