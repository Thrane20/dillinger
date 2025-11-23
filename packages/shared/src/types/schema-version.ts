/**
 * JSON Schema Version Management
 * 
 * This module provides version constants and types for managing JSON schema versions
 * across all data entities in the Dillinger game library.
 */

/**
 * Current schema version for all JSON data files
 */
export const CURRENT_SCHEMA_VERSION = '1.0' as const;

/**
 * Schema version type - semver-like version string
 */
export type SchemaVersion = '1.0' | string;

/**
 * Base interface that all versioned data entities should extend
 * The schemaVersion is optional because it will be automatically added by the serializer
 */
export interface VersionedData {
  /**
   * Schema version of this JSON data file
   * Format: semver-like version string (e.g., "1.0", "1.1", "2.0")
   * This field is automatically added when writing to JSON
   */
  schemaVersion?: SchemaVersion;
}

/**
 * Supported schema versions
 */
export const SUPPORTED_SCHEMA_VERSIONS: ReadonlyArray<SchemaVersion> = ['1.0'] as const;

/**
 * Check if a schema version is supported
 */
export function isSupportedSchemaVersion(version: string | undefined): version is SchemaVersion {
  if (!version) {
    return false;
  }
  return SUPPORTED_SCHEMA_VERSIONS.includes(version as SchemaVersion);
}

/**
 * Get the default schema version for data without a version field
 * According to requirements: "if you see a json file that does not have a schema version, assume it to be 1.0"
 */
export function getDefaultSchemaVersion(): SchemaVersion {
  return '1.0';
}

/**
 * Validate and normalize a schema version string
 * Returns the normalized version or the default version if invalid
 */
export function normalizeSchemaVersion(version: string | undefined): SchemaVersion {
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
