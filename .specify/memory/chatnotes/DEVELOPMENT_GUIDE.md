# Dillinger Development Guide

Complete guide for developing Dillinger locally with support for display forwarding.

## Quick Start

### DevContainer with Display Forwarding (Recommended)

```bash
# On your Arch Linux host (one-time after each reboot):
cd /mnt/linuxfast/dev/dillinger
./setup-x11.sh

# Then in VSCode:
# 1. F1 → "Dev Containers: Rebuild Container" (first time only)
# 2. Wait for rebuild
# 3. Terminal in devcontainer:
pnpm dev

# Open http://localhost:3010/games
# Launch GUI Test Game → window appears! ✓
```

### Alternative: Direct Host Development

If you prefer not to use devcontainers:

```bash
# Work normally in VSCode devcontainer
# Display forwarding won't work, but everything else does
# See DEVCONTAINER_X11_LIMITATION.md for why
```

---

## Development Environments

### Environment 1: DevContainer (Default) ✅ Recommended

**What it's good for:**
- ✅ Writing code with full TypeScript/ESLint support
- ✅ Running tests
- ✅ Building packages
- ✅ Git operations
- ✅ API development
- ✅ **Testing display forwarding (X11/Wayland)** ← Now works!

**Setup (one-time):**

```bash
# On host (Arch Linux):
cd /mnt/linuxfast/dev/dillinger
./setup-x11.sh

# In VSCode:
# F1 → "Dev Containers: Rebuild Container"
```

**How to use:**
1. Open project in VSCode
2. VSCode will prompt to "Reopen in Container" → Click it
3. Wait for container to build (first time only)
4. Run `pnpm dev` in devcontainer terminal
5. Open http://localhost:3010/games
6. Launch games - windows appear on your desktop! ✓

**Note:** Run `./setup-x11.sh` on host after each reboot to re-enable X11 access.

---

### Environment 2: Host Development (For Display Testing)

**What it's good for:**
- ✅ Everything in DevContainer
- ✅ Testing display forwarding (X11/Wayland)
- ✅ Launching graphical games
- ✅ Full integration testing

**Prerequisites (One-time install):**

```bash
# Arch Linux
sudo pacman -S nodejs npm pnpm docker xorg-xhost

# Ubuntu/Debian
sudo apt install nodejs npm docker.io x11-xserver-utils
sudo npm install -g pnpm

# Verify
node --version   # 18 or higher
pnpm --version   # 8 or higher
```

**Setup:**

```bash
cd /mnt/linuxfast/dev/dillinger

# Install dependencies
pnpm install

# Build shared packages
pnpm run build:shared

# Build Docker runner images
cd packages/runner-images/linux-native
./build.sh
cd ../../..

# Build backend
cd packages/dillinger-core/backend
pnpm build
cd ../../..
```

**Daily workflow:**

```bash
# Terminal 1: Start dev servers
cd /mnt/linuxfast/dev/dillinger

# Enable X11 (required after each reboot)
xhost +local:docker

# Set paths
export HOST_WORKSPACE_PATH=/mnt/linuxfast/dev/dillinger
export DILLINGER_ROOT=$(pwd)/packages/dillinger-core/backend/data

# Start development
pnpm dev

# You'll see:
# packages/dillinger-core dev: backend dev: 🚀 Dillinger API server running on port 3011
# packages/dillinger-core dev: frontend dev: ▲ Next.js 14.0.0 - Local: http://localhost:3010
```

**Edit code:**
- Option A: VSCode on host: `code /mnt/linuxfast/dev/dillinger`
- Option B: Any editor (vim, nano, etc.)
- Option C: Still use devcontainer for editing, files are shared!

**Test display forwarding:**
- Open browser: http://localhost:3010/games
- Click "Launch" on GUI Test Game
- X11 window appears on your desktop! 🎮

---

### Environment 3: Hybrid (Best of Both)

**The optimal workflow for most developers:**

```bash
# 1. CODE in DevContainer
#    - Open VSCode
#    - Work in devcontainer
#    - Full IDE features
#    - Edit TypeScript with autocomplete
#    - Git integration works
#    - Terminal for builds/tests

# 2. TEST display forwarding on Host
#    - Open terminal on HOST machine
#    - cd /mnt/linuxfast/dev/dillinger
#    - xhost +local:docker
#    - pnpm dev
#    - Test in browser
#    - Windows appear on desktop

# 3. FILES ARE SHARED
#    - Changes in devcontainer appear on host immediately
#    - No copying needed
#    - Edit in devcontainer, test on host seamlessly
```

**Example session:**

```bash
# VSCode devcontainer terminal:
git checkout -b feature/new-game-launcher
# Edit src/services/docker-service.ts
# TypeScript autocomplete works perfectly
git add .
git commit -m "Add new launcher feature"

# Host terminal (different terminal window):
cd /mnt/linuxfast/dev/dillinger
xhost +local:docker
pnpm dev
# Open browser, test the new feature
# GUI windows work!

# Back to devcontainer:
# Continue coding, hot reload works
```

---

## Project Structure

