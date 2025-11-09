# VICE Commodore Emulator Runner

Docker runner image for VICE (Versatile Commodore Emulator), supporting various Commodore computer systems.

## Supported Systems

The VICE runner supports the following Commodore systems:

- **C64** - Commodore 64 (via `x64sc` - accurate cycle-based emulator)
- **C128** - Commodore 128 (via `x128`)
- **VIC-20** - Commodore VIC-20 (via `xvic`)
- **Plus/4** - Commodore Plus/4 (via `xplus4`)
- **PET** - Commodore PET (via `xpet`)
- **CBM-II** - Commodore CBM-II series (via `xcbm2`, `xcbm5x0`)

## Features

- **Full VICE Suite** - All VICE emulators included
- **ROM Support** - Direct loading of ROM files (PRG, D64, T64, TAP, CRT, etc.)
- **Audio/Video** - PulseAudio audio and X11 video output
- **Save States** - Persistent configuration and save states
- **Accurate Emulation** - Cycle-exact emulation with true drive emulation
- **Gamepad Support** - Joystick/gamepad input support

## Usage

### Running a C64 Game

```bash
docker run -it --rm \
  -v /path/to/roms:/roms:ro \
  -v /path/to/saves:/saves:rw \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  --device /dev/dri \
  dillinger/runner-vice:latest \
  x64sc /roms/game.d64
```

### Running a C128 Game

```bash
docker run -it --rm \
  -v /path/to/roms:/roms:ro \
  -v /path/to/saves:/saves:rw \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  --device /dev/dri \
  dillinger/runner-vice:latest \
  x128 /roms/game.d64
```

### Running a VIC-20 Game

```bash
docker run -it --rm \
  -v /path/to/roms:/roms:ro \
  -v /path/to/saves:/saves:rw \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  --device /dev/dri \
  dillinger/runner-vice:latest \
  xvic /roms/game.prg
```

## Environment Variables

### VICE-Specific Variables

- `VICE_ROM_PATH` - Path to VICE ROM files (default: `/usr/lib/vice`)
- `VICE_CONFIG_DIR` - Configuration directory (default: `/config/vice`)

### Video Settings

- `VICE_VIDEO_FULLSCREEN` - Enable fullscreen mode (0/1, default: 0)
- `VICE_VIDEO_VSYNC` - Enable VSync (0/1, default: 1)
- `VICE_VIDEO_DOUBLESCAN` - Enable double-scan mode (0/1, default: 1)
- `VICE_VIDEO_DOUBLESIZE` - Enable double-size display (0/1, default: 1)

### Audio Settings

- `VICE_AUDIO_ENABLED` - Enable audio (0/1, default: 1)
- `VICE_AUDIO_FRAGMENT_SIZE` - Audio buffer size (small/medium/large, default: medium)

### Emulation Settings

- `VICE_TRUE_DRIVE_EMULATION` - Enable accurate drive emulation (0/1, default: 1)
- `VICE_WARP_MODE` - Enable warp mode for faster loading (0/1, default: 0)
- `VICE_MOUSE_GRAB` - Enable mouse grab (0/1, default: 0)

## Volume Mounts

- `/roms` - ROM files directory (read-only recommended)
- `/saves` - Save states and configuration (read-write)
- `/config/vice` - VICE configuration directory (read-write)

## Supported File Formats

VICE supports a wide variety of Commodore file formats:

### Disk Images
- `.d64` - Commodore 1541 disk image
- `.d71` - Commodore 1571 disk image
- `.d81` - Commodore 1581 disk image
- `.g64` - GCR-encoded disk image
- `.g71` - GCR-encoded 1571 disk image

### Tape Images
- `.t64` - Tape file container
- `.tap` - Tape image

### Cartridges
- `.crt` - Cartridge image

### Program Files
- `.prg` - Program file
- `.p00` - Program file (PC64 format)

### Archives
- `.zip` - Compressed archives (VICE can read from zip files)

## Examples

### Load a disk image and auto-run

```bash
docker run -it --rm \
  -v /path/to/roms:/roms:ro \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  dillinger/runner-vice:latest \
  x64sc -autostart /roms/game.d64
```

### Enable fullscreen and warp mode

```bash
docker run -it --rm \
  -v /path/to/roms:/roms:ro \
  -e DISPLAY=$DISPLAY \
  -e VICE_VIDEO_FULLSCREEN=1 \
  -e VICE_WARP_MODE=1 \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  dillinger/runner-vice:latest \
  x64sc -autostart /roms/game.d64
```

### Run with persistent configuration

```bash
docker run -it --rm \
  -v /path/to/roms:/roms:ro \
  -v /path/to/config:/config/vice:rw \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  dillinger/runner-vice:latest \
  x64sc /roms/game.d64
```

## Building the Image

```bash
cd packages/runner-images/vice
./build.sh

# Or build without cache
./build.sh --no-cache
```

## Notes

- ROMs are loaded directly - no installation required
- Save states and configurations are stored in `/saves` and `/config/vice`
- VICE emulators use X11 for display output
- Audio is handled through PulseAudio
- The runner uses the accurate cycle-based C64 emulator (`x64sc`) by default
- True drive emulation is enabled by default for maximum compatibility

## Resources

- [VICE Homepage](https://vice-emu.sourceforge.io/)
- [VICE Documentation](https://vice-emu.sourceforge.io/vice_toc.html)
- [VICE User Manual](https://vice-emu.sourceforge.io/vice_2.html)
