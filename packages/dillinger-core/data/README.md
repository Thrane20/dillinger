# Dillinger Core Data Directory

This directory contains local data for development and testing.

## Structure

```
data/
├── games/      # Game installation directories
│   └── (game files will be stored here)
└── storage/    # JSON storage for game metadata
    └── (metadata files will be created here)
```

## Purpose

- **Portable Development**: Works across different machines and networks
- **Test Data**: Easy to reset and modify for testing
- **Git Ignored**: Data directory is not tracked in version control

## Default Location

The Dillinger Core app defaults to using `./data` relative to the core package directory:
- Path: `packages/dillinger-core/data/`

## Overriding the Path

You can override the data root with the `DILLINGER_ROOT` environment variable:

```bash
# Use a custom location
DILLINGER_ROOT=/path/to/your/data pnpm run dev

# Use the default (./data)
pnpm run dev
```

## Initial Setup

The app will automatically create necessary subdirectories if they don't exist:
- `data/games/` - Game installations
- `data/storage/` - JSON metadata files

## Example Structure

After adding some games, it might look like:

```
data/
├── games/
│   ├── supertuxkart/
│   │   └── bin/supertuxkart
│   └── my-game/
│       └── game.sh
└── storage/
    ├── games.json
    ├── platforms.json
    └── collections.json
```

## Cleanup

To reset your local data:

```bash
# Remove all data
rm -rf data/

# App will recreate structure on next start
pnpm run dev
```

## Production

In production, mount a persistent volume to a specific path and set `DILLINGER_ROOT`:

```bash
docker run -v /mnt/games:/data -e DILLINGER_ROOT=/data dillinger
```

## Notes

- This directory is listed in `.gitignore`
- Safe for local development and testing
- Each developer can have their own test data
- No network paths or absolute paths required
