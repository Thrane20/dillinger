# Data Path Configuration Update

**Date:** October 30, 2025  
**Change:** Switched from hardcoded absolute path to relative local data directory

## What Changed

### Before
```json
"dev": "DATA_PATH=/mnt/linuxfast/dev/dillinger/data ..."
```
- Hardcoded absolute path
- Only worked on specific machine/network
- Broke on different environments

### After
```json
"dev": "DATA_PATH=${DATA_PATH:-./data} ..."
```
- Relative path (portable)
- Works across all machines
- Can be overridden with env var

## Files Updated

1. **apps/dillinger-core/backend/package.json**
   - Changed `DATA_PATH` default from absolute to `./data`

2. **apps/dillinger-core/package.json**
   - Removed `DATA_PATH` from dev scripts (uses backend default)

3. **.gitignore**
   - Added backend data directory (except README and .gitkeep)

4. **Created Structure**
   ```
   apps/dillinger-core/backend/data/
   ├── .gitkeep
   ├── README.md
   ├── games/         (created, git-ignored)
   └── storage/       (created, git-ignored)
   ```

## Usage

### Default (Recommended)
```bash
pnpm run dev
# Uses: ./data (relative to backend directory)
```

### Custom Path
```bash
DATA_PATH=/custom/path pnpm run dev
# Uses: /custom/path
```

### Docker/Production
```bash
docker run -e DATA_PATH=/data -v /mnt/games:/data dillinger
# Uses: /data (mounted volume)
```

## Data Directory Structure

```
apps/dillinger-core/backend/data/
├── .gitkeep              # Ensures dir exists in git
├── README.md             # Documentation (tracked)
├── games/               # Game installations (ignored)
│   └── my-game/
│       └── game.sh
└── storage/             # JSON metadata (ignored)
    ├── games.json
    └── platforms.json
```

## Benefits

✅ **Portable** - Works on any machine  
✅ **Clean** - No hardcoded paths  
✅ **Flexible** - Easy to override  
✅ **Safe** - Data is git-ignored  
✅ **Local** - Each dev has own data  

## Migration

If you had data at the old location:

```bash
# Optional: Copy old data to new location
cp -r /mnt/linuxfast/dev/dillinger/data/* apps/dillinger-core/backend/data/

# Or start fresh (recommended for testing)
# Data directory will be auto-created on first run
```

## Notes

- Backend creates `data/games/` and `data/storage/` automatically
- Data directory is in `.gitignore` (except README and .gitkeep)
- Each developer can have their own test data
- Production should use mounted volumes with explicit `DATA_PATH`

---

**Status:** ✅ Complete  
**Portable:** Yes  
**Breaking Change:** No (backwards compatible via env var)
