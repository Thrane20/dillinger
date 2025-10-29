# Quickstart: Dillinger Runner Streaming

**Feature**: 002-dillinger-runner-streaming  
**Date**: 2025-10-29  
**Prerequisites**: Docker with NVIDIA Container Runtime, X11 server

## Overview

The Dillinger Runner enables streaming game execution from within Docker containers. It supports both Windows games (via Wine/Proton) and native Linux games, with display forwarding to the host system.

## Development Setup

### 1. Prerequisites

**Required on Host System**:
```bash
# Docker with Compose V2
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# NVIDIA Container Runtime (for GPU games)
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list
sudo apt-get update && sudo apt-get install -y nvidia-container-runtime
sudo systemctl restart docker

# X11 development tools
sudo apt-get install -y xauth x11-apps
```

**Verify GPU Access**:
```bash
docker run --rm --gpus all nvidia/cuda:12.0-base-ubuntu20.04 nvidia-smi
```

### 2. Build Development Images

```bash
# From repository root
cd /Users/iansorbello/dev/dillinger

# Build the dillinger-runner image
docker build -f docker/dillinger-runner/Dockerfile -t thrane20/dillinger-runner:dev .

# Start the development stack
docker-compose -f docker-compose.dev.yml up -d
```

### 3. Container Structure

The development setup includes:

```yaml
# docker-compose.dev.yml additions
services:
  dillinger-runner:
    image: thrane20/dillinger-runner:dev
    volumes:
      - dillinger_library:/data:ro      # Game library access
      - /tmp/.X11-unix:/tmp/.X11-unix   # X11 display forwarding
      - /dev/dri:/dev/dri               # GPU device access (optional)
    environment:
      - DISPLAY=${DISPLAY}
      - PULSE_RUNTIME_PATH=/run/user/1000/pulse
    networks:
      - dillinger-network
    depends_on:
      - dillinger-backend
    deploy:
      resources:
        limits:
          memory: 8G
          cpus: '4.0'
    devices:
      - /dev/dri:/dev/dri             # Intel GPU
    runtime: nvidia                   # NVIDIA GPU
```

## Quick Test

### 1. Prepare Test Game

```bash
# Create a simple test game in the library
mkdir -p ./data/games/test_game_001
cat > ./data/games/test_game_001/game.json << 'EOF'
{
  "id": "test_game_001",
  "name": "Test Game",
  "platform": "linux",
  "executable": "/usr/bin/xclock",
  "args": [],
  "category": "utility"
}
EOF
```

### 2. Launch via API

```bash
# Launch the test game
curl -X POST http://localhost:4000/api/v1/runner/launch \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-key" \
  -d '{
    "gameId": "test_game_001",
    "userId": "test_user",
    "platform": "linux",
    "sessionId": "sess_test_12345",
    "launchConfig": {
      "displayMode": "x11",
      "audioEnabled": false,
      "resources": {
        "cpuLimit": 1.0,
        "memoryLimit": "512M",
        "gpuAccess": "none"
      }
    }
  }'

# Check session status
curl http://localhost:4000/api/v1/runner/sessions/sess_test_12345 \
  -H "X-API-Key: dev-key"

# You should see xclock appear on your desktop!
```

### 3. Windows Game Test

```bash
# Test Windows game with Wine
curl -X POST http://localhost:4000/api/v1/runner/launch \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-key" \
  -d '{
    "gameId": "notepad_test",
    "userId": "test_user",
    "platform": "windows",
    "sessionId": "sess_wine_test",
    "launchConfig": {
      "winePrefix": "/tmp/wine-test",
      "displayMode": "x11",
      "audioEnabled": false,
      "resources": {
        "cpuLimit": 2.0,
        "memoryLimit": "1G",
        "gpuAccess": "none"
      },
      "environment": {
        "WINEDEBUG": "-all"
      }
    }
  }'
```

## Frontend Integration

### 1. Add Launch Button Component

