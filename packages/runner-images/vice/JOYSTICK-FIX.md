# VICE Runner — Joystick Fix

## Problem

Joysticks were not detected by VICE running inside Docker containers, even though
the same joysticks worked perfectly on the host and in RetroArch containers.

## Root Causes (there were four)

### 1. `/dev/input` not visible in the container

Docker's `Devices` API field maps individual device nodes, not directories.
`/dev/input` was passed as a "device" but Docker silently ignored it — VICE's
evdev driver failed with:

```
scandir() failed on /dev/input: No such file or directory
```

**Fix:** Changed `/dev/input` from a Docker device mapping to a **bind-mount
volume** (`/dev/input:/dev/input:rw`) in `docker-service.ts`
(`getDisplayConfiguration`).

### 2. Cgroup device filter blocking access

Even after bind-mounting `/dev/input`, the kernel returned `EPERM` (Operation
not permitted) when gameuser tried to open event devices. Docker's cgroup
device allowlist did not include input device major number 13.

**Fix:** Added `DeviceCgroupRules: ['c 13:* rwm']` to every container
`HostConfig` in `docker-service.ts`. This allows character device major 13
(the Linux input subsystem) with any minor number.

### 3. `-default` flag resetting joystick config

The VICE command line was `x64sc -default /roms/game.d64`. The `-default` flag
resets **all** VICE settings to compile-time defaults, which disables joystick
port assignments. In a fresh container there is no stale config to reset, so
`-default` was purely harmful.

**Fix:** Removed `-default` from the VICE `cmdArray` in `docker-service.ts`.
The command is now simply `x64sc /roms/game.d64`.

### 4. Entrypoint regex bug (token parsing)

The entrypoint's joystick discovery code parsed `/proc/bus/input/devices`
handler lines like:

```
H: Handlers=event9 js0
```

It split the line by whitespace and matched each token against
`^(event[0-9]+)$`. But `Handlers=event9` is a single token — the regex never
matched.

**Fix:** Changed to a regex match on the full line:
`[[ "$line" =~ (event[0-9]+) ]]` instead of tokenizing.

## How It Works Now

1. **docker-service.ts** bind-mounts `/dev/input` as a volume and adds cgroup
   rule `c 13:* rwm`. It launches VICE without `-default`.

2. **vice-entrypoint.sh** discovers joystick event devices by parsing
   `/tmp/host-input-devices` (a read-only mount of
   `/proc/bus/input/devices`), then exports
   `SDL_JOYSTICK_DEVICE=/dev/input/event9,/dev/input/event11,...` so SDL2 can
   find them without a running udev daemon.

3. **VICE's own evdev driver** scans `/dev/input` directly and picks up the
   joystick devices. With no `-default` flag, VICE's compile-time defaults
   leave joystick ports enabled.

## Files Changed

| File | Change |
|------|--------|
| `packages/dillinger-core/lib/services/docker-service.ts` | Bind-mount `/dev/input` as volume; add `DeviceCgroupRules`; remove `-default` from VICE cmd |
| `packages/runner-images/vice/vice-entrypoint.sh` | Add joystick discovery section; fix event device regex parsing |

## Key Concepts

- **RetroArch vs VICE input**: RetroArch has its own udev input driver that
  directly opens `/dev/input/event*` files. VICE uses SDL2 + its own evdev
  driver, which both need either a running udev daemon or explicit device
  paths.

- **`SDL_JOYSTICK_DEVICE`**: Tells SDL2 which `/dev/input/event*` nodes are
  joysticks. Required in containers where udev is not running.

- **Cgroup device filter**: Docker restricts which device major:minor numbers
  a container can access, independent of file permissions. Major 13 = Linux
  input subsystem.

- **`/proc/bus/input/devices`**: Kernel-provided list of all input devices
  with their handlers (eventN, jsN). Mounted read-only into containers at
  `/tmp/host-input-devices`.

## Debugging Tips

```bash
# Check if /dev/input is visible in the container
docker exec <container> ls -la /dev/input/

# Check if event devices are accessible by gameuser
docker exec <container> gosu gameuser dd if=/dev/input/event12 bs=1 count=1 of=/dev/null

# Check SDL_JOYSTICK_DEVICE in container logs
docker logs <container> 2>&1 | grep SDL_JOYSTICK_DEVICE

# Run VICE with verbose logging
# Change cmdArray in docker-service.ts to include '--verbose'
```
