# Dillinger Permission Model

## Overview

Dillinger uses the **PUID/PGID pattern** to ensure file permissions work correctly across:
- Development (devcontainer)
- Production (Docker/docker-compose)
- Rootless containers (Podman)

## The Problem

When Docker creates files inside a container, they're owned by whatever user the process runs as:
- Root process → files owned by root (uid=0)
- Non-root process → files owned by that user's uid

When you mount a host directory or Docker volume, permission mismatches occur:
- Host files owned by uid 1000
- Container runs as root (uid 0) → can read/write but creates root-owned files
- Container runs as uid 1001 → cannot read/write uid 1000 files

## The Solution: PUID/PGID

The **PUID/PGID pattern** (popularized by linuxserver.io) solves this:

1. Container **starts as root** (has permission to do anything)
2. Reads `PUID` and `PGID` environment variables
3. Creates/modifies a user to match those IDs
4. **Drops privileges** to run as that user
5. All file operations use the correct uid/gid

### Example

```bash
# On host
$ id
uid=1000(john) gid=1000(john)

$ ls -la /mnt/games
drwxr-xr-x 2 john john 4096 Jan 20 10:00 .

# Run container with matching PUID/PGID
$ docker run -e PUID=1000 -e PGID=1000 -v /mnt/games:/games dillinger/runner-wine

# Inside container, files are created as uid 1000
# On host, they appear owned by john:john
```

## How Dillinger Implements This

### Runner Images (runner-wine, runner-retroarch, etc.)

The base entrypoint already handles PUID/PGID:

```bash
# /packages/runner-images/base/entrypoint.sh
export PUID="${PUID:-1000}"
export PGID="${PGID:-1000}"
export UNAME="${UNAME:-gameuser}"

setup_user() {
    # Update user to match PUID/PGID
    usermod -o -u "$PUID" $UNAME
    groupmod -o -g "$PGID" $UNAME
    
    # Fix ownership
    chown -R $PUID:$PGID "$SAVE_DIR" /home/$UNAME
}
```

### dillinger-core Container

The main app container uses an entrypoint script to handle permissions:

```bash
# Start as root, fix volume permissions, drop to app user
if [ "$(id -u)" = "0" ]; then
    chown -R $PUID:$PGID /data
    exec gosu $PUID:$PGID "$@"
fi
```

### Docker Compose

Users specify their uid/gid:

```yaml
services:
  dillinger:
    environment:
      - PUID=1000  # Your user's uid (run `id -u`)
      - PGID=1000  # Your user's gid (run `id -g`)
    volumes:
      - /mnt/games:/volumes/games  # Your game library
```

## Podman (Rootless) Compatibility

Podman's rootless mode uses **user namespaces** to remap uids:
- uid 0 inside container → your actual user outside
- This is inherently more secure

For Podman compatibility:
1. Don't hardcode uid assumptions
2. The PUID/PGID pattern still works (Podman maps them through the namespace)
3. Alternatively, run as `--user $(id -u):$(id -g)` directly

```bash
# With Podman, you can often skip PUID/PGID entirely
podman run --user $(id -u):$(id -g) -v /mnt/games:/games:Z dillinger/runner-wine
```

The `:Z` suffix tells Podman to relabel the volume for SELinux.

## Development (Devcontainer)

The devcontainer runs as `node` (uid 1000). The `postStartCommand` ensures volume permissions:

```json
{
  "remoteUser": "node",
  "postStartCommand": "sudo chown -R $(id -u):$(id -g) /data"
}
```

## Quick Reference

| Scenario | PUID/PGID | Notes |
|----------|-----------|-------|
| Linux desktop | `id -u` / `id -g` | Usually 1000/1000 |
| NAS (Synology) | Check DSM user settings | Often 1026 or similar |
| Rootless Podman | Not needed | User namespace handles it |
| Docker on macOS | Not needed | Docker Desktop handles it |
| Docker on Windows (WSL2) | 1000/1000 | WSL default user |

## Finding Your PUID/PGID

```bash
# Linux/macOS
id -u  # Your UID
id -g  # Your GID

# Or all at once
id
# uid=1000(john) gid=1000(john) groups=...
```
