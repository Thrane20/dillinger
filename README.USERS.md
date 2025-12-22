# Dillinger User Guide 🎮

> Getting started with Dillinger on a fresh machine

## 📋 Prerequisites

Before you begin, you need:

1. **A Linux machine** (Ubuntu 22.04+, Debian 12+, Arch, Fedora, etc.)
2. **Docker installed** and running
3. **Internet connection** to download images

### Installing Docker (podman support is in the works)

If you don't have Docker yet:

**Ubuntu/Debian:**
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

**Arch Linux:**
```bash
sudo pacman -S docker
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```

**After installation:** Log out and log back in for group changes to take effect.

Verify Docker is running:
```bash
docker ps
```

## 🚀 Quick Start (Automatic)

The easiest way to get started:

```bash
# Download and run the start script
curl -fsSL https://raw.githubusercontent.com/Thrane20/dillinger/main/start-dillinger.sh -o start-dillinger.sh
chmod +x start-dillinger.sh
./start-dillinger.sh
```

This script will:
1. Check if Docker is installed
2. Create the required `dillinger_data` volume
3. Pull the latest Dillinger image
4. Start the container
5. Show you the URL to access the web interface

Once complete, open **http://localhost:3010** in your browser.

## 📦 Manual Installation

If you prefer to do it manually:

### Step 1: Create the Data Volume

Dillinger stores all your game library data, metadata, and configuration in a Docker volume called `dillinger_data`.

**Option A: Use a Docker Named Volume (Recommended)**

This is the simplest approach - Docker manages the volume location automatically:

```bash
docker volume create dillinger_data
```

To find where Docker stores this volume:
```bash
docker volume inspect dillinger_data
# Look for "Mountpoint" - usually /var/lib/docker/volumes/dillinger_data/_data
```

**Option B: Use a Bind Mount (Custom Location)**

If you want to store data in a specific location (e.g., on a separate drive):

```bash
# Create your data directory
mkdir -p /path/to/your/dillinger-data

# Use this path when running the container (see next step)
```

### Step 2: Pull the Dillinger Image

Download the latest Dillinger core application:

```bash
docker pull ghcr.io/thrane20/dillinger/core:latest
```

### Step 3: Start Dillinger

**Using Named Volume:**
```bash
docker run -d \
  --name dillinger \
  -p 3010:3010 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v dillinger_data:/data \
  --restart unless-stopped \
  ghcr.io/thrane20/dillinger/core:latest
```

**Using Bind Mount (Custom Path):**
```bash
docker run -d \
  --name dillinger \
  -p 3010:3010 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v /path/to/your/dillinger-data:/data \
  --restart unless-stopped \
  ghcr.io/thrane20/dillinger/core:latest
```

### Step 4: Access the Web Interface

Open your browser and go to:

```
http://localhost:3010
```

Or from another device on your network:
```
http://YOUR_SERVER_IP:3010
```

## 🎮 First-Time Setup

### 1. Install Game Runners

When you first access Dillinger, you'll need to download the platform runners:

1. Click **"Platforms"** in the sidebar
2. You'll see tabs for different platforms (Wine, VICE, Arcade, etc.)
3. Click the **Download** button next to each platform you want to use
4. Wait for the download progress to complete

**Recommended runners to start with:**
- **Wine** - For Windows games
- **RetroArch** - For classic console games
- **VICE** - For Commodore 64 games (if you have C64 ROMs)

### 2. Add Your First Game

#### From GOG:
1. Go to **"Online Sources"** → **"GOG"**
2. Click **"Authenticate"** and log in to your GOG account
3. Your GOG library will appear
4. Click **"Download"** on any game to install it

#### From Local Files:
1. Go to **"Games"**
2. Click **"Add Game"**
3. Fill in the details:
   - **Name**: Game title
   - **Platform**: Select the appropriate platform (Wine, Native Linux, etc.)
   - **Executable**: Path to the game exe/binary
4. Optionally add cover art and metadata
5. Click **"Save"**

### 3. Launch a Game

1. Find your game in the library
2. Click on it to open the details
3. Click **"Play"**
4. The game will launch in a container
5. If streaming is configured, you'll see the desktop in your browser

## 🔧 Container Management

### View Running Containers
```bash
docker ps
```

