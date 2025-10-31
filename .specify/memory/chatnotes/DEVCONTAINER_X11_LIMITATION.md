# DevContainer X11 Display Forwarding

## ✅ Fixed! Display Forwarding Now Works in DevContainer

As of the latest update, display forwarding (X11) **now works from within the devcontainer**.

### Quick Setup

**On your host (Arch Linux) - ONE TIME AFTER EACH REBOOT:**

```bash
cd /mnt/linuxfast/dev/dillinger
./setup-x11.sh
```

**Then in VSCode:**

1. `F1` → "Dev Containers: Rebuild Container" (first time only)
2. Wait for rebuild to complete
3. Run `pnpm dev`
4. Open http://localhost:3000/games
5. Launch GUI Test Game → window appears on your desktop! ✓

### What Changed

The devcontainer now includes:

1. **`--network=host`** - Game containers can reach host's X11 server
2. **`--ipc=host`** - Shared memory for X11 (required)
3. **X11 socket mount** - `/tmp/.X11-unix` mounted into devcontainer
4. **DISPLAY environment** - Automatically passed from host

See `.devcontainer/devcontainer.json` for the full configuration.

---

## Original Issue (Now Resolved)

~~Display forwarding (X11/Wayland) for game runners **does not work from within the devcontainer** due to X11 authorization issues.~~

**Status:** ✅ RESOLVED

### Why It Previously Failed

When running in a devcontainer, there are **3 layers of containerization**:

```
Host (Arch Linux with X11)
  ↓
DevContainer (VSCode development environment)
  ↓
Game Container (launched by Dillinger)
```

The game container needs to connect to the host's X11 server, but:
1. The devcontainer forwards X11 from host (works for devcontainer apps)
2. Game containers launched from devcontainer cannot authenticate to host X11 server
3. X11 authorization cookies (`.Xauthority`) are not properly shared

### Error Symptoms

```
Authorization required, but no authorization protocol specified
Error: Can't open display: :0
```

Container logs show X11 connection failures even though `DISPLAY` is set correctly.

## Solution

### For Development: Two Workflows

#### Workflow 1: Code in DevContainer, Test on Host (Recommended)

**Best for:** Day-to-day development when you don't need to test display forwarding

```bash
# 1. Code in VSCode devcontainer (normal development)
#    - Edit code in devcontainer
#    - pnpm dev runs in devcontainer
#    - Test non-graphical features

# 2. When you need to test display forwarding:
#    Exit devcontainer, run on host
```

#### Workflow 2: Hybrid Development (Flexible)

**Best for:** When actively working on display forwarding features

Run dev servers on host, use VSCode Remote SSH to edit:

```bash
# On your host (Arch Linux):
cd /mnt/linuxfast/dev/dillinger

# Allow Docker X11 access (one time per boot)
xhost +local:docker

# Run development servers
pnpm dev
# This starts:
# - Backend on port 3001
# - Frontend on port 3000
# - TypeScript watch compilation

# Open browser to http://localhost:3000/games
# Launch games - X11 windows will appear on your desktop!
```

Use VSCode normally to edit files (even from devcontainer if you want), the filesystem is shared.

## Complete Setup Guide

### Prerequisites

Ensure you have the following installed **on your host**:

```bash
# On Arch Linux
sudo pacman -S nodejs npm pnpm docker xorg-xhost

# Verify versions
node --version    # Should be 18+
pnpm --version    # Should be 8+
docker --version
```

### Initial Setup (One Time)

```bash
# 1. Navigate to project on host
cd /mnt/linuxfast/dev/dillinger

# 2. Install dependencies (if not done in devcontainer)
pnpm install

# 3. Build shared packages
pnpm run build:shared

# 4. Build Docker images
cd packages/runner-images/linux-native
./build.sh

# 5. Build backend
cd /mnt/linuxfast/dev/dillinger/packages/dillinger-core/backend
pnpm build
```

### Daily Development Workflow

#### Option A: Full Host Development

