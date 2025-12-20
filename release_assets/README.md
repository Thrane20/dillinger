# Dillinger Release Assets

This directory contains helper scripts for producing a production-ready Dillinger Core build and running it locally.

## Contents

- `build_release.sh` – Installs dependencies, compiles the Next.js frontend, builds the Dillinger Core Docker image, and builds every runner image.
- `start_core.sh` – Launches the Dillinger Core container with GPU/audio/input passthrough and bind-mounts the required volumes. Accepts optional flags to pick an image, container name, or port.

## Usage

1. **Build everything**
   ```bash
   ./release_assets/build_release.sh
   ```
   This creates the `dillinger-core:latest` image and the runner images (`dillinger/runner-*`).

2. **Start Dillinger Core**
   ```bash
   ./release_assets/start_core.sh --port 4000
   ```
   Adjust the port, container name, or image via CLI flags or environment variables (`CORE_PORT`, `CONTAINER_NAME`, `IMAGE_NAME`).

Ensure `docker`, `pnpm`, and access to the host display/audio stack are available before running these scripts.
