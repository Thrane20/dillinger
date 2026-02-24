/**
 * JSON Schema Version Management
 *
 * This module provides version constants and types for managing JSON schema versions
 * across all data entities in the Dillinger game library.
 */
/**
 * Current schema version for all JSON data files
 */
export const CURRENT_SCHEMA_VERSION = '1.0';
/**
 * Supported schema versions
 */
export const SUPPORTED_SCHEMA_VERSIONS = ['1.0'];
/**
 * Check if a schema version is supported
 */
export function isSupportedSchemaVersion(version) {
    if (!version) {
        return false;
    }
    return SUPPORTED_SCHEMA_VERSIONS.includes(version);
}
/**
 * Get the default schema version for data without a version field
 * According to requirements: "if you see a json file that does not have a schema version, assume it to be 1.0"
 */
export function getDefaultSchemaVersion() {
    return '1.0';
}
/**
 * Validate and normalize a schema version string
 * Returns the normalized version or the default version if invalid
 */
export function normalizeSchemaVersion(version) {
    if (!version) {
        return getDefaultSchemaVersion();
    }
    // If the version is supported, return it as-is
    if (isSupportedSchemaVersion(version)) {
        return version;
    }
    // If not supported, return default
    console.warn(`Unsupported schema version "${version}", defaulting to ${getDefaultSchemaVersion()}`);
    return getDefaultSchemaVersion();
}
