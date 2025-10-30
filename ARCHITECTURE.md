# Dillinger Architecture Simplification

## Overview

This document describes the simplified runner architecture implemented to streamline the Dillinger gaming platform.

## Previous Architecture (Removed)

The previous design had:
- `apps/dillinger-runner` - An Express.js API service for managing game sessions
- `packages/runner` - Duplicate API service functionality
- Complex inter-service communication
- API endpoints for launching and managing games

**Issues with this approach:**
- Unnecessary complexity with API layers
- Duplicate code between apps and packages
- Game execution required API calls and session management
- Tightly coupled services

## New Architecture (Current)

The new simplified design treats runners as **Docker container images** that directly execute games:

### Core Concept

A **runner** is now simply a Docker image configured to:
1. Mount a volume pointing to a game installation or ROM directory
2. Lock onto that volume for the session
3. Execute the necessary commands to run the game

### Structure

```
packages/runner-images/
├── README.md                   # Documentation for all runners
├── linux-native/              # Native Linux game runner
│   ├── Dockerfile
│   ├── entrypoint.sh
│   ├── test-game.sh
│   ├── build.sh
│   └── README.md
└── wine-proton/              # Windows game runner (future)
    └── ...
```

### Benefits

1. **Simplicity** - No API layer needed, just Docker containers
2. **Flexibility** - Easy to add new runner types (emulators, platforms)
3. **Isolation** - Each game runs in its own isolated container
4. **Scalability** - Can launch multiple game sessions independently
5. **Maintainability** - Each runner is self-contained

## Runner Types

### Linux Native Runner

**Location:** `packages/runner-images/linux-native/`

**Purpose:** Run native Linux games and applications

**Features:**
- X11 and Wayland display support
- PulseAudio for audio
- OpenGL and Vulkan graphics acceleration
- SDL2 for gamepad/controller input
- Pre-installed gaming libraries

**Usage Example:**
```bash
docker run -it --rm \
  -v /path/to/game:/game:ro \
  -v /path/to/saves:/saves:rw \
  -e GAME_EXECUTABLE="/game/start.sh" \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  --device /dev/dri \
  --device /dev/snd \
  dillinger/runner-linux-native:latest
```

### Future Runners

Planned runner images:
- **Wine/Proton** - Windows games via compatibility layer
- **RetroArch** - Multi-system emulation
- **DOSBox** - DOS games
- **ScummVM** - Classic adventure games
- **UAE** - Amiga emulation
- **PCSX2** - PlayStation 2
- **Dolphin** - GameCube/Wii

## How Game Sessions Work

### 1. Game Library Management

The `dillinger-core` backend manages:
- Game metadata and installation locations
- Platform detection
- Save file management
- User game libraries

### 2. Launching a Game

When a user wants to play a game:

1. **Frontend** → User clicks "Play" on a game
2. **Backend** → Determines game type and required runner
3. **Docker** → Backend launches appropriate runner container with:
   - Game directory mounted at `/game`
   - Save directory mounted at `/saves`
   - Required environment variables
   - Device access (GPU, audio, etc.)
4. **Runner** → Container executes the game
5. **Cleanup** → Container stops when game exits

### 3. Example Flow

```javascript
// Backend code example (pseudocode)
async function launchGame(gameId, userId) {
  const game = await getGame(gameId);
  const runnerImage = getRunnerForPlatform(game.platform);
  
  // Launch Docker container
  await docker.run(runnerImage, {
    volumes: {
      [game.installPath]: '/game:ro',
      [game.savePath]: '/saves:rw'
    },
    env: {
      GAME_EXECUTABLE: game.executable,
      GAME_ARGS: game.launchArgs
    },
    devices: ['/dev/dri', '/dev/snd']
  });
}
```

## Migration Notes

### Removed Components

- ✅ `apps/dillinger-runner/` - Express API service (deleted)
- ✅ `packages/runner/` - Duplicate API service (deleted)
- ✅ `docker-compose.runner.yml` - Old runner API compose file (archived)
- ✅ Runner API endpoints from backend

### Retained Components

- ✅ `packages/runner-types/` - TypeScript types for game metadata
- ✅ `packages/validation/` - Input validation schemas
- ✅ `docker/runner/` - Old Dockerfile (can be refactored or removed)

### New Components

- ✅ `packages/runner-images/` - All runner Docker images
- ✅ `docker-compose.runners.yml` - Example runner usage

## Testing

### Test the Linux Native Runner

1. **Build the image:**
   ```bash
   cd packages/runner-images/linux-native
   ./build.sh
   ```

2. **Run the test game:**
   ```bash
   docker run -it --rm \
     -e GAME_EXECUTABLE=/usr/local/bin/test-game.sh \
     -v $(pwd)/test-saves:/saves:rw \
     dillinger/runner-linux-native:latest
   ```

3. **Run with Docker Compose:**
   ```bash
   docker-compose -f docker-compose.runners.yml up linux-runner-test
   ```

## Next Steps

1. **Backend Integration**
   - Update backend to launch Docker containers directly
   - Remove old runner API client code
   - Implement Docker socket integration

2. **Additional Runners**
   - Implement Wine/Proton runner
   - Add RetroArch for emulation
   - Create specialized runners as needed

3. **Streaming Support**
   - Integrate Wolf streaming library for remote play
   - Add WebRTC support for browser-based gaming
   - Implement session management

4. **Documentation**
   - Add runner developer guide
   - Document environment variables for each runner
   - Create troubleshooting guides

## References

- [Docker SDK for Node.js](https://github.com/apocas/dockerode)
- [Wolf Streaming](https://github.com/games-on-whales/wolf)
- [Wine Project](https://www.winehq.org/)
- [Proton](https://github.com/ValveSoftware/Proton)
