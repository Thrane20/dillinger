# JSON Schema Version Management

## Overview

Dillinger implements a comprehensive JSON schema version management system to ensure data compatibility as the application evolves. All JSON data files are tagged with a schema version, allowing for controlled migrations and backward compatibility.

## Current Version

**Current Schema Version: 1.0**

## Schema Version Field

All JSON data files include a `schemaVersion` field at the root level:

```json
{
  "schemaVersion": "1.0",
  "id": "game-uuid",
  "title": "Game Title",
  ...
}
```

### Default Behavior

If a JSON file does not have a `schemaVersion` field, it is assumed to be version **1.0** for backward compatibility.

## Supported Entity Types

The following entity types are managed with schema versioning:

- **Game** - Individual game entries
- **Platform** - Platform configurations (Linux Native, Wine, VICE, etc.)
- **GameSession** - Active/historical game sessions
- **Collection** - User-created game collections
- **MetadataCache** - Cached game metadata from external sources
- **Volume** - Docker volume configurations
- **GamesIndex** - Performance index for games
- **SessionsIndex** - Performance index for sessions
- **VolumesIndex** - Index for volumes

## How It Works

### Reading JSON Files

When reading JSON files, the storage service:

1. Reads the raw JSON data
2. Checks for a `schemaVersion` field
3. If missing, assumes version 1.0
4. Validates the version is supported
5. Optionally migrates data to the current version
6. Returns the normalized data

### Writing JSON Files

When writing JSON files, the storage service:

1. Takes the data object
2. Automatically adds `schemaVersion: "1.0"` if not present
3. Writes the versioned data to disk

This ensures all new and updated files have proper version tracking.

## Parser API

### parseVersionedData

Parse and validate JSON data with schema version checking:

```typescript
import { parseVersionedData } from '@dillinger/shared';

const result = parseVersionedData<Game>(rawData, {
  strict: false,      // Don't throw errors, just warn
  autoMigrate: false  // Don't auto-migrate, just normalize
});

console.log(result.data);              // Parsed data
console.log(result.originalVersion);   // Original version or undefined
console.log(result.normalizedVersion); // Normalized version
console.log(result.wasMigrated);       // true if data was migrated
```

### serializeVersionedData

Prepare data for serialization with schema version:

```typescript
import { serializeVersionedData } from '@dillinger/shared';

const versionedData = serializeVersionedData(gameData);
// Returns: { ...gameData, schemaVersion: "1.0" }
```

### Other Utilities

```typescript
import {
  isSupportedSchemaVersion,
  normalizeSchemaVersion,
  extractSchemaVersion,
  hasValidSchemaVersion
} from '@dillinger/shared';

// Check if version is supported
if (isSupportedSchemaVersion("1.0")) {
  // ...
}

// Normalize version (returns default if invalid)
const version = normalizeSchemaVersion(maybeVersion);

// Extract version from data
const version = extractSchemaVersion(jsonData);

// Validate data has schema version
if (hasValidSchemaVersion(data)) {
  // ...
}
```

## Schema Migration

### Creating Migrations

When making breaking changes to data structures, create a migration:

```typescript
// In packages/shared/src/utils/schema-migration.ts
const migrations: Migration[] = [
  {
    fromVersion: '1.0',
    toVersion: '1.1',
    migrate: (data) => {
      // Add new field with default value
      return { ...data, newField: 'defaultValue' };
    },
    description: 'Add newField to all entities'
  },
  {
    fromVersion: '1.1',
    toVersion: '2.0',
    migrate: (data) => {
      // Breaking change: rename field
      const { oldField, ...rest } = data;
      return { ...rest, renamedField: oldField };
    },
    description: 'Rename oldField to renamedField'
  }
];
```

### Using Migrations

```typescript
import { migrateData, canMigrate, getMigrationPath } from '@dillinger/shared';

// Check if migration is possible
if (canMigrate('1.0', '2.0')) {
  // Migrate data
  const migratedData = migrateData<Game>(oldData, '1.0', '2.0');
}

// Get migration path
const path = getMigrationPath('1.0', '2.0');
// Returns array of migrations to apply in order
```

## Version Numbering

Schema versions follow a simplified semantic versioning scheme:

- **Major.Minor** format (e.g., "1.0", "1.1", "2.0")
- **Major version** changes indicate breaking changes
- **Minor version** changes indicate backward-compatible additions

### When to Increment Versions

#### Increment Minor Version (1.0 → 1.1)
- Adding new optional fields
- Adding new entity types
- Non-breaking enhancements

#### Increment Major Version (1.x → 2.0)
- Removing fields
- Renaming fields
- Changing field types
- Changing field meanings
- Restructuring data

## Best Practices

### For Developers

1. **Always use storage service methods** - Don't read/write JSON files directly
2. **Test with old data** - Ensure migrations work with all supported versions
3. **Document breaking changes** - Update this file when creating migrations
4. **Provide migration path** - Never skip versions in migration chain
5. **Keep migrations small** - Break large changes into multiple steps

### For Schema Changes

1. **Plan migrations** - Design migration logic before changing types
2. **Test thoroughly** - Verify data integrity after migration
3. **Support rollback** - Document how to revert if needed
4. **Version schema files** - Update JSON schema files in `data/schema/`
5. **Update constants** - Update `CURRENT_SCHEMA_VERSION` constant

## JSON Schema Files

Schema definition files are stored in:
```
packages/dillinger-core/backend/data/schema/
├── game-v1.0.json
├── platform-v1.0.json
├── metadata-v1.0.json
├── settings-v1.0.json
└── games-index-v1.0.json
```

These JSON Schema files can be used for validation and documentation.

## Future Enhancements

Planned improvements to the schema version system:

- [ ] Automated data validation against JSON schemas
- [ ] Schema version conflict detection on startup
- [ ] Bulk migration utilities for large datasets
- [ ] Schema version audit logging
- [ ] Automated backup before migrations
- [ ] Schema version compatibility matrix
- [ ] Migration rollback utilities

## Troubleshooting

### Missing Schema Version Warning

```
No schema version found in data, assuming version 1.0
```

**Solution**: This is expected for old data files. They will be automatically versioned on next write.

### Unsupported Schema Version

```
Unsupported schema version: "2.0". Supported versions: 1.0
```

**Solution**: 
1. Update application to support newer version
2. Or provide migration from 2.0 back to 1.0

### Migration Failed

```
Migration failed from version 1.0 to 2.0: ...
```

**Solution**:
1. Check migration function for errors
2. Verify data structure is compatible
3. Review error message for specific issue
4. Fix migration or data as needed

## References

- [JSON Schema Specification](https://json-schema.org/)
- [Semantic Versioning](https://semver.org/)
- Schema version constants: `packages/shared/src/types/schema-version.ts`
- Parser utilities: `packages/shared/src/utils/schema-parser.ts`
- Migration utilities: `packages/shared/src/utils/schema-migration.ts`
