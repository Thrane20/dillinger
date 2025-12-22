# Implementation Summary: VICE Runner for Commodore Emulation

## Overview
This implementation adds support for Commodore computer emulation in Dillinger using the VICE emulator. The solution introduces a new runner type that handles ROM-based games differently from installed games (like Wine).

## Changes Made

### 1. VICE Runner Docker Image (`packages/runner-images/vice/`)

**Files Created:**
- `Dockerfile` - Extends base runner, installs VICE emulator suite
- `vice-entrypoint.sh` - Custom entrypoint with VICE-specific environment setup
- `build.sh` - Build script for the VICE runner image
- `README.md` - Comprehensive documentation with usage examples

**Key Features:**
- Based on Arch Linux (via base runner)
- Installs full VICE emulator package (x64sc, x128, xvic, xplus4, xpet, xcbm2, xcbm5x0)
- Configurable video settings (fullscreen, vsync, double scan, double size)
- Configurable audio settings (enabled/disabled, fragment size)
- Configurable emulation settings (true drive emulation, warp mode)
- X11 display and PulseAudio support inherited from base runner

### 2. Commodore Platform Definitions (`packages/dillinger-core/backend/data/storage/platforms/`)

**Created Platform Files:**
- `c64.json` - Commodore 64 (using x64sc - accurate cycle-based emulator)
- `c128.json` - Commodore 128 (using x128)
- `vic20.json` - VIC-20 (using xvic)
- `plus4.json` - Plus/4 (using xplus4)
- `pet.json` - PET (using xpet)

**Platform Configuration:**
- Type: `"emulator"` (distinguishes from Wine's `"wine"` type)
- Container Image: `ghcr.io/thrane20/dillinger/runner-vice:latest`
- Supported Extensions: `.d64`, `.d71`, `.d81`, `.g64`, `.g71`, `.t64`, `.tap`, `.crt`, `.prg`, `.p00`, `.zip`
- Launch Command: Emulator-specific (e.g., `x64sc` for C64) with `-autostart` argument
- Display Streaming: `x11` method

### 3. Frontend Updates (`packages/dillinger-core/frontend/app/components/GameForm.tsx`)

**Changes:**
- Added Commodore platforms to platform dropdown (organized in `<optgroup>`)
- Added ROM file information section for emulator platforms
- Restricted installation UI to Wine platform only
- Installation workflow now explicitly checks for `platformId === 'windows-wine'`
- Added helpful message explaining ROM-based workflow for Commodore games

**UI Sections:**
1. **Installation Section** - Only shown for Wine games without installation
2. **ROM File Section** - Shown for Commodore platforms, displays ROM path
3. **Installed Section** - Only shown for Wine games that are installed
4. **Installing Section** - Only shown for Wine games currently installing
5. **Failed Section** - Only shown for Wine games with failed installation

### 4. Build Infrastructure Updates

**`packages/runner-images/build.sh`:**
- Added `vice` to available images list
- Added dependency checking for VICE (requires base image)
- Added parallel and sequential build support for VICE
- Updated help text and build order documentation

**`package.json`:**
- Added `docker:build:vice` script
- Added `docker:build:vice:no-cache` script

**`packages/runner-images/README.md`:**
- Added VICE runner documentation
- Listed supported Commodore systems
- Added usage examples

## Architecture Decisions

### ROM-based vs Installation-based Workflow

**Wine Games (Installation-based):**
1. User adds game pointing to installer file
2. Game has `installation.status` property (not_installed, installing, installed, failed)
3. User clicks "Install Game" button
4. Installer runs in container
5. Game is installed to a directory
6. Game launches from installed location

**Emulator Games (ROM-based):**
1. User adds game pointing directly to ROM file
2. Game has NO `installation` property
3. No installation step required
4. Game launches directly from ROM file
5. Save states stored in `/saves` volume

### Why This Works

The existing Dillinger schema already supported this pattern:
- `filePath` - Can point to installer OR ROM file
- `installation` - Optional property, only for games requiring installation
- `settings.emulator` - Already existed for emulator configuration
- Platform `type` field - Can be "native", "wine", or "emulator"

## File Structure

```
packages/
├── runner-images/
│   ├── vice/
│   │   ├── Dockerfile              # VICE runner image definition
│   │   ├── vice-entrypoint.sh      # VICE-specific entrypoint
│   │   ├── build.sh                # Build script
│   │   └── README.md               # Documentation
│   ├── build.sh                    # Updated with VICE support
│   └── README.md                   # Updated with VICE docs
└── dillinger-core/
    ├── backend/data/storage/platforms/
    │   ├── c64.json                # Commodore 64 platform
    │   ├── c128.json               # Commodore 128 platform
    │   ├── vic20.json              # VIC-20 platform
    │   ├── plus4.json              # Plus/4 platform
    │   └── pet.json                # PET platform
    └── frontend/app/components/
        └── GameForm.tsx            # Updated UI for ROM workflow
```

## Validation Performed

1. **TypeScript Compilation:** ✅ All packages compile without errors
2. **JSON Validation:** ✅ All platform JSON files are valid
3. **Schema Validation:** ✅ All platforms have required fields
4. **Shellcheck:** ✅ All shell scripts pass without warnings
5. **CodeQL Security Scan:** ✅ No security issues found
6. **Linting:** ✅ No new lint issues introduced

## Testing Recommendations

1. **Build VICE Runner:**
   ```bash
   pnpm run docker:build:base
   pnpm run docker:build:vice
   ```

2. **Add a C64 Game:**
   - Navigate to Add Game page
   - Select "Commodore 64" platform
   - Set file path to a .d64 or .prg file
   - Save game
   - Verify ROM file section shows instead of installation UI

3. **Launch Game:**
   - Open game details
   - Click Launch
   - Verify VICE emulator starts with the ROM loaded

## Future Enhancements

1. **Dynamic Platform Loading:** Currently platforms are hardcoded in frontend dropdown. Could fetch from API.
2. **ROM Browser:** Add file picker for browsing ROM files in `/roms` volume
3. **Save State Management:** UI for managing VICE save states
4. **Additional Emulators:** Use same pattern for DOSBox, ScummVM, RetroArch, etc.
5. **VICE Configuration UI:** Expose VICE settings (video, audio, controls) in game form

## Compatibility

- **Base Runner:** Requires `ghcr.io/thrane20/dillinger/runner-base:latest`
- **Node.js:** 18+ (for backend)
- **Docker:** 20+ (for building images)
- **Platforms:** Linux (recommended), macOS, Windows with WSL2

## Security Considerations

- VICE emulator runs in isolated Docker container
- ROM files mounted read-only
- Save states in separate volume
- No network access required for emulation
- X11 socket sharing required for display (inherited from base runner)

## References

- [VICE Homepage](https://vice-emu.sourceforge.io/)
- [VICE Documentation](https://vice-emu.sourceforge.io/vice_toc.html)
- [Dillinger Architecture](../../ARCHITECTURE.md)
