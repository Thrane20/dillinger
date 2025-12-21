# Dillinger Release Assets

This directory contains helper scripts for producing a production-ready Dillinger Core build and running it locally.

## Contents

- `build_release.sh` – Installs dependencies, compiles the Next.js frontend, builds the Dillinger Core Docker image, and builds every runner image.
- `start_core.sh` – Launches the Dillinger Core container with GPU/audio/input passthrough and bind-mounts the required volumes. Accepts optional flags to pick an image, container name, or port.

## Usage

Note: If you see `Permission denied` when running a script, ensure it is executable:

```bash
chmod +x release_assets/*.sh
```

1. **Build everything**
   ```bash
   ./release_assets/build_release.sh
   ```
   This creates the `dillinger-core:latest` image and the runner images (`dillinger/runner-*`).

2. **Start Dillinger Core**
   ```bash
   ./release_assets/start_core.sh --port 3010
   ```
   Adjust the port, container name, or image via CLI flags or environment variables (`CORE_PORT`, `CONTAINER_NAME`, `IMAGE_NAME`).

## Audio notes (PulseAudio / PipeWire)

Dillinger Core queries available audio sinks using `pactl` so you can select a default sink in Settings. For this to work, the container must be able to connect to your host PulseAudio (or `pipewire-pulse`) socket.

- `start_core.sh` runs the container as your host user (`--user $PUID:$PGID`) and sets `XDG_RUNTIME_DIR` / `PULSE_SERVER` so `pactl` can connect.
- If you run the container manually, avoid running it as `root` when using the host PulseAudio socket; PulseAudio commonly refuses connections from `root` to a non-root runtime dir.
- The script uses `${XDG_RUNTIME_DIR:-/run/user/$PUID}` on the host and mounts the `pulse/` directory from there.

Ensure `docker`, `pnpm`, and access to the host display/audio stack are available before running these scripts.
