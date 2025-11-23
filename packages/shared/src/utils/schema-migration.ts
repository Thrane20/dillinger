/**
 * Schema Migration Utilities
 * 
 * This module provides utilities for migrating data between different schema versions.
 * When breaking changes are made to data structures, migration functions can be added here.
 */

import type { SchemaVersion, VersionedData } from '../types/schema-version.js';
import { CURRENT_SCHEMA_VERSION } from '../types/schema-version.js';

/**
 * Migration function signature
 * Takes data at one version and transforms it to the next version
 */
export type MigrationFunction<TFrom = any, TTo = any> = (data: TFrom) => TTo;

/**
 * Migration definition
 */
export interface Migration {
  fromVersion: SchemaVersion;
  toVersion: SchemaVersion;
  migrate: MigrationFunction;
  description: string;
}

/**
 * Registry of all migrations
 * Migrations should be added in chronological order
 */
const migrations: Migration[] = [
  // Future migrations will be added here
  // Example:
  // {
  //   fromVersion: '1.0',
  //   toVersion: '1.1',
  //   migrate: (data) => {
  //     // Add new field with default value
  //     return { ...data, newField: 'defaultValue' };
  //   },
  //   description: 'Add newField to all entities'
  // },
  // {
  //   fromVersion: '1.1',
  //   toVersion: '2.0',
  //   migrate: (data) => {
  //     // Breaking change: rename field
  //     const { oldField, ...rest } = data;
  //     return { ...rest, renamedField: oldField };
  //   },
  //   description: 'Rename oldField to renamedField'
  // }
];

/**
 * Get all migrations needed to upgrade from one version to another
 * 
 * @param fromVersion - Starting version
 * @param toVersion - Target version (defaults to current version)
 * @returns Array of migrations to apply in order
 */
export function getMigrationPath(
  fromVersion: SchemaVersion,
  toVersion: SchemaVersion = CURRENT_SCHEMA_VERSION
): Migration[] {
  const path: Migration[] = [];
  let currentVersion = fromVersion;
  
  // Build migration path
  while (currentVersion !== toVersion) {
    const nextMigration = migrations.find(m => m.fromVersion === currentVersion);
    
    if (!nextMigration) {
      // No migration path found
      throw new Error(
        `No migration path found from version ${fromVersion} to ${toVersion}. ` +
        `Stuck at version ${currentVersion}.`
      );
    }
    
    path.push(nextMigration);
    currentVersion = nextMigration.toVersion;
    
    // Safety check to prevent infinite loops
    if (path.length > 100) {
      throw new Error(
        `Migration path too long (>100 steps) from ${fromVersion} to ${toVersion}. ` +
        `This likely indicates a circular migration or misconfiguration.`
      );
    }
  }
  
  return path;
}

/**
 * Apply migrations to upgrade data from one version to another
 * 
 * @param data - Data to migrate
 * @param fromVersion - Current version of the data
 * @param toVersion - Target version (defaults to current version)
 * @returns Migrated data
 */
export function migrateData<T extends VersionedData>(
  data: any,
  fromVersion: SchemaVersion,
  toVersion: SchemaVersion = CURRENT_SCHEMA_VERSION
): T {
  // If already at target version, return as-is
  if (fromVersion === toVersion) {
    return { ...data, schemaVersion: toVersion } as T;
  }
  
  // Get migration path
  const migrationPath = getMigrationPath(fromVersion, toVersion);
  
  // Apply migrations in sequence
  let migratedData = data;
  for (const migration of migrationPath) {
    console.log(
      `Migrating data from ${migration.fromVersion} to ${migration.toVersion}: ${migration.description}`
    );
    migratedData = migration.migrate(migratedData);
    migratedData.schemaVersion = migration.toVersion;
  }
  
  return migratedData as T;
}

/**
 * Check if a migration path exists between two versions
 * 
 * @param fromVersion - Starting version
 * @param toVersion - Target version
 * @returns true if migration is possible
 */
export function canMigrate(
  fromVersion: SchemaVersion,
  toVersion: SchemaVersion = CURRENT_SCHEMA_VERSION
): boolean {
  if (fromVersion === toVersion) {
    return true;
  }
  
  try {
    getMigrationPath(fromVersion, toVersion);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get list of all registered migrations
 * 
 * @returns Array of all migrations
 */
export function getAllMigrations(): readonly Migration[] {
  return migrations;
}

/**
 * Register a new migration
 * Note: This should typically only be used in test scenarios.
 * Production migrations should be added directly to the migrations array above.
 * 
 * @param migration - Migration to register
 */
export function registerMigration(migration: Migration): void {
  // Check for duplicate
  const existing = migrations.find(
    m => m.fromVersion === migration.fromVersion && m.toVersion === migration.toVersion
  );
  
  if (existing) {
    throw new Error(
      `Migration from ${migration.fromVersion} to ${migration.toVersion} already exists`
    );
  }
  
  migrations.push(migration);
}
