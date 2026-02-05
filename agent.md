# Dillinger - AI Agent Guidelines

## Project Overview

Dillinger is a self-hosted game library manager with streaming capabilities. It allows users to manage retro and modern games across multiple platforms and stream them to devices via Moonlight/Wolf.

## Tech Stack

- **Frontend**: Next.js 14+, React, TailwindCSS
- **Backend**: Next.js 14+ api routes
- **Package Manager**: pnpm with workspaces
- **Containerization**: Docker multi-stage builds
- **Streaming**: Wolf (Moonlight-compatible server), GStreamer
- **Emulators**: RetroArch, VICE, FS-UAE, Wine (for Windows games)

## Project Structure

```
/workspaces/dillinger/
├── packages/
│   ├── dillinger-core/     # Main Next.js application
│   │   ├── app/            # Next.js app router pages
│   │   ├── backend/        # Backend services and data
│   │   ├── lib/            # Shared libraries, services, workers
│   │   └── assets/         # JSON schemas, defaults
│   ├── runner-images/      # Docker images for game runners
│   │   ├── base/           # Base image with Wolf, GStreamer, GPU drivers
│   │   ├── retroarch/      # RetroArch emulator image
│   │   ├── vice/           # Commodore 64 emulator image
│   │   ├── fs-uae/         # Amiga emulator image
│   │   ├── wine/           # Windows compatibility layer
│   │   └── linux-native/   # Native Linux games
│   └── shared/             # Shared TypeScript types and utilities
├── docker/                 # Docker configurations
├── docs/                   # Documentation
└── scripts/                # Build and deployment scripts
```

## Common Commands

```bash
# Development
pnpm dev                          # Start development server
pnpm build                        # Build all packages
pnpm lint                         # Run linting

# Docker builds (run from project root)
pnpm docker:build:all             # Build all runner images
pnpm docker:build:base            # Build base runner image
pnpm docker:build:retroarch       # Build RetroArch runner
pnpm docker:build:wine            # Build Wine runner
pnpm docker:build:vice            # Build VICE runner
pnpm docker:build:fs-uae          # Build FS-UAE runner
pnpm docker:build:linux-native    # Build Linux native runner

# Force rebuild without cache
pnpm docker:build:base:no-cache
pnpm docker:build:retroarch:no-cache
# (etc. for other images)

# Testing
pnpm test
```

## Docker Volumes

- `dillinger_root` - Application data, Wolf config, settings
- `dillinger_library` - Game library metadata (JSON files with GUID linking)

## Key Configuration Files

- `packages/runner-images/base/entrypoint.sh` - Wolf streaming config, GStreamer encoders
- `packages/dillinger-core/app/` - Next.js pages and API routes
- `packages/shared/src/types/` - Shared TypeScript interfaces

## Important Patterns

### Wolf Configuration
Wolf uses config version 4 with TOML format:
```toml
config_version = 4

[[apps]]
title = "Game Name"
# ...
```

### Video Encoding (AMD GPUs)
Use `vah264enc` (newer VA plugin), NOT `vaapih264enc` (legacy):
```toml
[[gstreamer.video.h264_encoders]]
plugin_name = "va"
check_elements = ["vah264enc"]
```

### GStreamer Plugin Isolation
Wolf bundles its own GStreamer. Isolate from system plugins:
```bash
export GST_PLUGIN_PATH=/usr/local/lib/x86_64-linux-gnu/gstreamer-1.0
export GST_PLUGIN_SYSTEM_PATH=""
```

## Common Tasks

### Adding a New Runner Image
1. Create directory in `packages/runner-images/<name>/`
2. Add `Dockerfile`, `<name>-entrypoint.sh`, `build.sh`, `README.md`
3. Extend from `runner-base` image
4. Add build script to root `package.json`

### Debugging Streaming Issues
1. Check Wolf logs: `docker logs <container>`
2. Verify encoder: Look for "Using H264 encoder" in logs
3. Test GStreamer: `gst-inspect-1.0 vah264enc`
4. Clear Wolf config: `docker run --rm -v dillinger_root:/data --entrypoint rm alpine -f /data/wolf/config.toml`

### Rebuilding After entrypoint.sh Changes
entrypoint.sh is copied at build time, so use `--no-cache`:
```bash
pnpm docker:build:base:no-cache
pnpm docker:build:retroarch:no-cache  # Depends on base
```

## File Naming Conventions

- Entrypoints: `<runner>-entrypoint.sh` (e.g., `retroarch-entrypoint.sh`)
- Docker images: `runner-<name>` (e.g., `runner-retroarch`)
- API routes: `packages/dillinger-core/app/api/<resource>/route.ts`

## Environment

- Development container: Debian GNU/Linux 12 (bookworm)
- Host GPU: AMD Radeon (uses Mesa/Vulkan drivers, VA-API encoding)
- Base OS for runners: Arch Linux (pacman package manager)

## Notes for AI Agents

1. **Always run pnpm commands from project root** (`/workspaces/dillinger`)
2. **Docker builds cache aggressively** - use `--no-cache` variants when modifying entrypoint scripts
3. **Runner images inherit from base** - rebuild base first, then dependent images
4. **Wolf config regenerates on container start** - delete config.toml to pick up new encoder settings
5. **Check docs/ folder** for detailed feature documentation
