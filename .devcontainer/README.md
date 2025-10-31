# DevContainer Configuration

This devcontainer is configured for full-featured Dillinger development, including X11 display forwarding for game runners.

## Features

- ✅ Node.js 18+ with pnpm
- ✅ TypeScript with full IDE support
- ✅ Docker-outside-of-Docker (access host Docker daemon)
- ✅ X11 display forwarding for graphical games
- ✅ Hot reload for frontend and backend
- ✅ Shared pnpm store (faster installs)

## Setup

### First Time

1. **On your host machine**, run the setup script:
   ```bash
   cd /mnt/linuxfast/dev/dillinger
   ./setup-x11.sh
   ```

2. **In VSCode**:
   - Open this folder
   - Click "Reopen in Container" when prompted
   - Wait for container to build

3. **Develop!**
   ```bash
   pnpm dev
   ```

### After Reboot

X11 access needs to be re-enabled after each host reboot:

```bash
# On host
cd /mnt/linuxfast/dev/dillinger
./setup-x11.sh
```

Then reopen/restart your devcontainer in VSCode.

## Configuration Details

### Network & IPC

- `--network=host` - Allows game containers to connect to host services
- `--ipc=host` - Enables X11 shared memory

### Mounts

- `pnpm-store` - Cached packages for faster installs
- `/var/run/docker.sock` - Access to host Docker daemon
- `/tmp/.X11-unix` - X11 socket for display forwarding

### Environment Variables

- `DISPLAY` - Forwarded from host for X11
- `PNPM_HOME` - pnpm global directory

## Testing Display Forwarding

```bash
# Inside devcontainer
pnpm dev

# Open browser
# http://localhost:3000/games

# Launch "GUI Test Game"
# An xterm window should appear on your desktop!
```

## Troubleshooting

### "Cannot connect to X11 display"

```bash
# On host (not in container):
./setup-x11.sh

# Then rebuild container:
# F1 → "Dev Containers: Rebuild Container"
```

### "Permission denied" for Docker socket

The `postStartCommand` should fix this automatically. If not:

```bash
# Inside devcontainer
sudo chown root:docker /var/run/docker.sock
```

### Ports already in use

Check if services are running outside the container:

```bash
# On host
sudo lsof -i :3000  # Frontend
sudo lsof -i :3001  # Backend
```

## VS Code Extensions

The devcontainer doesn't pre-install extensions to keep it lightweight. Install as needed:

- ESLint
- Prettier
- TypeScript and JavaScript Language Features (built-in)
- Docker (optional)

## Performance

### Filesystem

The workspace is bind-mounted from host, so file operations use host filesystem performance. This is fast on Linux hosts.

### pnpm Store

A Docker volume is used for the pnpm store, providing fast package installation that persists across container rebuilds.

## Architecture

```
Host Machine (Arch Linux)
├── X11 Server (:0)
├── Docker Daemon
└── /mnt/linuxfast/dev/dillinger (project files)
    ↓
DevContainer (VS Code)
├── Node.js + pnpm
├── TypeScript compiler
├── Docker CLI → Host Docker Daemon
└── DISPLAY=:0, /tmp/.X11-unix mounted
    ↓
Game Containers (launched by Dillinger)
├── Game executables
├── X11 client
└── Connects to Host X11 via /tmp/.X11-unix
    ↓
Your Desktop (Host X11 Server)
└── Game windows appear here! ✓
```

## Notes

- This configuration requires a Linux host (tested on Arch Linux)
- Windows/Mac hosts would need additional X11 server setup (VcXsrv, XQuartz)
- The devcontainer uses Docker-outside-of-Docker, not Docker-in-Docker
- All containers run on the host Docker daemon, not nested
