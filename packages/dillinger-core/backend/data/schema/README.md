# Dillinger JSON Schema v1.0

This directory contains JSON Schema definitions for all JSON data structures used in the Dillinger game library backend.

## Schema Versioning

Dillinger implements a comprehensive schema version management system. All JSON data files include a `schemaVersion` field that tracks the version of the data structure.

**Current Schema Version: 1.0**

For complete details on schema versioning, migrations, and best practices, see:
- [JSON Schema Versioning Documentation](../../../docs/JSON_SCHEMA_VERSIONING.md)

## Schema Files

- `game-v1.0.json` - Schema for individual game entries
- `platform-v1.0.json` - Schema for platform configurations
- `metadata-v1.0.json` - Schema for scraped game metadata
- `settings-v1.0.json` - Schema for application settings
- `games-index-v1.0.json` - Schema for the games index

## Version

Current schema version: **1.0**

All schema files follow the JSON Schema draft-07 specification.

## Usage

Each JSON data file in the storage directory should include both a `$schema` reference and a `schemaVersion` field:

```json
{
  "$schema": "../../../schema/game-v1.0.json",
  "schemaVersion": "1.0",
  "id": "game-uuid",
  "title": "Game Title",
  ...
}
```

### Schema Version Field

The `schemaVersion` field is automatically managed by the storage service:
- When reading: validates and normalizes the version
- When writing: automatically adds version 1.0 if missing
- Missing versions are assumed to be 1.0 for backward compatibility

## Schema URLs

The schemas use the following base URL for identification:
- `https://dillinger.dev/schemas/v1.0/`

This allows for future hosting of schemas at a public URL for easier validation.

## Validation

You can validate JSON files against these schemas using various tools:
- Online validators like https://www.jsonschemavalidator.net/
- Command-line tools like `ajv-cli`
- Programmatic validation in TypeScript/JavaScript

## Versioning

When making breaking changes to the data structures:
1. Create new schema files with incremented version (e.g., `game-v1.1.json`, `game-v2.0.json`)
2. Update the `$id` field in the schema to reflect the new version
3. Create migration functions in `packages/shared/src/utils/schema-migration.ts`
4. Update the `CURRENT_SCHEMA_VERSION` constant in `packages/shared/src/types/schema-version.ts`
5. Update this README with the new version information
6. Ensure backward compatibility when possible

For detailed migration procedures, see the [JSON Schema Versioning Documentation](../../../docs/JSON_SCHEMA_VERSIONING.md).
