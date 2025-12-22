# Publishing Dillinger Images to GitHub Container Registry (ghcr.io)

This document explains how to build and publish Dillinger images to GitHub Container Registry.

## Overview

All images are published to `ghcr.io/thrane20/` (Gaming On Linux):

```
ghcr.io/thrane20/dillinger/core:latest              # Main application
ghcr.io/thrane20/dillinger/runner-{name}:latest     # Runner images
```

### Available Images

| Image | Description |
|-------|-------------|
| `core` | Main Dillinger application (Next.js) |
| `runner-base` | Core infrastructure (X11, GPU drivers, audio) |
| `runner-wine` | Windows games via Wine |
| `runner-vice` | Commodore 64/128/VIC-20/Plus4/PET |
| `runner-retroarch` | Multi-system emulation |
| `runner-fs-uae` | Amiga emulation |
| `runner-mame` | Standalone MAME arcade |
| `runner-linux-native` | Native Linux games |

## Quick Start (End Users)

```bash
# Pull and run the core application
docker pull ghcr.io/thrane20/dillinger/core:latest
docker run -d \
  --name dillinger \
  -p 3010:3010 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v dillinger_data:/data \
  ghcr.io/thrane20/dillinger/core:latest

# The app will guide you to download runners as needed
# Or pull them manually:
docker pull ghcr.io/thrane20/dillinger/runner-wine:latest
```

## Automatic Publishing (GitHub Actions)

The workflow at `.github/workflows/publish-runners.yml` automatically builds and publishes images when:

1. **Push to main**: Changes to `packages/dillinger-core/`, `packages/shared/`, or `packages/runner-images/` trigger a rebuild
2. **Release**: Creating a GitHub release publishes tagged images
3. **Manual**: Use "Actions" → "Build & Publish Docker Images" → "Run workflow"

### Manual Workflow Options

- `all` - Build everything (core + all runners)
- `core` - Build only the core application
- `runners` - Build all runner images
- `base`, `wine`, `vice`, etc. - Build specific runner

### Required Setup

1. **Repository Settings**
   - Go to your GitHub repository
   - Navigate to Settings → Actions → General
   - Under "Workflow permissions", select **"Read and write permissions"**
   - Check "Allow GitHub Actions to create and approve pull requests"

2. **Package Visibility** (Optional - for public access)
   - After first publish, go to your profile → "Packages"
   - Find each `runner-*` package
   - Click package → "Package settings" → "Change visibility" → "Public"

No secrets are needed - `GITHUB_TOKEN` is automatically available.

## Manual Publishing (Local Build)

For local development or debugging:

### 1. Login to ghcr.io

```bash
# Create a Personal Access Token (PAT) with `write:packages` scope at:
# https://github.com/settings/tokens/new

# Option A: Login with token from .env file
# If you have a .env file with GITHUB_TOKEN=ghp_xxx...
source .env && echo "$GITHUB_TOKEN" | docker login ghcr.io -u YOUR_USERNAME --password-stdin

# Option B: Login manually
echo "YOUR_PAT_HERE" | docker login ghcr.io -u YOUR_USERNAME --password-stdin
```

### 2. Build Images

```bash
cd packages/runner-images

# Build base first (required by all others)
docker build -t ghcr.io/thrane20/dillinger/runner-base:latest ./base

# Build other images (pass base as build arg if needed)
docker build -t ghcr.io/thrane20/dillinger/runner-wine:latest \
  --build-arg BASE_IMAGE=ghcr.io/thrane20/dillinger/runner-base:latest \
  ./wine

docker build -t ghcr.io/thrane20/dillinger/runner-vice:latest \
  --build-arg BASE_IMAGE=ghcr.io/thrane20/dillinger/runner-base:latest \
  ./vice

# Repeat for other runners...
```

### 3. Push Images

```bash
docker push ghcr.io/thrane20/dillinger/runner-base:latest
docker push ghcr.io/thrane20/dillinger/runner-wine:latest
docker push ghcr.io/thrane20/dillinger/runner-vice:latest
# etc...
```

## Local Building

### Core Application

```bash
# Build core locally
pnpm docker:build:core

# Push to ghcr.io (requires login)
pnpm docker:push:core

# Or using docker directly
docker build -t ghcr.io/thrane20/dillinger/core:latest -f packages/dillinger-core/Dockerfile .
docker push ghcr.io/thrane20/dillinger/core:latest
```

### Runner Images

Use the build script in `packages/runner-images/`:

```bash
cd packages/runner-images

# Build all images locally
./build.sh all

# Build specific runner
./build.sh wine

# Build and push (requires login)
./build.sh --push all
./build.sh --push wine
```

## Tagging Strategy

- `latest` - Most recent build from main branch
- `0.1.0`, `0.2.0`, etc. - Specific versions from [versioning.env](../versioning.env)

## Versioning

All image versions are tracked in `versioning.env` at the project root:

```bash
# View current versions
pnpm publish:versions
```

To bump a version, edit `versioning.env` and commit the change before publishing.

## Publishing Commands

### Quick Reference

```bash
# Show current versions
pnpm publish:versions

# Publish everything (must be built first)
pnpm publish:all

# Build and publish everything
pnpm publish:all:build

# Publish just core
pnpm publish:core
pnpm publish:core:build      # Build first, then publish

# Publish all runners
pnpm publish:runners
pnpm publish:runners:build

# Publish individual runners
pnpm publish:wine
pnpm publish:wine:build
pnpm publish:vice:build
pnpm publish:retroarch:build
pnpm publish:fs-uae:build
pnpm publish:mame:build
pnpm publish:linux-native:build
```

Each publish command pushes both the version tag (e.g., `0.1.0`) and `latest`.

## Troubleshooting

### "denied: permission_denied"

- Ensure workflow permissions are set to "Read and write"
- For manual pushes, ensure your PAT has `write:packages` scope

### "unauthorized: authentication required"

```bash
# Re-login to ghcr.io
docker logout ghcr.io
echo "YOUR_PAT" | docker login ghcr.io -u YOUR_USERNAME --password-stdin
```

### Image not appearing in UI

After first push, packages may take a few minutes to appear. Check:
- Profile → Packages (for user repos)
- Organization → Packages (for org repos)

### Runner build fails with "base image not found"

Ensure base image is built/pulled first:
```bash
# Pull from registry
docker pull ghcr.io/thrane20/dillinger/runner-base:latest

# Or build locally
cd packages/runner-images
./build.sh base
```

## Integration with Dillinger App

The platforms page (`/platforms`) automatically:

1. Lists all runner images with their ghcr.io URLs
2. Checks if each image is installed locally
3. Allows downloading images with progress tracking
4. Supports removing unused images

The API endpoints:
- `GET /api/runners` - List all runners with install status
- `POST /api/runners/{id}/pull` - Download with SSE progress
- `DELETE /api/runners/{id}/pull` - Remove image