```bash
# Terminal 1: On host
cd /mnt/linuxfast/dev/dillinger

# Enable X11 for Docker (required after each reboot)
xhost +local:docker

# Set environment variables
export HOST_WORKSPACE_PATH=/mnt/linuxfast/dev/dillinger
export DILLINGER_ROOT=/mnt/linuxfast/dev/dillinger/packages/dillinger-core/backend/data

# Start dev servers
pnpm dev

# Servers will start:
# - Frontend: http://localhost:3000
# - Backend:  http://localhost:3001
# - TypeScript watch: rebuilds on changes
```

Open browser and test display forwarding! Windows will appear on your desktop.

**Edit code:**
- Use VSCode on host: `code /mnt/linuxfast/dev/dillinger`
- Or use any editor directly on the host
- Hot reload works automatically

#### Option B: Hybrid (Code in DevContainer, Test on Host)

```bash
# 1. Do your coding in VSCode devcontainer
#    - Full TypeScript support
#    - All extensions work
#    - Git integration
#    - Terminal commands work

# 2. When devcontainer changes are made, they're on host filesystem
#    No need to copy files!

# 3. When you need to test display forwarding:

# Terminal on HOST (not devcontainer):
cd /mnt/linuxfast/dev/dillinger
xhost +local:docker
pnpm dev

# Test in browser: http://localhost:3000/games
# Launch GUI Test Game → window appears on desktop

# 4. When done testing, Ctrl+C to stop servers
#    Go back to coding in devcontainer
```

### Running Individual Services

```bash
# On host, if you only need specific services:

# Backend only
cd packages/dillinger-core/backend
pnpm dev

# Frontend only
cd packages/dillinger-core/frontend
pnpm dev

# Build packages in watch mode
pnpm --filter @dillinger/shared dev
pnpm --filter @dillinger/runner-types dev
```

### Docker Runner Testing

Test a game container directly from host:

```bash
# On host:
xhost +local:docker

# Test X11 connection with xeyes
docker run --rm \
  -e DISPLAY=$DISPLAY \
  -e XAUTHORITY= \
  -e GAME_EXECUTABLE=/usr/bin/xeyes \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  --ipc=host \
  --security-opt seccomp=unconfined \
  dillinger/runner-linux-native:latest

# Should see xeyes window appear!
```

## Production Deployment

In production, this limitation **does not exist** because:

1. ✅ Backend runs in a container with direct Docker socket access
2. ✅ No nested devcontainer layer
3. ✅ X11 authorization can be properly configured
4. ✅ Xhost can whitelist specific containers

Production setup will work exactly as designed.

## Alternative: Docker Compose on Host

For a production-like environment on your host:

```bash
# On host:
cd /mnt/linuxfast/dev/dillinger

# Start with docker-compose
docker-compose up

# Services will be available:
# - Frontend: http://localhost:3000
# - Backend: http://localhost:3001

# Display forwarding will work because containers
# are launched by host Docker daemon with proper X11 access
```

## Summary

| Environment | Code Editing | Display Forwarding | Hot Reload | Git | TypeScript |
|-------------|-------------|-------------------|------------|-----|------------|
| **DevContainer** | ✅ Excellent | ❌ Broken | ✅ Yes | ✅ Yes | ✅ Full |
| **Host Direct** | ⚠️ Manual setup | ✅ Works | ✅ Yes | ✅ Yes | ✅ Full |
| **Hybrid** | ✅ In DevContainer | ✅ Test on Host | ✅ Yes | ✅ Yes | ✅ Full |

**Recommendation:** Use **Hybrid workflow** for best of both worlds:
- Code in devcontainer with full IDE support
- Test display forwarding by running `pnpm dev` on host when needed
- Filesystem is shared, so no file copying required

## Technical Details

The display forwarding implementation in `DockerService` is **correct and production-ready**. It properly:
- Detects X11 vs Wayland
- Mounts display sockets
- Configures environment variables
- Handles missing `.Xauthority` gracefully
- Makes GPU device optional

The issue is purely a **devcontainer limitation** for X11 authorization, not a code problem.
