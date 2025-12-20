# Dillinger Scripts

Quick reference for shell scripts in the project root.

## Active Scripts

### `start-dev.sh`
**Purpose:** Start the development environment  
**What it does:**
- Starts backend API on port 3011
- Starts frontend on port 3010
- Checks for port conflicts
- Installs dependencies if needed

**Usage:**
```bash
./start-dev.sh
```

**Services:**
- Backend: http://localhost:3011/api/health
- Frontend: http://localhost:3010

---

### `test-system.sh`
**Purpose:** Complete system test with runner containers  
**What it does:**
- Builds the Linux native runner image
- Starts backend API
- Launches a test runner container
- Provides interactive options to test runners

**Usage:**
```bash
./test-system.sh
```

**Interactive Options:**
1. Stop runner container
2. View runner logs
3. Run interactive test game
4. Keep everything running
5. Stop all services

---

### `test-runner.sh`
**Purpose:** Quick test of Linux native runner  
**What it does:**
- Builds the runner image
- Launches the included test game
- Verifies save file persistence

**Usage:**
```bash
./test-runner.sh
```

---

### `build-docker.sh`
**Purpose:** Build the production Docker image  
**What it does:**
- Builds `thrane20/dillinger:1.0` image
- Creates production-ready container

**Usage:**
```bash
./build-docker.sh
```

## Archived Scripts (*.old)

These scripts reference the old runner API architecture and are kept for reference:

- `test-end-to-end.sh.old` - Old end-to-end test with runner API
- `test-runner-only.sh.old` - Old runner API service test
- `validate-implementation.sh.old` - Old implementation validator

**Note:** These scripts will not work with the new simplified architecture.

## Development Workflow

### Starting Development

```bash
# Install dependencies
pnpm install

# Start dev servers
./start-dev.sh

# In another terminal, test runner containers
./test-system.sh
```

### Testing Runners

```bash
# Quick test
./test-runner.sh

# Full system test
./test-system.sh
```

### Building for Production

```bash
# Build production image
./build-docker.sh

# Run with Docker Compose
docker-compose up -d
```

## Architecture Notes

**New Architecture (Current):**
- Frontend + Backend = Core webapp
- Runners = Docker container images (not API services)
- Games launch directly in containers

**Old Architecture (Removed):**
- Frontend + Backend + Runner API = Three services
- Runner API managed game sessions via HTTP
- More complex, tightly coupled

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full details.

## Troubleshooting

### Port Already in Use

```bash
# Check what's using the port
lsof -i :3010
lsof -i :3011

# Kill the process
kill -9 <PID>
```

### Runner Container Won't Start

```bash
# Check Docker is running
docker ps

# View runner logs
docker logs <container-id>

# Rebuild runner image
cd packages/runner-images/linux-native
./build.sh
```

### Dependencies Out of Date

```bash
# Reinstall everything
pnpm clean
pnpm install
pnpm build
```

## Quick Reference

| Command | Purpose |
|---------|---------|
| `./start-dev.sh` | Start webapp (frontend + backend) |
| `./test-system.sh` | Full system test with runners |
| `./test-runner.sh` | Quick runner test |
| `./build-docker.sh` | Build production image |
| `pnpm build` | Build all TypeScript packages |
| `pnpm test` | Run all tests |
