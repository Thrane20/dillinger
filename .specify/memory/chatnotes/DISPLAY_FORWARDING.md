# Display Forwarding for Game Runners

The Dillinger game launcher now supports **automatic display forwarding** from Docker containers to your host system, allowing graphical games to render their windows directly on your desktop.

## How It Works

When you launch a game through Dillinger, the `DockerService` automatically:

1. **Detects your display environment** (X11 or Wayland)
2. **Configures the container** with the appropriate display protocol
3. **Mounts display sockets** from host to container
4. **Provides GPU access** for hardware acceleration

This happens transparently - you don't need to configure anything manually.

## Supported Display Protocols

### X11 (Most Common)

If you're running on X11 (most Linux distributions, WSL2 with X server), Dillinger will:

- Set `DISPLAY` environment variable in the container
- Mount `/tmp/.X11-unix` socket for X11 communication
- Mount `.Xauthority` file for authentication
- Enable IPC host mode for shared memory (required for many X11 apps)
- Mount `/dev/dri` for GPU acceleration

**Requirements:**
- `DISPLAY` environment variable must be set on the host
- X11 server must be running
- `.Xauthority` file must exist

### Wayland (Modern Linux)

If you're running Wayland (GNOME on modern distros, Sway, etc.), Dillinger will:

- Set `WAYLAND_DISPLAY` environment variable
- Mount the Wayland socket from `$XDG_RUNTIME_DIR`
- Configure Qt/GTK/SDL to use Wayland
- Mount `/dev/dri` for GPU acceleration

**Requirements:**
- `WAYLAND_DISPLAY` environment variable must be set
- `XDG_RUNTIME_DIR` must point to runtime directory
- Wayland compositor must be running

### Headless Mode

If neither X11 nor Wayland is detected:

- Container runs in headless mode
- No display forwarding configured
- Suitable for terminal-based games or server processes
- A warning is logged to the console

## Testing Display Forwarding

### Quick Test

Launch the **GUI Test Game** from the Dillinger web interface:

1. Navigate to http://localhost:3010/games
2. Find "GUI Test Game"
3. Click "Launch"
4. A window should appear on your desktop!

### Manual Test

```bash
# Check your display environment
echo $DISPLAY           # Should show :0 or :1 for X11
echo $WAYLAND_DISPLAY   # Should show wayland-0 for Wayland

# Launch a game manually
docker run --rm -it \
  -e DISPLAY=$DISPLAY \
  -e GAME_EXECUTABLE=/usr/local/bin/test-game.sh \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  -v $HOME/.Xauthority:/home/gameuser/.Xauthority:ro \
  --device /dev/dri \
  --ipc=host \
  dillinger/runner-linux-native:latest
```

### Verify X11 Tools in Container

```bash
# Run xeyes (classic X11 test)
docker run --rm -it \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  -v $HOME/.Xauthority:/home/gameuser/.Xauthority:ro \
  --ipc=host \
  dillinger/runner-linux-native:latest \
  xeyes

# Run xterm (terminal emulator)
docker run --rm -it \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  -v $HOME/.Xauthority:/home/gameuser/.Xauthority:ro \
  --ipc=host \
  dillinger/runner-linux-native:latest \
  xterm
```

## Architecture Details

### Display Configuration Detection

The `DockerService.getDisplayConfiguration()` method checks environment variables in this order:

1. **Wayland**: `WAYLAND_DISPLAY` + `XDG_RUNTIME_DIR`
2. **X11**: `DISPLAY`
3. **None**: Headless mode

### Container Configuration

For X11, the container gets:

```typescript
{
  Env: ['DISPLAY=:0'],
  HostConfig: {
    Binds: [
      '/tmp/.X11-unix:/tmp/.X11-unix:rw',
      '/home/user/.Xauthority:/home/gameuser/.Xauthority:ro'
    ],
    Devices: [
      { PathOnHost: '/dev/dri', PathInContainer: '/dev/dri', CgroupPermissions: 'rwm' }
    ],
    IpcMode: 'host',
    SecurityOpt: ['seccomp=unconfined']
  }
}
```

For Wayland, the container gets:

