# Dillinger Root Volume System

## Overview

The `dillinger_root` volume is the **foundational Docker volume** that serves as the base for all Dillinger JSON database files. This is a required volume that must exist for Dillinger to run.

## Architecture

```
dillinger_root/
├── storage/              # JSON metadata files
│   ├── games/           # Game definitions (*.json)
│   ├── platforms/       # Platform configurations (*.json)
│   ├── sessions/        # Game session data (*.json)
│   ├── collections/     # Game collections (*.json)
│   ├── metadata/        # Cached metadata
│   ├── volumes/         # Volume configurations
│   └── settings.json    # Application settings
├── games/               # Actual game installations
│   └── {game-id}/       # Individual game directories
├── assets/              # Game artwork and media
├── cache/               # Temporary cached data
├── logs/                # Application logs
├── backups/             # Automated backups
└── tmp/                 # Temporary files
```

## Volume Requirements

### Production Mode
In production, the `dillinger_root` volume **MUST** exist before starting Dillinger. If not found, the process will fail with:

```
❌ Failed to start server: You must have a volume mounted "dillinger_root" for the dillinger core to run
```

### Development Mode
In development, if the volume doesn't exist, Dillinger will automatically create it as a bind mount to the current data directory.

## Creating the Volume

### Option 1: Standard Docker Volume
```bash
docker volume create dillinger_root
```

### Option 2: Bind Mount to Host Directory (Recommended)
```bash
docker volume create \
  --driver local \
  --opt type=none \
  --opt device=/path/to/your/dillinger/data \
  --opt o=bind \
  dillinger_root
```

### Option 3: Development Setup
```bash
cd /path/to/dillinger
docker volume create \
  --driver local \
  --opt type=none \
  --opt device=$(pwd)/packages/dillinger-core/backend/data \
  --opt o=bind \
  dillinger_root
```

## Environment Variables

### DILLINGER_ROOT
This environment variable **MUST** point to the mount point of the `dillinger_root` volume:

- **Development**: `/mnt/linuxfast/dev/dillinger/packages/dillinger-core/backend/data`
- **Production**: `/data` (typical Docker container mount point)
- **Custom**: Wherever your `dillinger_root` volume is mounted

Example:
```bash
export DILLINGER_ROOT=/data
```

## Container Integration

### Docker Compose
```yaml
version: '3.8'
services:
  dillinger:
    image: dillinger:latest
    volumes:
      - dillinger_root:/data
    environment:
      - DILLINGER_ROOT=/data

volumes:
  dillinger_root:
    external: true
```

### Docker Run
```bash
docker run -d \
  -v dillinger_root:/data \
  -e DILLINGER_ROOT=/data \
  dillinger:latest
```

## Verification Process

When Dillinger starts, it performs these volume verification steps:

1. **🔍 Volume Detection**: Checks if `dillinger_root` volume exists in Docker
2. **📁 Path Verification**: For bind mounts, verifies the host path is accessible
3. **🏗️ Auto-Creation**: In development mode, creates the volume if missing
4. **✅ Health Check**: Confirms the volume is properly mounted and writable

## Troubleshooting

### Volume Not Found Error
```
❌ Required volume "dillinger_root" not found
```

**Solution**: Create the volume using one of the methods above.

### Permission Denied Error
```
EACCES: permission denied, mkdir '/var/lib/docker/volumes/dillinger_root/_data'
```

**Solution**: Ensure proper permissions on the bind mount target directory:
```bash
sudo chown -R $USER:$USER /path/to/your/dillinger/data
chmod -R 755 /path/to/your/dillinger/data
```

### Bind Mount Target Missing
```
dillinger_root volume bind mount target does not exist: /path/to/data
```

**Solution**: Create the target directory:
```bash
mkdir -p /path/to/your/dillinger/data
```

## Migration

### From Local Data Directory
If you have existing data in a local directory, migrate it to the volume:

1. Create the volume as a bind mount to your existing directory
2. Or copy data to a new volume location:
```bash
# Create volume
docker volume create dillinger_root

# Find volume location
VOLUME_PATH=$(docker volume inspect dillinger_root --format '{{.Mountpoint}}')

# Copy existing data (as root/sudo)
sudo cp -r /path/to/existing/data/* $VOLUME_PATH/
sudo chown -R 1000:1000 $VOLUME_PATH
```

## Security Considerations

- The `dillinger_root` volume contains all game metadata and configurations
- Ensure proper backup procedures for this volume
- Restrict access to the volume mount point
- For bind mounts, secure the host directory appropriately

## Development Workflow

1. **First Time Setup**:
   ```bash
   cd /path/to/dillinger
   # Volume will be auto-created on first run
   pnpm dev
   ```

2. **Subsequent Runs**:
   ```bash
   # Volume exists, starts normally
   pnpm dev
   ```

3. **Reset Data** (if needed):
   ```bash
   docker volume rm dillinger_root
   # Will be recreated on next start
   pnpm dev
   ```

## Production Deployment

1. **Pre-create the volume**:
   ```bash
   docker volume create \
     --driver local \
     --opt type=none \
     --opt device=/opt/dillinger/data \
     --opt o=bind \
     dillinger_root
   ```

2. **Set environment**:
   ```bash
   export DILLINGER_ROOT=/data
   ```

3. **Deploy with volume**:
   ```bash
   docker-compose up -d
   ```

The `dillinger_root` volume is the foundation of Dillinger's persistence layer - all JSON database files, game installations, and configurations depend on this volume being properly configured and accessible.