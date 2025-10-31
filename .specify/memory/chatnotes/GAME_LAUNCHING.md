# Game Launching System

## Overview

The Dillinger game launching system uses dynamic Docker volumes to mount game directories and launch games in isolated containers. This document explains how it works.

## Architecture

### DILLINGER_ROOT Environment Variable

`DILLINGER_ROOT` is the base directory for all game data and metadata:

- **Development**: `packages/dillinger-core/backend/data` (default)
- **Production**: Configured by deployment (e.g., `/opt/dillinger`)

Directory structure:
```
$DILLINGER_ROOT/
├── games/                    # Actual game installations
│   ├── test-adventure-game/
│   │   └── start.sh
│   └── my-linux-game/
│       └── game.x86_64
└── storage/                  # Metadata and configuration
    ├── games/               # Game metadata JSON files
    ├── platforms/           # Platform configurations
    ├── sessions/            # Session history
    ├── collections/         # User collections
    └── metadata/            # Cached metadata
```

### Dynamic Volume Management

#### dillinger_current_session Volume

The `dillinger_current_session` volume is a **bind-mounted Docker volume** that points to the currently active game directory. When launching a game:

1. Backend determines the game's directory path (e.g., `games/test-adventure-game`)
2. DockerService removes the old `dillinger_current_session` volume (if exists)
3. DockerService creates a new `dillinger_current_session` volume bound to the game directory
4. Container starts with this volume mounted at `/game`

This approach allows:
- **Single volume name** for all game launches
- **Dynamic switching** between different games
- **Read-only game access** (prevents accidental modification)
- **Separate save directories** per session

## Game Metadata

Each game has a JSON metadata file in `$DILLINGER_ROOT/storage/games/`:

```json
{
  "id": "test-adventure-game",
  "title": "Test Adventure Game",
  "filePath": "games/test-adventure-game",
  "platformId": "linux-native",
  "settings": {
    "launch": {
      "command": "./start.sh",
      "arguments": [],
      "environment": {},
      "workingDirectory": "."
    }
  }
}
```

### Launch Configuration Fields

- **command**: Relative path to the executable from the game directory
- **arguments**: Array of command-line arguments
- **environment**: Key-value pairs for environment variables
- **workingDirectory**: Working directory relative to game directory (default: ".")

## API Endpoints

### Launch a Game

```http
POST /api/games/:id/launch
```

**Response:**
```json
{
  "success": true,
  "session": {
    "id": "uuid-v4-session-id",
    "gameId": "test-adventure-game",
    "status": "running",
    "containerId": "docker-container-id"
  }
}
```

### Stop a Game

```http
POST /api/games/:id/stop
Content-Type: application/json

{
  "sessionId": "uuid-v4-session-id"
}
```

### Get Game Sessions

```http
GET /api/games/:id/sessions
```

Returns all session history for a game.

## Docker Service

The `DockerService` class handles container lifecycle:

### Volume Management

```typescript
await docker.setCurrentSessionVolume('games/test-adventure-game');
```

Creates a bind-mounted volume:
```bash
docker volume create \
  --driver local \
  --opt type=none \
  --opt device=/absolute/path/to/game \
  --opt o=bind \
  dillinger_current_session
```

### Container Launch

```typescript
const containerInfo = await docker.launchGame({
  game,
  platform,
  sessionId
});
```

Creates and starts a container with:
- **Game volume**: `dillinger_current_session:/game:ro` (read-only)
- **Save volume**: `dillinger_saves_{sessionId}:/saves:rw` (read-write)
- **Environment**: `GAME_EXECUTABLE`, `GAME_ARGS`, custom env vars
- **Auto-remove**: Container is removed when stopped

## Testing

### Quick Test Script

Run the automated test script:

```bash
./test-game-launch.sh
```

This will:
1. Check backend health
2. Verify runner image exists
3. Launch the test game
4. Show container status and logs

### Manual Testing

### 1. Create a Test Game

A test game is already included at:
```
packages/dillinger-core/backend/data/games/test-adventure-game/start.sh
```

Metadata:
```
packages/dillinger-core/backend/data/storage/games/test-adventure-game.json
```

### 2. Start the Backend

```bash
cd packages/dillinger-core/backend
pnpm run dev
```

This sets `DILLINGER_ROOT` to `./data` automatically.

### 3. Start the Frontend

```bash
cd packages/dillinger-core/frontend
pnpm run dev
```

Visit http://localhost:3000 and navigate to the Games page.

### 4. Build the Runner Image

```bash
cd packages/runner-images/linux-native
./build.sh
```

### 5. Launch via Frontend

1. Open http://localhost:3000/games
2. Click "Launch Game" on the test game card
3. Check the container status in the card

### 6. Launch via API

```bash
curl -X POST http://localhost:3001/api/games/test-adventure-game/launch
```

### 7. Check Running Containers

```bash
docker ps --filter "name=dillinger-session-"
```

### 8. View Container Logs

```bash
docker logs dillinger-session-<session-id>
```

### 9. Stop the Game

Via frontend: Click "Stop Game" button

Via API:
```bash
curl -X POST http://localhost:3001/api/games/test-adventure-game/stop \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"<session-id>"}'
```

## Adding New Games

### 1. Create Game Directory

```bash
mkdir -p $DILLINGER_ROOT/games/my-new-game
cp /path/to/game/files $DILLINGER_ROOT/games/my-new-game/
chmod +x $DILLINGER_ROOT/games/my-new-game/start.sh
```

### 2. Create Metadata JSON

Create `$DILLINGER_ROOT/storage/games/my-new-game.json`:

```json
{
  "id": "my-new-game",
  "title": "My New Game",
  "filePath": "games/my-new-game",
  "platformId": "linux-native",
  "collectionIds": [],
  "tags": [],
  "metadata": {
    "description": "Description of my game"
  },
  "fileInfo": {
    "size": 0,
    "lastModified": "2025-10-30T00:00:00Z"
  },
  "settings": {
    "launch": {
      "command": "./start.sh",
      "arguments": ["--fullscreen"],
      "environment": {
        "GAME_SETTING": "value"
      }
    }
  },
  "created": "2025-10-30T00:00:00Z",
  "updated": "2025-10-30T00:00:00Z"
}
```

### 3. Launch

```bash
curl -X POST http://localhost:3001/api/games/my-new-game/launch
```

## Production Deployment

Set `DILLINGER_ROOT` to your production game library location:

```bash
export DILLINGER_ROOT=/opt/dillinger
```

Ensure the directory structure exists:
```bash
mkdir -p /opt/dillinger/games
mkdir -p /opt/dillinger/storage/{games,platforms,sessions,collections,metadata}
```

The backend will use this location for all game data and metadata storage.

## Future Enhancements

- [ ] X11/Wayland display forwarding for GUI games
- [ ] Audio streaming support
- [ ] WebRTC video streaming for remote play
- [ ] Container resource limits (CPU, memory)
- [ ] GPU passthrough for accelerated games
- [ ] Multiple concurrent game sessions
- [ ] Session pause/resume
- [ ] Container health monitoring
