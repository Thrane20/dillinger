/**
 * JSON Schema Parser and Validator
 *
 * This module provides a parser layer that handles different schema versions
 * for all JSON data files in the Dillinger game library.
 */
import { CURRENT_SCHEMA_VERSION, getDefaultSchemaVersion, normalizeSchemaVersion, isSupportedSchemaVersion, SUPPORTED_SCHEMA_VERSIONS, } from '../types/schema-version.js';
import { migrateData, canMigrate } from './schema-migration.js';
/**
 * Parse JSON data with schema version validation
 *
 * This function:
 * 1. Checks for a schemaVersion field in the data
 * 2. If missing, assumes version 1.0 (as per requirements)
 * 3. Validates the version is supported
 * 4. Optionally migrates data to current version
 *
 * @param data - Raw JSON data object
 * @param options - Parse options
 * @returns Parse result with validated/migrated data
 */
export function parseVersionedData(data, options = {}) {
    const { strict = false, autoMigrate = false } = options;
    // Extract original version or use default
    const originalVersion = data?.schemaVersion;
    // If no version, assume 1.0 per requirements
    if (!originalVersion) {
        const defaultVersion = getDefaultSchemaVersion();
        // console.info(`No schema version found in data, assuming version ${defaultVersion}`);
        return {
            data: {
                ...data,
                schemaVersion: defaultVersion,
            },
            originalVersion: undefined,
            normalizedVersion: defaultVersion,
            wasMigrated: false,
        };
    }
    // Validate version is supported
    if (!isSupportedSchemaVersion(originalVersion)) {
        const supportedVersionsList = Array.from(SUPPORTED_SCHEMA_VERSIONS).join(', ');
        const message = `Unsupported schema version: ${originalVersion}. Supported versions: ${supportedVersionsList}`;
        if (strict) {
            throw new Error(message);
        }
        // In non-strict mode, use default version
        console.warn(message);
        const normalizedVersion = normalizeSchemaVersion(originalVersion);
        return {
            data: {
                ...data,
                schemaVersion: normalizedVersion,
            },
            originalVersion,
            normalizedVersion,
            wasMigrated: true,
        };
    }
    // Check if migration is needed
    const needsMigration = autoMigrate && originalVersion !== CURRENT_SCHEMA_VERSION;
    if (needsMigration) {
        // Check if migration is possible
        if (!canMigrate(originalVersion, CURRENT_SCHEMA_VERSION)) {
            const message = `Cannot migrate data from version ${originalVersion} to ${CURRENT_SCHEMA_VERSION}: no migration path available`;
            if (strict) {
                throw new Error(message);
            }
            console.warn(message);
            return {
                data: data,
                originalVersion,
                normalizedVersion: originalVersion,
                wasMigrated: false,
            };
        }
        // Apply migration
        try {
            const migratedData = migrateData(data, originalVersion, CURRENT_SCHEMA_VERSION);
            return {
                data: migratedData,
                originalVersion,
                normalizedVersion: CURRENT_SCHEMA_VERSION,
                wasMigrated: true,
            };
        }
        catch (error) {
            const message = `Migration failed from version ${originalVersion} to ${CURRENT_SCHEMA_VERSION}: ${error.message}`;
            if (strict) {
                throw new Error(message);
            }
            console.error(message);
            return {
                data: data,
                originalVersion,
                normalizedVersion: originalVersion,
                wasMigrated: false,
            };
        }
    }
    // Data is valid and no migration needed
    return {
        data: data,
        originalVersion,
        normalizedVersion: originalVersion,
        wasMigrated: false,
    };
}
/**
 * Prepare data for JSON serialization with schema version
 *
 * This ensures all data written to JSON files includes the current schema version
 *
 * @param data - Data object to serialize
 * @param version - Schema version to use (defaults to current version)
 * @returns Data with schema version field
 */
export function serializeVersionedData(data, version = CURRENT_SCHEMA_VERSION) {
    return {
        ...data,
        schemaVersion: version,
    };
}
/**
 * Validate that data has the required schema version field
 *
 * @param data - Data to validate
 * @returns true if data has a valid schema version
 */
export function hasValidSchemaVersion(data) {
    return (typeof data === 'object' &&
        data !== null &&
        'schemaVersion' in data &&
        typeof data.schemaVersion === 'string' &&
        isSupportedSchemaVersion(data.schemaVersion));
}
/**
 * Get the schema version from data, or undefined if not present/invalid
 *
 * @param data - Data to extract version from
 * @returns Schema version or undefined
 */
export function extractSchemaVersion(data) {
    if (typeof data !== 'object' || data === null) {
        return undefined;
    }
    const version = data.schemaVersion;
    if (typeof version === 'string') {
        return version;
    }
    return undefined;
}
