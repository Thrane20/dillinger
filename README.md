# Dillinger 🎮

> A comprehensive game library management platform with cross-platform execution and containerized gaming environments

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14+-black.svg)](https://nextjs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.x-green.svg)](https://expressjs.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![pnpm](https://img.shields.io/badge/pnpm-8+-orange.svg)](https://pnpm.io/)

## 🎯 What is Dillinger?

Dillinger is a modern game library management platform that allows you to:

- **Organize** your entire game collection across multiple platforms and formats
- **Launch** games in containerized environments with desktop streaming capabilities
- **Manage** game metadata, collections, and play sessions
- **Stream** games to any device with full desktop environment support
- **Track** gaming statistics and performance metrics

Perfect for gamers who want a unified interface to manage games from different sources (Steam, Epic, local files, emulated games, etc.) with the power of containerized execution.

## ✨ Key Features

### 🎮 Game Management
- **Universal Library**: Add games from any source - Steam, Epic, local files, ROMs
- **Smart Metadata**: Automatic metadata fetching and manual customization
- **Collections**: Organize games into custom collections and categories
- **Search & Filter**: Advanced search with filters by platform, genre, tags

### 🐳 Containerized Execution
- **Isolated Environments**: Each game runs in its own Docker container
- **Desktop Streaming**: Full desktop environment streamed to your browser
- **Games on Whales Integration**: Powered by industry-leading streaming technology
- **Cross-Platform**: Run Windows games on Linux, legacy games on modern systems

### 📊 Analytics & Tracking
- **Session Management**: Track play time and performance metrics
- **Statistics**: Detailed analytics on gaming habits and preferences
- **Performance Monitoring**: Real-time system resource monitoring during gameplay

### 🎨 Modern Interface
- **Responsive Design**: Beautiful, mobile-friendly web interface
- **Real-time Updates**: Live status updates and notifications
- **Customizable**: Themes, layouts, and personalization options

## 🏗️ Architecture

Dillinger is built as a modern monorepo with the following structure:

```
dillinger/
├── apps/
│   └── dillinger-core/      # Main application
│       ├── backend/          # Express.js API server
│       └── frontend/         # Next.js web application
├── packages/
│   ├── runner-types/        # TypeScript types for game execution
│   ├── runner-images/       # Docker images for running games
│   │   ├── linux-native/    # Native Linux game runner
│   │   └── wine/            # Windows game runner via Wine
│   ├── validation/          # Input validation schemas
│   └── shared-legacy/       # Legacy shared utilities
├── docker/                  # Docker configurations
├── data/                    # JSON-based data storage (development)
└── specs/                   # Feature specifications and plans
```

### Runner Architecture

Dillinger uses a **simplified runner architecture** where each runner is a Docker container image:

- **No API Layer**: Runners are Docker images, not API services
- **Direct Execution**: Games run directly in containers with mounted volumes
- **Multiple Runner Types**: Different images for different game platforms
- **Isolated Sessions**: Each game runs in its own container

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed documentation.

### Technology Stack

**Backend:**
- **Node.js 18+** with **TypeScript 5.x**
- **Express.js** for REST API
- **JSON File Storage** (development) / **PostgreSQL** (production)
- **Docker Integration** for game containerization
- **WebSocket** support for real-time updates

**Frontend:**
- **Next.js 14+** with **App Router**
- **React 18** with **TypeScript**
- **TailwindCSS** for responsive styling
- **SWR** for data fetching and caching
- **React Hook Form** for form management

**Infrastructure:**
- **Docker & Docker Compose** for containerization
- **pnpm Workspaces** for monorepo management
- **Games on Whales** for desktop streaming
- **Linux-first** with cross-platform support

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+**
- **pnpm 8+**
- **Docker & Docker Compose**
- **Linux** (recommended) or **macOS/Windows** with WSL2

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Thrane20/dillinger.git
   cd dillinger
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

## 🛠️ Debugging game launches

If a game container starts and exits immediately (or you want to inspect mounts/logs), you can prevent Docker from auto-removing it.

- **Keep the container:** call `POST /api/games/:id/launch` with JSON body including `"keepContainer": true`.
- **Find recent Dillinger containers:**
   ```bash
   docker ps -a --filter "name=dillinger-session-" --format '{{.ID}} {{.Image}} {{.Status}} {{.Names}}'
   ```
- **View logs / mounts / shell:**
   ```bash
   docker logs <containerId>
   docker inspect <containerId> | jq '.[0].HostConfig.Binds'
   docker exec -it <containerId> /bin/bash
   ```

3. **Build shared packages:**
   ```bash
   pnpm run build:shared
   ```

4. **Create the foundational Docker volume:**
   ```bash
   # The dillinger_root volume is required for all data storage
   # In development, it will be auto-created on first run, but you can create it manually:
   docker volume create \
     --driver local \
     --opt type=none \
     --opt device=$(pwd)/packages/dillinger-core/backend/data \
     --opt o=bind \
     dillinger_root
   ```

5. **Start development servers:**
   ```bash
   pnpm run dev
   ```

6. **Open your browser:**
   - Frontend: http://localhost:3010
   - Backend API: http://localhost:3011
   - Health Check: http://localhost:3011/api/health

### Docker Development

For a complete containerized development environment:

```bash
# First, ensure the dillinger_root volume exists
docker volume create dillinger_root

# Start all services with Docker Compose
pnpm run docker:dev

# Stop all services
pnpm run docker:down
```

**Note**: The `dillinger_root` volume is the foundational volume where all JSON database files are stored. See [docs/DILLINGER_ROOT_VOLUME.md](docs/DILLINGER_ROOT_VOLUME.md) for detailed information.

## 📚 Usage

### Adding Your First Game

1. **Navigate to "Add Game"** in the web interface
2. **Select a game file** or provide a path to your game executable
3. **Choose a platform** (Steam, Epic, Local, Emulator, etc.)
4. **Configure metadata** (title, genre, tags, artwork)
5. **Save** and the game will appear in your library

### Launching Games

1. **Browse your library** on the homepage
2. **Click "Play"** on any game card
3. **Wait for container startup** (first launch takes longer)
4. **Game streams** directly to your browser with full desktop access
5. **Play using** keyboard, mouse, or connected controllers

### Managing Collections

1. **Create collections** to organize games by genre, mood, or any criteria
2. **Drag and drop** games between collections
3. **Use collections** for quick filtering and discovery

## 🔧 Development

### Available Scripts

```bash
# Development
pnpm run dev              # Start both frontend and backend
pnpm run dev:backend      # Start only backend API server
pnpm run dev:frontend     # Start only frontend dev server

# Building
pnpm run build            # Build all packages
pnpm run build:shared     # Build shared package only

# Testing & Quality
pnpm run test             # Run all tests
pnpm run type-check       # TypeScript type checking
pnpm run lint             # ESLint code linting
pnpm run format           # Prettier code formatting

# Docker
pnpm run docker:dev       # Start development environment
pnpm run docker:down      # Stop Docker services

# Utilities
pnpm run clean            # Clean all build artifacts
pnpm run setup            # Full setup (install + build + typecheck)
```

### Project Structure

```
packages/
├── shared/
│   ├── src/types/        # TypeScript interfaces and types
│   ├── src/utils/        # Shared utility functions
│   └── src/validation/   # Data validation schemas
├── backend/
│   ├── src/services/     # Business logic and data services
│   ├── src/routes/       # Express route handlers
│   ├── src/middleware/   # Custom Express middleware
│   └── src/scripts/      # Utility scripts and seeders
└── frontend/
    ├── app/              # Next.js app directory (pages and layouts)
    ├── components/       # Reusable React components
    ├── hooks/            # Custom React hooks
    └── lib/              # Frontend utilities and helpers
```

## 🐳 Gaming Architecture

Dillinger uses a sophisticated containerized approach to game execution:

### Container Strategy
- **Isolated Environments**: Each game runs in its own Docker container
- **Desktop Streaming**: Full X11 desktop environment with audio/video streaming
- **Resource Management**: Configurable CPU, memory, and GPU allocation
- **Persistence**: Save games and settings persist between sessions

### Supported Platforms
- **Steam**: Native Steam integration with Proton support
- **Epic Games**: Epic Games Store via Heroic Games Launcher
- **Local Games**: Native Linux games and Windows games via Wine/Proton
- **Emulation**: RetroArch and standalone emulators for retro gaming
- **Custom**: Support for any executable with custom platform definitions

### Streaming Technology
- **Games on Whales**: Industry-leading low-latency game streaming
- **WebRTC**: Direct browser-to-container streaming
- **Input Support**: Keyboard, mouse, and gamepad input forwarding
- **Audio/Video**: High-quality audio and video streaming with configurable bitrates

## 📋 Roadmap

### Phase 1: Foundation ✅
- [x] Monorepo setup with TypeScript
- [x] Express.js backend with JSON storage
- [x] Next.js frontend with TailwindCSS
- [x] Docker development environment

### Phase 2: Core Features 🚧
- [ ] Game addition and metadata management
- [ ] Platform configuration and management
- [ ] Collection organization
- [ ] Basic game launching

### Phase 3: Advanced Features 📅
- [ ] Games on Whales integration
- [ ] Desktop streaming interface
- [ ] Performance monitoring
- [ ] Advanced search and filtering

### Phase 4: Enhancement 📅
- [ ] PostgreSQL production storage
- [ ] User authentication and profiles
- [ ] Cloud save synchronization
- [ ] Mobile companion app

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:

- Code style and standards
- Development workflow
- Testing requirements
- Pull request process

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Ensure all tests pass: `pnpm run test`
5. Check types and linting: `pnpm run type-check && pnpm run lint`
6. Commit your changes: `git commit -m 'Add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Games on Whales** - For the excellent game streaming technology
- **Docker** - For containerization platform
- **Next.js Team** - For the amazing React framework
- **Tailwind CSS** - For the utility-first CSS framework
- **Open Source Community** - For all the amazing tools and libraries

## 📞 Support

- **Documentation**: [Coming Soon]
- **Issues**: [GitHub Issues](https://github.com/Thrane20/dillinger/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Thrane20/dillinger/discussions)

---

**Built with ❤️ for gamers who love organization and technology**