# Dillinger MAME Runner

This directory contains the Docker configuration for the MAME (Multiple Arcade Machine Emulator) runner.

## Overview

The MAME runner extends the `ghcr.io/thrane20/dillinger/runner-base` image and adds:
- MAME emulator
- MAME tools
- Configuration for Arcade games

## Directory Structure

- `Dockerfile`: Defines the Docker image
- `mame-entrypoint.sh`: Entrypoint script that sets up the environment
- `build.sh`: Script to build the Docker image

## Environment Variables

The runner supports the following environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `MAME_ROM_PATH` | Path to ROM files | `/roms` |
| `MAME_CONFIG_DIR` | Path to configuration | `/config/mame` |
| `MAME_SAMPLE_PATH` | Path to samples | `/samples` |
| `MAME_ARTWORK_PATH` | Path to artwork | `/artwork` |
| `MAME_VIDEO_MODE` | Video mode (opengl, bgfx, soft) | `opengl` |
| `MAME_WINDOW` | Windowed mode (0=fullscreen, 1=windowed) | `0` |
| `MAME_SOUND` | Sound driver (auto, pulseaudio, etc.) | `auto` |

## Building

Run the build script:

```bash
./build.sh
```

Or build from the root `runner-images` directory:

```bash
../build.sh mame
```
