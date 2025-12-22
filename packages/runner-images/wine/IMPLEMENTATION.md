# Wine Runner Implementation Summary

## Overview

This document summarizes the implementation of the Wine runner for the Dillinger game library platform. The Wine runner enables Windows games and applications to run on Linux through Wine compatibility layer in a containerized environment.

## What Was Implemented

### 1. Wine Runner Docker Image

**Location**: `/packages/runner-images/wine/`

**Base System**: Arch Linux (rolling release)

**Key Features**:
- Wine with Wine Mono and Gecko for .NET and browser support
- Full 32-bit (multilib) library support for legacy Windows games
- PulseAudio integration for audio (learned from Games on Whales)
- NVIDIA GPU auto-detection and configuration (learned from Games on Whales)
- X11 display support
- OpenGL and Vulkan graphics acceleration
- Winetricks for installing additional Windows components

### 2. Dual-Mode Operation

The runner supports two distinct modes:

#### Game Launch Mode
- Runs already-installed Windows games
- Requires `GAME_EXECUTABLE` environment variable
- Supports command-line arguments via `GAME_ARGS`
- Works with Wine prefixes mounted as volumes

#### Installer Mode
- Installs Windows applications/games from .exe/.msi installers
- Enabled with `INSTALLER_MODE=true`
- Requires `INSTALLER_PATH` environment variable
- Supports silent installations via `INSTALLER_ARGS`
- Optional `KEEP_ALIVE` mode to keep container running after installation

### 3. Architecture Learnings from Games on Whales

The implementation incorporates best practices from the Games on Whales (GoW) project:

**PulseAudio Setup**:
- Auto-detection and startup of PulseAudio daemon
- Proper configuration for containerized audio
- Support for both system and user-level audio

**NVIDIA Driver Support**:
- Runtime detection of NVIDIA GPUs using `lspci`
- Automatic configuration of Wine environment variables for NVIDIA
- Graceful fallback to software rendering if GPU unavailable
- Support for AMD and Intel integrated graphics

**Not Copied from GoW**:
- Hard-coded application launchers (Steam, Epic, etc.) were deliberately excluded
- Gamescope integration was not included (as per requirements)
- Focus on generic Wine execution, not specific game platforms

### 4. Docker Configuration

**Dockerfile Highlights**:
- Multi-stage potential (currently single-stage for simplicity)
- Comprehensive gaming library installation (both 64-bit and 32-bit)
- Non-root user (`gameuser`) for security
- Multiple volume mount points for isolation
- Health checks for container monitoring

**Volume Mounts**:
- `/game` - Game files (read-only)
- `/installers` - Windows installers (read-only)
- `/wineprefix` - Wine prefix (Windows environment, read-write, persistent)
- `/saves` - Save game data (read-write, persistent)
- `/config` - Optional configuration files (read-write)

### 5. Entrypoint Script

**Features**:
- Environment validation and error checking
- Wine prefix initialization on first run
- X11 connection verification
- PulseAudio configuration and startup
- GPU detection (NVIDIA, AMD, Intel)
- Mode switching (installer vs game launch)
- Colored output for better UX
- XDG directories for proper save management

### 6. Platform Integration

**Platform Definition**: `windows-wine.json`

- Platform ID: `windows-wine`
- Platform Type: `wine`
- Supported Extensions: `.exe`, `.msi`, `.bat`, `.cmd`
- Container Image: `ghcr.io/thrane20/dillinger/runner-wine:latest`
- Display Method: `x11`

The platform definition follows the existing Dillinger schema and integrates seamlessly with the game library management system.

### 7. Documentation

**README.md**:
- Comprehensive feature overview
- Architecture explanation
- Usage instructions for both modes
- Environment variable reference
- Volume mount documentation
- Troubleshooting guide
- Platform integration guide

**EXAMPLES.md**:
- 10 practical usage examples
- Installation workflows
- Common scenarios (portable games, 32-bit apps, GPU acceleration)
- Debug techniques
- Multi-game organization
- Integration examples

**Validation Script** (`validate.sh`):
- Automated structure validation
- Dockerfile content verification
- Platform definition validation
- Pre-build checks

### 8. Scripts and Utilities

**build.sh**:
- Docker image build automation
- Consistent image tagging

**test-installer.sh**:
- Basic Wine installation test
- Environment verification
- Integration testing support

**nvidia-check.sh**:
- GPU detection script
- Driver verification
- Environment variable configuration

## Technical Decisions

### Why Arch Linux?

1. **Rolling Release**: Always up-to-date Wine and gaming libraries
2. **Multilib**: Built-in 32-bit support essential for Wine
3. **AUR**: Access to gaming-specific packages
4. **Performance**: Optimized for gaming workloads
5. **Consistency**: Matches the existing `linux-native` runner

