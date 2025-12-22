# FS-UAE Amiga Emulator Runner

Docker runner image for FS-UAE, a multi-platform Amiga emulator supporting various Amiga models.

## Supported Systems

The FS-UAE runner supports the following Amiga systems:

- **Amiga 500** - OCS chipset, 512KB Chip RAM
- **Amiga 500+** - ECS chipset, 1MB Chip RAM
- **Amiga 600** - ECS chipset, 1MB Chip RAM
- **Amiga 1000** - OCS chipset, 512KB Chip RAM
- **Amiga 1200** - AGA chipset, 2MB Chip RAM
- **Amiga 3000** - ECS chipset with 32-bit CPU
- **Amiga 4000** - AGA chipset with 68040 CPU
- **Amiga CD32** - CD-based console with AGA chipset

## Features

- **Accurate Emulation** - Cycle-accurate emulation of Amiga hardware
- **Multiple Models** - Support for various Amiga models from A500 to A4000
- **Kickstart ROMs** - Requires original Amiga Kickstart ROMs
- **WHDLoad Support** - Run games with WHDLoad for better compatibility
- **Audio/Video** - High-quality audio and video output via X11 and PulseAudio
- **Save States** - Persistent configuration and save states
- **Gamepad Support** - Joystick/gamepad input support

## Required Files

### Kickstart ROMs

FS-UAE requires original Amiga Kickstart ROM files to function. These are copyrighted and must be obtained legally. Common Kickstart files include:

- `kick34005.A500` - Kickstart 1.3 for Amiga 500
- `kick37175.A500` - Kickstart 2.04 for Amiga 500+
- `kick40063.A600` - Kickstart 3.1 for Amiga 600/1200
- `kick40068.A1200` - Kickstart 3.1 for Amiga 1200
- `kick40060.CD32` - Extended Kickstart for CD32

Place your Kickstart ROM files in the `/bios` directory mount.

## Usage

### Running an Amiga Game

```bash
docker run -it --rm \
  -v /path/to/roms:/roms:ro \
  -v /path/to/kickstarts:/bios:ro \
  -v /path/to/saves:/saves:rw \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  --device /dev/dri \
  ghcr.io/thrane20/dillinger/runner-fs-uae:latest \
  fs-uae /roms/game.adf
```

### Running a WHDLoad Game

```bash
docker run -it --rm \
  -v /path/to/roms:/roms:ro \
  -v /path/to/kickstarts:/bios:ro \
  -v /path/to/saves:/saves:rw \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  --device /dev/dri \
  ghcr.io/thrane20/dillinger/runner-fs-uae:latest \
  fs-uae --amiga-model=A1200 /roms/game.lha
```

### Running with Configuration File

```bash
docker run -it --rm \
  -v /path/to/roms:/roms:ro \
  -v /path/to/kickstarts:/bios:ro \
  -v /path/to/config:/config/fs-uae:rw \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  --device /dev/dri \
  ghcr.io/thrane20/dillinger/runner-fs-uae:latest \
  fs-uae /config/fs-uae/game.fs-uae
```

## Environment Variables

### FS-UAE-Specific Variables

- `FSUAE_CONFIG_DIR` - Configuration directory (default: `/config/fs-uae`)
- `FSUAE_KICKSTARTS_DIR` - Kickstart ROMs directory (default: `/bios`)

### Video Settings

- `FSUAE_FULLSCREEN` - Enable fullscreen mode (0/1, default: 0)
- `FSUAE_VSYNC` - Enable VSync (0/1, default: 1)
- `FSUAE_VIDEO_SYNC` - Enable video synchronization (0/1, default: 1)

### Audio Settings

- `FSUAE_AUDIO_FREQUENCY` - Audio sample rate in Hz (default: 44100)
- `FSUAE_AUDIO_BUFFER_SIZE` - Audio buffer size (default: 2048)

### Emulation Settings

- `FSUAE_ACCURACY` - Emulation accuracy (0=Fast, 1=Compatible, default: 1)

## Volume Mounts

- `/roms` - ROM files directory (ADF, IPF, DMS, LHA, etc.) (read-only recommended)
- `/bios` - Kickstart ROM files directory (read-only recommended)
- `/saves` - Save states and configuration (read-write)
- `/config/fs-uae` - FS-UAE configuration directory (read-write)

## Supported File Formats

FS-UAE supports a wide variety of Amiga file formats:

### Floppy Disk Images
- `.adf` - Amiga Disk File (standard disk image)
- `.adz` - Compressed ADF (gzip)
- `.dms` - DiskMasher compressed disk
- `.ipf` - Interchangeable Preservation Format (copy-protected)

### Hard Disk Images
- `.hdf` - Hard Disk File
- `.vhd` - Virtual Hard Disk

### Archives
- `.lha` - LHA archive (commonly used for WHDLoad)
- `.lzx` - LZX archive
- `.zip` - ZIP archive

### CD Images
- `.iso` - CD-ROM image
- `.cue` / `.bin` - CD image with cue sheet
- `.ccd` - CloneCD image

### Save States
- `.uss` - FS-UAE save state

## Examples

### Load an ADF floppy disk

```bash
docker run -it --rm \
  -v /path/to/roms:/roms:ro \
  -v /path/to/kickstarts:/bios:ro \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  ghcr.io/thrane20/dillinger/runner-fs-uae:latest \
  fs-uae --amiga-model=A500 --floppy-drive-0=/roms/game.adf
```

### Run Amiga 1200 with AGA chipset

```bash
docker run -it --rm \
  -v /path/to/roms:/roms:ro \
  -v /path/to/kickstarts:/bios:ro \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  ghcr.io/thrane20/dillinger/runner-fs-uae:latest \
  fs-uae --amiga-model=A1200 /roms/game.adf
```

### Enable fullscreen mode

```bash
docker run -it --rm \
  -v /path/to/roms:/roms:ro \
  -v /path/to/kickstarts:/bios:ro \
  -e DISPLAY=$DISPLAY \
  -e FSUAE_FULLSCREEN=1 \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  ghcr.io/thrane20/dillinger/runner-fs-uae:latest \
  fs-uae /roms/game.adf
```

### Run with persistent configuration

```bash
docker run -it --rm \
  -v /path/to/roms:/roms:ro \
  -v /path/to/kickstarts:/bios:ro \
  -v /path/to/config:/config/fs-uae:rw \
  -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix:rw \
  ghcr.io/thrane20/dillinger/runner-fs-uae:latest \
  fs-uae /roms/game.adf
```

## Building the Image

```bash
cd packages/runner-images/fs-uae
./build.sh

# Or build without cache
./build.sh --no-cache
```

## Notes

- Kickstart ROMs are required and must be obtained legally
- WHDLoad games provide the best compatibility and performance
- ADF files are the most common format for Amiga floppy disk games
- IPF files preserve copy protection and work with original game disks
- The emulator uses X11 for display output
- Audio is handled through PulseAudio
- Save states and configurations are stored in `/saves` and `/config/fs-uae`
- FS-UAE supports advanced features like WHDLoad, AGA chipset, and CD32 emulation

## Resources

- [FS-UAE Homepage](https://fs-uae.net/)
- [FS-UAE Documentation](https://fs-uae.net/docs)
- [FS-UAE Configuration](https://fs-uae.net/docs/options)
- [WHDLoad Information](http://www.whdload.de/)