```typescript
{
  Env: [
    'WAYLAND_DISPLAY=wayland-0',
    'XDG_RUNTIME_DIR=/run/user/1000',
    'QT_QPA_PLATFORM=wayland',
    'GDK_BACKEND=wayland',
    'SDL_VIDEODRIVER=wayland'
  ],
  HostConfig: {
    Binds: [
      '/run/user/1000/wayland-0:/run/user/1000/wayland-0:rw'
    ],
    Devices: [
      { PathOnHost: '/dev/dri', PathInContainer: '/dev/dri', CgroupPermissions: 'rwm' }
    ]
  }
}
```

## Troubleshooting

### "Cannot connect to X11 display"

**Symptoms:** Container logs show "Cannot connect to X11 display" or similar

**Solutions:**

1. **Allow X11 connections from Docker:**
   ```bash
   xhost +local:docker
   ```

2. **Check DISPLAY variable:**
   ```bash
   echo $DISPLAY  # Should show :0 or :1
   ```

3. **Verify X11 socket exists:**
   ```bash
   ls -la /tmp/.X11-unix/
   ```

4. **Check Xauthority:**
   ```bash
   ls -la ~/.Xauthority
   ```

### "No display environment detected"

**Symptoms:** Backend logs show "⚠ No display environment detected"

**Solutions:**

1. **Set DISPLAY in your shell profile:**
   ```bash
   echo 'export DISPLAY=:0' >> ~/.bashrc
   source ~/.bashrc
   ```

2. **If using VSCode devcontainer:**
   - Add to `.devcontainer/devcontainer.json`:
   ```json
   {
     "remoteEnv": {
       "DISPLAY": ":0"
     }
   }
   ```

3. **Start X11 server** (if not running):
   ```bash
   startx
   ```

### Wayland Issues

**Symptoms:** Games don't appear or fail to start on Wayland

**Solutions:**

1. **Enable XWayland compatibility:**
   ```bash
   # Most Wayland compositors support X11 apps via XWayland
   export DISPLAY=:0  # XWayland display
   ```

2. **Check Wayland socket:**
   ```bash
   ls -la $XDG_RUNTIME_DIR/wayland-*
   ```

### GPU Not Working

**Symptoms:** Games run but are slow, or fail with OpenGL/Vulkan errors

**Solutions:**

1. **Verify GPU device exists:**
   ```bash
   ls -la /dev/dri/
   ```

2. **Check Mesa drivers installed:**
   ```bash
   docker run --rm dillinger/runner-linux-native:latest glxinfo | grep "OpenGL"
   ```

3. **For NVIDIA GPUs**, install nvidia-docker:
   ```bash
   # Install nvidia-container-toolkit
   # Then add to DockerService:
   DeviceRequests: [
     {
       Driver: 'nvidia',
       Count: -1,
       Capabilities: [['gpu', 'utility', 'compute', 'graphics', 'display']]
     }
   ]
   ```

## Security Considerations

### X11 Security

X11 display forwarding gives containers access to:
- Your display (they can capture screenshots)
- Your keyboard/mouse input
- Other X11 applications running

**Mitigation:**
- Containers run as non-root user (`gameuser`)
- Each game runs in isolated container
- Containers are ephemeral (auto-removed after exit)

### Xhost Permissions

The `xhost +local:docker` command allows any local Docker container to access your X server.

**Better alternative:**
```bash
# Allow only specific containers
xhost +local:$(docker inspect -f '{{.Config.Hostname}}' container-id)
```

## Implementation Reference

The display forwarding implementation is inspired by but simplified from Games on Whales (GOW) and Wolf projects in `/third_party/`. Key simplifications:

1. **No separate display manager service** - configuration happens at container launch
2. **No virtual displays** - direct forwarding to host display
3. **No streaming layer** - future enhancement for web-based streaming
4. **Automatic protocol detection** - no manual configuration required

## Future Enhancements

- [ ] WebRTC/WebSocket streaming for browser-based gameplay
- [ ] Virtual display creation for multi-user scenarios
- [ ] Audio forwarding (PulseAudio/PipeWire)
- [ ] Input device passthrough (controllers, joysticks)
- [ ] Display resolution/DPI configuration
- [ ] Gamescope integration for better compositor control
