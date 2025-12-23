# Docker Build Progress Features

## Overview

All Dillinger runner builds now use **Docker Buildx** with enhanced progress output and performance features.

## Key Features

### 1. Docker Buildx Integration
- ✅ **Enabled**: All build scripts now use `DOCKER_BUILDKIT=1 docker buildx build`
- ✅ **Better Caching**: BuildKit provides improved layer caching
- ✅ **Faster Builds**: Parallel execution of independent build steps
- ✅ **Load Flag**: `--load` ensures images are available to local Docker daemon

### 2. Progress Modes

Control build output verbosity with the `DOCKER_PROGRESS` environment variable:

| Mode | Description | Use Case |
|------|-------------|----------|
| `plain` | Verbose output with all build steps | **Default** - Best for debugging and seeing detailed progress |
| `tty` | Compact progress bars | Clean output, less terminal scrolling |
| `auto` | Automatically choose based on terminal | Let Docker decide |

**Examples:**

```bash
# Verbose output (default)
./build.sh base
pnpm docker:build:base

# Compact progress bars
DOCKER_PROGRESS=tty ./build.sh base
DOCKER_PROGRESS=tty pnpm docker:build:base

# Auto-detect
DOCKER_PROGRESS=auto ./build.sh all
```

### 3. Build Timing

All builds now display:
- Start time (implicit)
- End time (implicit)
- Total duration in minutes and seconds

**Example output:**
```
✓ Build complete: ghcr.io/thrane20/dillinger/runner-base:0.1.0 (3m 24s)
✓ Tagged as: ghcr.io/thrane20/dillinger/runner-base:0.1.0
✓ Also tagged as: ghcr.io/thrane20/dillinger/runner-base:latest
```

### 4. Network Performance

All builds use `--network=host` to:
- Bypass Docker's bridge network isolation
- Provide direct access to host network stack
- Speed up package downloads (especially for Arch Linux pacman)
- Fix hanging downloads from package mirrors

## Usage Examples

### Basic Builds

```bash
# Build base with default verbose output
pnpm docker:build:base

# Build retroarch with compact progress
DOCKER_PROGRESS=tty pnpm docker:build:retroarch

# Build all with auto-detect
DOCKER_PROGRESS=auto pnpm docker:build:all
```

### Individual Build Scripts

```bash
cd packages/runner-images

# Base image
./build.sh base
DOCKER_PROGRESS=tty ./build.sh base --no-cache

# Specific runner
cd wine
./build.sh
DOCKER_PROGRESS=tty ./build.sh --no-cache
```

### Main Build Script

```bash
cd packages/runner-images

# Build all with timing
./build.sh all

# Build specific runners
./build.sh wine vice retroarch

# With compact progress
DOCKER_PROGRESS=tty ./build.sh all
```

## Progress Mode Comparison

### Plain Mode (Default)

```
#1 [internal] load build definition from Dockerfile
#1 transferring dockerfile: 32B done
#1 DONE 0.0s

#2 [internal] load .dockerignore
#2 transferring context: 2B done
#2 DONE 0.0s

#3 [internal] load metadata for ghcr.io/thrane20/dillinger/runner-base:latest
#3 DONE 0.0s

#4 [1/5] FROM ghcr.io/thrane20/dillinger/runner-base:latest
#4 CACHED

#5 [2/5] RUN pacman -Sy && timeout 600 yes | pacman -S --noconfirm...
#5 0.234 :: Synchronizing package databases...
#5 1.456  core                    130.2 KiB  1234 KiB/s 00:00 [###] 100%
...
```

**Pros:**
- See every step and its timing
- Easy to identify which layer is slow
- Best for debugging hanging builds
- Full visibility into cache hits

**Cons:**
- Lots of terminal scrolling
- Can be overwhelming for quick builds

### TTY Mode

```
[+] Building 45.2s (12/12) FINISHED
 => [internal] load build definition                          0.0s
 => => transferring dockerfile                                0.0s
 => [internal] load .dockerignore                             0.0s
 => [1/5] FROM ghcr.io/thrane20/dillinger/runner-base         0.0s
 => [2/5] RUN pacman -Sy && timeout 600 yes | pacman -S...   44.5s
 => [3/5] COPY retroarch-entrypoint.sh /entrypoint.sh          0.1s
 => exporting to image                                         0.5s
```

**Pros:**
- Clean, compact output
- Progress bars show % complete
- Less terminal clutter
- Real-time updates

**Cons:**
- Less detail about individual steps
- Harder to see exactly where build might be stuck

## BuildKit Cache Management

```bash
# Show cache usage
docker buildx du

# Prune old cache
docker buildx prune

# Prune with filter
docker buildx prune --filter until=24h

# Force full rebuild (bypasses cache)
./build.sh base --no-cache
```

## Technical Details

### Changes Made

All build scripts now include:

1. **BuildKit Environment Variable**
   ```bash
   DOCKER_BUILDKIT=1
   ```

2. **Buildx Command**
   ```bash
   docker buildx build --load ...
   ```

3. **Progress Mode Support**
   ```bash
   PROGRESS_MODE="${DOCKER_PROGRESS:-plain}"
   --progress="${PROGRESS_MODE}"
   ```

4. **Build Timing**
   ```bash
   BUILD_START=$(date +%s)
   # ... build command ...
   BUILD_END=$(date +%s)
   BUILD_DURATION=$((BUILD_END - BUILD_START))
   MINUTES=$((BUILD_DURATION / 60))
   SECONDS=$((BUILD_DURATION % 60))
   ```

5. **Network Performance**
   ```bash
   --network=host
   ```

### Affected Files

- ✅ `packages/runner-images/base/build.sh`
- ✅ `packages/runner-images/wine/build.sh`
- ✅ `packages/runner-images/vice/build.sh`
- ✅ `packages/runner-images/retroarch/build.sh`
- ✅ `packages/runner-images/fs-uae/build.sh`
- ✅ `packages/runner-images/linux-native/build.sh`
- ✅ `packages/runner-images/build.sh` (main orchestrator)

## Benefits

1. **Better Performance**: BuildKit's improved caching and parallel execution
2. **Visibility**: Choose between verbose and compact output
3. **Debugging**: Plain mode shows exactly which step is slow/stuck
4. **Productivity**: Build timing helps track performance over time
5. **Network Speed**: Host networking bypasses Docker bridge overhead
6. **Consistency**: Same features across all runner builds

## Recommendations

### For Development
- Use **plain** mode (default) for detailed visibility
- Helps identify slow layers or hanging downloads
- Easy to see cache hits/misses

### For CI/CD
- Use **auto** mode to let Docker choose appropriate output
- GitHubActions will use plain mode automatically
- Local terminals may use tty mode

### For Production Builds
- Use **tty** mode for clean output
- Add `--no-cache` for reproducible builds
- Monitor build times to detect performance regressions

## Troubleshooting

### Build hangs during package download
- Check: Is `--network=host` present in build command?
- Try: `DOCKER_PROGRESS=plain ./build.sh base` to see exactly where it's stuck
- Verify: Internet connection and DNS resolution

### Build slower than expected
- Check cache: `docker buildx du`
- Try: `--no-cache` flag to rule out cache corruption
- Monitor: Network speed during package downloads

### Can't see progress
- Set: `DOCKER_PROGRESS=plain` for verbose output
- Check: Terminal supports ANSI colors (tty mode)
- Verify: BuildKit is enabled (`docker buildx version`)

### Build succeeds but image not found
- Ensure: `--load` flag is present in buildx command
- Check: `docker images | grep runner-` to verify image loaded
- Note: Without `--load`, image stays in BuildKit cache only
