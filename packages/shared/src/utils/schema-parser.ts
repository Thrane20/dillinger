/**
 * JSON Schema Parser and Validator
 * 
 * This module provides a parser layer that handles different schema versions
 * for all JSON data files in the Dillinger game library.
 */

import type { 
  VersionedData, 
  SchemaVersion,
} from '../types/schema-version.js';
import {
  CURRENT_SCHEMA_VERSION,
  getDefaultSchemaVersion,
  normalizeSchemaVersion,
  isSupportedSchemaVersion,
  SUPPORTED_SCHEMA_VERSIONS,
} from '../types/schema-version.js';
import { migrateData, canMigrate } from './schema-migration.js';

/**
 * Parse result containing the parsed data and metadata
 */
export interface ParseResult<T extends VersionedData> {
  data: T;
  originalVersion: SchemaVersion | undefined;
  normalizedVersion: SchemaVersion;
  wasMigrated: boolean;
}

/**
 * Parse options for controlling parser behavior
 */
export interface ParseOptions {
  /**
   * If true, throws an error when encountering an unsupported schema version
   * If false, attempts to use the default version (1.0) with a warning
   */
  strict?: boolean;
  
  /**
   * If true, automatically migrates data to the current schema version
   * If false, keeps the data at its original version
   */
  autoMigrate?: boolean;
}

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
export function parseVersionedData<T extends VersionedData>(
  data: any,
  options: ParseOptions = {}
): ParseResult<T> {
  const { strict = false, autoMigrate = false } = options;
  
  // Extract original version or use default
  const originalVersion = data?.schemaVersion as SchemaVersion | undefined;
  
  // If no version, assume 1.0 per requirements
  if (!originalVersion) {
    const defaultVersion = getDefaultSchemaVersion();
    console.info(`No schema version found in data, assuming version ${defaultVersion}`);
    
    return {
      data: {
        ...data,
        schemaVersion: defaultVersion,
      } as T,
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
      } as T,
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
        data: data as T,
        originalVersion,
        normalizedVersion: originalVersion,
        wasMigrated: false,
      };
    }
    
    // Apply migration
    try {
      const migratedData = migrateData<T>(data, originalVersion, CURRENT_SCHEMA_VERSION);
      
      return {
        data: migratedData,
        originalVersion,
        normalizedVersion: CURRENT_SCHEMA_VERSION,
        wasMigrated: true,
      };
    } catch (error) {
      const message = `Migration failed from version ${originalVersion} to ${CURRENT_SCHEMA_VERSION}: ${(error as Error).message}`;
      
      if (strict) {
        throw new Error(message);
      }
      
      console.error(message);
      return {
        data: data as T,
        originalVersion,
        normalizedVersion: originalVersion,
        wasMigrated: false,
      };
    }
  }
  
  // Data is valid and no migration needed
  return {
    data: data as T,
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
export function serializeVersionedData<T extends Record<string, any>>(
  data: T,
  version: SchemaVersion = CURRENT_SCHEMA_VERSION
): T & VersionedData {
  return {
    ...data,
    schemaVersion: version,
  } as T & VersionedData;
}

/**
 * Validate that data has the required schema version field
 * 
 * @param data - Data to validate
 * @returns true if data has a valid schema version
 */
export function hasValidSchemaVersion(data: any): data is VersionedData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'schemaVersion' in data &&
    typeof data.schemaVersion === 'string' &&
    isSupportedSchemaVersion(data.schemaVersion)
  );
}

/**
 * Get the schema version from data, or undefined if not present/invalid
 * 
 * @param data - Data to extract version from
 * @returns Schema version or undefined
 */
export function extractSchemaVersion(data: any): SchemaVersion | undefined {
  if (typeof data !== 'object' || data === null) {
    return undefined;
  }
  
  const version = data.schemaVersion;
  if (typeof version === 'string') {
    return version as SchemaVersion;
  }
  
  return undefined;
}