```typescript
// packages/frontend/app/components/GameLauncher.tsx
'use client';

import { useState } from 'react';

interface GameLauncherProps {
  gameId: string;
  gameName: string;
  platform: 'windows' | 'linux';
}

export default function GameLauncher({ gameId, gameName, platform }: GameLauncherProps) {
  const [launching, setLaunching] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const launchGame = async () => {
    setLaunching(true);
    
    try {
      const response = await fetch('/api/v1/runner/launch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'dev-key', // Replace with proper auth
        },
        body: JSON.stringify({
          gameId,
          userId: 'current_user', // Replace with actual user ID
          platform,
          sessionId: `sess_${Date.now()}`,
          launchConfig: {
            displayMode: 'x11',
            audioEnabled: true,
            resources: {
              cpuLimit: 4.0,
              memoryLimit: '4G',
              gpuAccess: 'shared'
            },
            ...(platform === 'windows' && {
              winePrefix: `/home/retro/.wine-${gameId}`
            })
          }
        })
      });

      const result = await response.json();
      if (response.ok) {
        setSessionId(result.sessionId);
      } else {
        console.error('Launch failed:', result);
      }
    } catch (error) {
      console.error('Launch error:', error);
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="game-launcher">
      <button 
        onClick={launchGame}
        disabled={launching}
        className="btn-primary"
      >
        {launching ? 'Starting...' : `Play ${gameName}`}
      </button>
      
      {sessionId && (
        <div className="session-info">
          <p>Session: {sessionId}</p>
          <button 
            onClick={() => setSessionId(null)}
            className="btn-secondary"
          >
            Stop Game
          </button>
        </div>
      )}
    </div>
  );
}
```

### 2. Backend Route

```typescript
// packages/backend/src/api/runner.ts
import express from 'express';
import { runnerOrchestrator } from '../services/runner-orchestrator';

const router = express.Router();

router.post('/launch', async (req, res) => {
  try {
    const launchRequest = req.body;
    const result = await runnerOrchestrator.launchGame(launchRequest);
    res.status(202).json(result);
  } catch (error) {
    res.status(400).json({
      error: 'LAUNCH_FAILED',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
```

## Debugging

### 1. Container Logs

```bash
# View runner container logs
docker logs dillinger-runner-dev

# Follow logs in real-time
docker logs -f dillinger-runner-dev

# Check specific session container
docker logs dillinger_runner_sess_12345
```

### 2. Display Issues

```bash
# Check X11 authentication
xauth list
echo $DISPLAY

# Test X11 forwarding
docker run --rm -e DISPLAY=$DISPLAY -v /tmp/.X11-unix:/tmp/.X11-unix alpine/git sh -c 'apk add --no-cache xeyes && xeyes'

# Check GPU access
docker run --rm --gpus all nvidia/cuda:12.0-base-ubuntu20.04 nvidia-smi
```

### 3. Wine/Proton Issues

```bash
# Enter runner container for debugging
docker exec -it dillinger-runner-dev bash

# Check Wine installation
wine --version
winetricks --version

# Test basic Wine functionality
DISPLAY=:0 wine notepad
```

## Performance Tuning

### 1. Resource Limits

```yaml
# Adjust in docker-compose.dev.yml
deploy:
  resources:
    limits:
      memory: 16G      # Increase for demanding games
      cpus: '8.0'      # Use more CPU cores
    reservations:
      memory: 2G       # Minimum guaranteed memory
      cpus: '1.0'
```

### 2. GPU Optimization

```bash
# Enable all GPU features
runtime: nvidia
environment:
  - NVIDIA_VISIBLE_DEVICES=all
  - NVIDIA_DRIVER_CAPABILITIES=all
```

### 3. Display Performance

```bash
# Use hardware acceleration
environment:
  - LIBGL_ALWAYS_INDIRECT=0
  - __GL_SYNC_TO_VBLANK=0
  - MESA_GL_VERSION_OVERRIDE=4.5
```

## Troubleshooting

### Common Issues

1. **"Permission denied" on X11 socket**:
   ```bash
   xhost +local:docker
   ```

2. **Wine prefix creation fails**:
   ```bash
   # Clear Wine prefix and recreate
   rm -rf ~/.wine-game_id
   ```

3. **GPU not detected**:
   ```bash
   # Verify NVIDIA runtime
   docker info | grep -i nvidia
   ```

4. **Audio not working**:
   ```bash
   # Check PulseAudio socket
   ls -la /run/user/1000/pulse/
   ```

### Development Workflow

1. **Make changes** to Dockerfile or scripts
2. **Rebuild image**: `docker build -f docker/dillinger-runner/Dockerfile -t thrane20/dillinger-runner:dev .`
3. **Restart service**: `docker-compose restart dillinger-runner`
4. **Test launch**: Use the API calls above
5. **Check logs**: `docker logs dillinger-runner-dev`

## Next Steps

- Test with real games from your library
- Implement session cleanup automation
- Add WebRTC streaming for remote access
- Optimize container startup time
- Add session recording/replay capabilities