```
dillinger/
├── packages/
│   ├── dillinger-core/
│   │   ├── backend/          # Express API server
│   │   │   ├── src/
│   │   │   │   ├── api/      # API routes
│   │   │   │   ├── services/ # Business logic
│   │   │   │   └── index.ts  # Entry point
│   │   │   └── data/         # Game files & metadata
│   │   │       ├── games/    # Game directories
│   │   │       └── storage/  # JSON metadata
│   │   └── frontend/         # Next.js app
│   │       └── app/
│   │           └── games/    # Games UI
│   ├── runner-images/        # Docker images for runners
│   │   └── linux-native/     # Native Linux runner
│   ├── runner-types/         # TypeScript types for runners
│   ├── shared/               # Shared types & utilities
│   └── validation/           # Validation schemas
├── .devcontainer/            # DevContainer configuration
├── specs/                    # Feature specifications
└── docs/                     # Documentation
```

---

## Common Commands

### Development

```bash
# Start everything (monorepo)
pnpm dev

# Start specific packages
pnpm --filter @dillinger/backend dev
pnpm --filter @dillinger/frontend dev

# Build everything
pnpm run build:all

# Build specific packages
pnpm --filter @dillinger/shared build
pnpm --filter @dillinger/backend build
```

### Docker

```bash
# Build runner image
cd packages/runner-images/linux-native
./build.sh

# Or with docker directly
docker build -t dillinger/runner-linux-native:latest .

# Test runner
docker run --rm \
  -e DISPLAY=$DISPLAY \
  -e GAME_EXECUTABLE=/usr/bin/xeyes \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  --ipc=host \
  dillinger/runner-linux-native:latest
```

### Testing

```bash
# Run tests
pnpm test

# Test display forwarding manually
./test-display.sh

# Test game launch end-to-end
./test-game-launch.sh
```

---

## Port Reference

| Port | Service | Description |
|------|---------|-------------|
| 3010 | Frontend | Next.js development server |
| 3011 | Backend | Express API server |
| 3002 | Legacy Runner | Old runner API (deprecated) |
| 3003 | Runner | New runner API |
| 8080 | Streaming | WebRTC/GStreamer (future) |

---

## Display Forwarding Setup

### X11 (Most Linux Distributions)

```bash
# Check if X11 is running
echo $DISPLAY  # Should show :0 or :1

# Allow Docker containers to connect
xhost +local:docker

# Verify X11 socket exists
ls -la /tmp/.X11-unix/

# Test connection
docker run --rm \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  --ipc=host \
  dillinger/runner-linux-native:latest \
  /usr/bin/xeyes
```

### Wayland (GNOME, Sway, etc.)

```bash
# Check if Wayland is running
echo $WAYLAND_DISPLAY  # Should show wayland-0

# Wayland socket location
ls $XDG_RUNTIME_DIR/$WAYLAND_DISPLAY

# Note: Many apps still use XWayland
echo $DISPLAY  # May still show :0 for X11 compatibility
```

**Tip:** Dillinger prefers X11 when both are available for maximum game compatibility.

---

## Troubleshooting

### "Cannot connect to X11 display"

```bash
# Solution 1: Enable xhost
xhost +local:docker

# Solution 2: Check DISPLAY is set
echo $DISPLAY

# Solution 3: Verify X11 socket permissions
ls -la /tmp/.X11-unix/
# Should show X0 with read/write permissions
```

### "Error: Failed to launch game"

```bash
# Check Docker daemon is running
docker ps

# Check runner image exists
docker images | grep dillinger/runner-linux-native

# Rebuild runner if needed
cd packages/runner-images/linux-native && ./build.sh
```

### "Module not found" errors

```bash
# Reinstall dependencies
pnpm install

# Rebuild shared packages
pnpm run build:shared

# Clear build cache
rm -rf packages/*/dist
pnpm run build:all
```

### Port already in use

```bash
# Find what's using the port
sudo lsof -i :3010  # or :3011

# Kill the process
kill -9 <PID>

# Or use different ports
PORT=4000 pnpm dev
```

---

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes, commit often
git add .
git commit -m "Add feature X"

# Push to remote
git push origin feature/my-feature

# Create PR on GitHub
```

---

## Environment Variables

### Development (`.env` or export)

```bash
# Backend
PORT=3011                              # API server port
NODE_ENV=development                   # Environment
DILLINGER_ROOT=./data                  # Game data directory
HOST_WORKSPACE_PATH=/path/to/workspace # For devcontainer

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3011

# Docker
DISPLAY=:0                             # X11 display
XAUTHORITY=/home/user/.Xauthority      # X11 auth (optional)
```

### Production

```bash
NODE_ENV=production
DILLINGER_ROOT=/var/lib/dillinger/data
HOST_WORKSPACE_PATH=<not needed in production>
```

---

## CI/CD

GitHub Actions automatically:
- ✅ Runs tests on PRs
- ✅ Builds Docker images
- ✅ Type checks TypeScript
- ✅ Lints code

See `.github/workflows/` for configuration.

---

## Resources

- **Architecture:** `ARCHITECTURE.md`
- **Display Forwarding:** `DISPLAY_FORWARDING.md`
- **DevContainer Limitation:** `DEVCONTAINER_X11_LIMITATION.md`
- **Feature Specs:** `specs/`
- **API Documentation:** Backend OpenAPI at `/api/docs` (when implemented)

---

## Need Help?

1. Check existing documentation in repo root
2. Review error logs in terminal
3. Check Docker logs: `docker logs <container-id>`
4. Verify prerequisites are installed
5. Try hybrid workflow (code in devcontainer, test on host)

---

## Summary

**For daily coding:** Use devcontainer (VSCode)  
**For testing display forwarding:** Run `pnpm dev` on host  
**Best workflow:** Code in devcontainer + test on host when needed  
**Files are shared:** Edit anywhere, changes are immediate  
**X11 setup:** `xhost +local:docker` before testing graphics  