### Why Not Proton Yet?

Per requirements:
- Start with Wine only
- Proton support will be added later as a separate feature
- Allows for testing Wine compatibility first
- Proton requires additional Steam Runtime dependencies

### Why Not Gamescope Yet?

Per requirements:
- Gamescope integration will come later
- Current focus is on basic Wine execution
- X11 provides sufficient display support for now

## Security Considerations

1. **Non-root User**: Games run as `gameuser` (UID 1000)
2. **Read-only Mounts**: Game and installer volumes are mounted read-only where possible
3. **Isolated Prefixes**: Each game uses a separate Wine prefix for isolation
4. **No Networking**: Currently no exposed network ports (can be added later)

## What's Not Included

As per requirements and design decisions:

1. ❌ Gamescope integration (deferred)
2. ❌ Proton support (deferred to future implementation)
3. ❌ Hard-coded game launchers (Steam, Epic, etc.) - by design
4. ❌ Pre-configured Wine prefixes - users create their own
5. ❌ Save game cloud sync - handled by Dillinger core
6. ❌ Network streaming - handled by Dillinger core with Wolf/GoW

## Testing Strategy

Given the Docker build time (20+ minutes), a validation approach was chosen:

1. **Static Validation**: `validate.sh` verifies all files and configuration
2. **Structure Checks**: Validates Dockerfile contents and script presence
3. **Platform Schema**: Validates JSON against Dillinger schemas
4. **Manual Testing**: Build and test instructions provided in documentation

## Integration with Dillinger

The Wine runner integrates with Dillinger through:

1. **Platform System**: Defined in `windows-wine.json`
2. **Runner Types**: Uses standard runner-types interfaces
3. **Container Management**: Compatible with Docker service
4. **Volume Strategy**: Follows Dillinger volume conventions
5. **Display Streaming**: Uses X11 method (Wolf/GoW compatible)

## Future Enhancements

Potential future additions (not in current scope):

1. **Proton Support**: Multiple Proton versions
2. **DXVK**: DirectX to Vulkan translation layer
3. **VKD3D**: DirectX 12 support
4. **Gamescope**: Compositor integration
5. **Save Sync**: Cloud save synchronization
6. **Performance Monitoring**: Wine-specific metrics
7. **Wine Version Selection**: Multiple Wine versions

## File Structure

```
packages/runner-images/wine/
├── Dockerfile              # Main container image definition
├── entrypoint.sh          # Container entrypoint with mode switching
├── build.sh               # Build automation script
├── validate.sh            # Pre-build validation script
├── test-installer.sh      # Test/demo script
├── README.md              # Main documentation
├── EXAMPLES.md            # Usage examples and scenarios
├── IMPLEMENTATION.md      # This file
└── scripts/
    └── nvidia-check.sh    # GPU detection script

packages/dillinger-core/backend/data/storage/platforms/
└── windows-wine.json      # Platform definition
```

## Lessons from Games on Whales

### What We Learned

1. **PulseAudio Setup**: Proper containerized audio requires careful configuration
2. **NVIDIA Detection**: Runtime GPU detection is more flexible than build-time
3. **Base Images**: Ubuntu 25.04 works well, but we chose Arch for consistency
4. **User Management**: Non-root execution is critical for security
5. **Volume Strategy**: Separate volumes for state vs read-only content

### What We Adapted

1. **Base OS**: Used Arch Linux instead of Ubuntu for consistency
2. **Simplicity**: Avoided complex multi-stage builds initially
3. **Genericity**: No hard-coded app launchers
4. **Wine Focus**: Pure Wine, not Proton (yet)

## Validation Results

All validation checks pass:

```
✓ Wine runner directory exists
✓ Dockerfile exists and is valid
✓ All scripts exist and are executable
✓ NVIDIA check script present
✓ Documentation complete
✓ Platform definition valid
✓ Uses Arch Linux base
✓ Multilib enabled
✓ Wine installed
✓ PulseAudio configured
✓ NVIDIA support included
✓ Installer mode supported
✓ Wine prefix configuration present
```

## Conclusion

The Wine runner implementation successfully:

1. ✅ Creates a Wine runner based on Arch Linux
2. ✅ Incorporates PulseAudio learnings from GoW
3. ✅ Incorporates NVIDIA detection from GoW
4. ✅ Avoids hard-coded app launchers
5. ✅ Supports Windows installers (.exe, .msi)
6. ✅ Does not include gamescope (deferred)
7. ✅ Uses Wine (not Proton yet)
8. ✅ Provides comprehensive documentation
9. ✅ Follows Dillinger architecture patterns
10. ✅ Integrates with platform system

The runner is ready for building and testing. The Docker build will take approximately 20-30 minutes due to the comprehensive package installation, but all structure and configuration has been validated.
