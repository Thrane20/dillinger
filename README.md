# Dillinger 🎮

> Your Personal Gaming Platform for Linux - Making Game Management Simple

[![GitHub](https://img.shields.io/badge/GitHub-Thrane20%2Fdillinger-blue)](https://github.com/Thrane20/dillinger)
[![Docker](https://img.shields.io/badge/Docker-ghcr.io-blue)](https://github.com/Thrane20/dillinger/pkgs/container/dillinger%2Fcore)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## 🌟 What is Dillinger?

Dillinger is a **self-hosted game library manager** designed to make gaming on Linux effortless. Whether you're running Windows games through Wine, classic games via emulators, or native Linux titles, Dillinger gives you one beautiful interface to manage and launch everything.

### Why Dillinger is Amazing

**🎯 One Place for Everything**
- Manage Windows, Linux, DOS, Amiga, C64, Arcade, and console games in one unified library
- No more juggling between Steam, Lutris, RetroArch, and file managers
- Beautiful web interface accessible from any device on your network

**🐳 Containerized Gaming**
- Each game runs in its own isolated Docker container
- No system pollution - games can't mess with your OS
- Different Wine versions, emulators, and configurations per game
- Clean uninstalls - just delete the container

**🚀 Zero Configuration for Users**
- Pull one Docker image and you're ready to go
- Web-based UI - no desktop apps to install
- Download game runners (Wine, emulators) directly from the interface
- Automatic metadata and cover art fetching

**🎮 Real Streaming Built-In**
- Full desktop environment streamed to your browser
- Play games remotely from any device
- Powered by Wolf (Moonlight protocol) for low-latency streaming
- No client software needed - just open your browser

**💡 Perfect For**
- Linux gamers who want Windows game support
- Retro gaming enthusiasts managing ROM collections
- Home server users who want a gaming hub
- Anyone tired of complex Wine/Proton configurations
- People who want gaming in Docker containers

## 🎮 Supported Platforms

| Platform | Runner | Status |
|----------|--------|--------|
| **Windows Games** | Wine/Proton | ✅ Ready |
| **Native Linux** | Native | ✅ Ready |
| **Commodore 64/128** | VICE | ✅ Ready |
| **Amiga** | FS-UAE | ✅ Ready |
| **Arcade** | MAME | ✅ Ready |
| **Multi-System** | RetroArch | ✅ Ready |

Each platform runs in its own optimized Docker container with full GPU acceleration, audio, and controller support.

## 🚀 Quick Start

### For Users
Just want to play games? See **[README.USERS.md](README.USERS.md)** for step-by-step setup instructions.

### For Developers
Want to build or contribute? See **[README.DEVS.md](README.DEVS.md)** for development setup.

### One-Command Start

```bash
# Download and run the start script
curl -fsSL https://raw.githubusercontent.com/Thrane20/dillinger/main/start-dillinger.sh | bash
```

Or manually:

```bash
docker pull ghcr.io/thrane20/dillinger/core:latest
docker run -d \
  --name dillinger \
  -p 3010:3010 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v dillinger_data:/data \
  ghcr.io/thrane20/dillinger/core:latest
```

Then open http://localhost:3010 in your browser.

## 📚 How It Works

1. **Dillinger Core** - The main web app running in Docker
   - Next.js web interface on port 3010
   - Manages your game library (metadata, covers, collections)
   - Controls Docker to launch game containers

2. **Runner Images** - Specialized containers for each platform
   - Wine runner for Windows games
   - VICE for C64/C128
   - MAME for arcade games
   - RetroArch for multi-system emulation
   - Each includes GPU drivers, audio, streaming support

3. **Your Games** - Stored in Docker volumes
   - Install games through the UI
   - Games persist across container restarts
   - Easily backup by backing up Docker volumes

## 🎨 Screenshots

*Coming soon - web interface with game library, launch screen, and settings*

## 🔧 Key Features

### Library Management
- Add games from local files, URLs, or online sources (GOG)
- Automatic metadata scraping (IGDB, OpenVGDB)
- Custom collections and tags
- Search and filter across your entire library

### Platform Support
- **Windows**: Full Wine/Proton support with virtual desktop
- **Emulation**: Integrated emulators for retro platforms
- **Native Linux**: Direct execution for Linux games
- **Streaming**: Wolf-based low-latency game streaming

### Game Execution
- One-click launch from web interface
- Per-game configuration (Wine version, resolution, etc.)
- Container-based isolation
- Automatic cleanup after gaming sessions

### Online Integration
- GOG library import and game downloads
- Metadata fetching from multiple sources
- Cover art and screenshots
- Community-curated game configs

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│  Browser (localhost:3010)                       │
│  - Game Library UI                              │
│  - Settings & Config                            │
│  - Game Streaming View                          │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│  Dillinger Core (Next.js + Docker API)         │
│  - Manages game metadata                        │
│  - Controls Docker containers                   │
│  - Serves web interface                         │
└────────────────┬────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
┌───────▼──────┐  ┌──────▼────────┐
│ Runner: Wine │  │ Runner: VICE  │  ...
│ (Windows)    │  │ (C64)         │
└──────────────┘  └───────────────┘
```

## 📖 Documentation

- **[User Guide](README.USERS.md)** - Installation and usage
- **[Developer Guide](README.DEVS.md)** - Build and development
- **[Publishing Guide](docs/GHCR_PUBLISHING.md)** - Docker image publishing
- **[Architecture](ARCHITECTURE.md)** - System design (if exists)

## 🤝 Contributing

Contributions welcome! Whether it's:
- 🐛 Bug reports and fixes
- ✨ New features and runners
- 📝 Documentation improvements
- 🎨 UI/UX enhancements

See [README.DEVS.md](README.DEVS.md) for development setup.

## 📜 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Credits

Built with:
- [Wolf](https://github.com/games-on-whales/wolf) - Game streaming
- [Next.js](https://nextjs.org/) - Web framework
- [Docker](https://www.docker.com/) - Containerization
- [VICE](https://vice-emu.sourceforge.io/) - C64 emulation
- [FS-UAE](https://fs-uae.net/) - Amiga emulation
- [MAME](https://www.mamedev.org/) - Arcade emulation
- [RetroArch](https://www.retroarch.com/) - Multi-system emulation

---

**Made with ❤️ for Linux gamers who want simplicity**