### View Dillinger Logs
```bash
docker logs dillinger
```

### Restart Dillinger
```bash
docker restart dillinger
```

### Stop Dillinger
```bash
docker stop dillinger
```

### Start Dillinger Again
```bash
docker start dillinger
```

### Remove Dillinger (keeps your data)
```bash
docker rm -f dillinger
# Your games and data remain in the dillinger_data volume
```

## 💾 Backup Your Data

### Backup the Data Volume

**If using a named volume:**
```bash
# Create a backup
docker run --rm \
  -v dillinger_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/dillinger-backup-$(date +%Y%m%d).tar.gz -C /data .
```

**If using a bind mount:**
```bash
# Just backup the directory
tar czf dillinger-backup-$(date +%Y%m%d).tar.gz /path/to/your/dillinger-data
```

### Restore from Backup

**For named volume:**
```bash
docker run --rm \
  -v dillinger_data:/data \
  -v $(pwd):/backup \
  alpine sh -c "cd /data && tar xzf /backup/dillinger-backup-YYYYMMDD.tar.gz"
```

**For bind mount:**
```bash
tar xzf dillinger-backup-YYYYMMDD.tar.gz -C /path/to/your/dillinger-data
```

## 🔒 Security Considerations

### Docker Socket Access

Dillinger needs access to `/var/run/docker.sock` to create game containers. This gives it full control over Docker on your host.

**For home use:** This is generally fine.

**For multi-user/production:** Consider:
- Running Dillinger in a separate VM or system
- Using Docker-in-Docker instead of socket mounting
- Setting up proper user authentication (not yet implemented)

### Network Exposure

By default, Dillinger runs on `0.0.0.0:3010`, meaning it's accessible from your network.

**To restrict to localhost only:**
```bash
docker run -d \
  --name dillinger \
  -p 127.0.0.1:3010:3010 \
  ... (rest of the command)
```

### Firewall Configuration

If you want to access Dillinger from other devices, ensure port 3010 is allowed:

```bash
# Ubuntu/Debian with ufw
sudo ufw allow 3010/tcp

# Firewalld (Fedora/RHEL)
sudo firewall-cmd --permanent --add-port=3010/tcp
sudo firewall-cmd --reload
```

## 🐛 Troubleshooting

### Container Won't Start

Check logs:
```bash
docker logs dillinger
```

Common issues:
- Port 3010 already in use → Change `-p 3010:3010` to `-p 3011:3010`
- Docker socket not accessible → Make sure you're in the `docker` group

### Can't Download Runners

1. Check your internet connection
2. Verify Docker can pull images: `docker pull alpine`
3. Check Dillinger has access to Docker socket

### Games Won't Launch

1. Ensure the runner image is downloaded (check Platforms page)
2. Check the game executable path is correct
3. View container logs in the Dillinger UI

### Performance Issues

- Ensure you have sufficient RAM (8GB+ recommended)
- GPU acceleration may require additional Docker setup
- Close unused game containers

## 📝 Data Location

All Dillinger data is stored in the `/data` directory inside the container, which maps to:

- **Named volume**: Managed by Docker (usually `/var/lib/docker/volumes/dillinger_data/_data`)
- **Bind mount**: Your specified directory

Data structure:
```
/data/
├── storage/
│   ├── games/           # Game metadata
│   ├── platforms/       # Platform configs
│   ├── collections/     # Custom collections
│   └── sessions/        # Play sessions
├── bios/                # Emulator BIOS files
├── saves/               # Game saves
└── logs/                # Application logs
```

## 🔄 Updating Dillinger

To update to the latest version:

```bash
# Stop the current container
docker stop dillinger
docker rm dillinger

# Pull the latest image
docker pull ghcr.io/thrane20/dillinger/core:latest

# Start with the same command as before
docker run -d \
  --name dillinger \
  -p 3010:3010 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v dillinger_data:/data \
  --restart unless-stopped \
  ghcr.io/thrane20/dillinger/core:latest
```

Your data is preserved in the volume.

## ❓ Getting Help

- **Issues**: https://github.com/Thrane20/dillinger/issues
- **Discussions**: https://github.com/Thrane20/dillinger/discussions
- **Documentation**: https://github.com/Thrane20/dillinger

---

Happy gaming! 🎮
