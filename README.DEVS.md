# Dillinger Developer Guide 🛠️

> Building and developing Dillinger locally

## 📋 Prerequisites

### Required
- **Node.js 20+** (Dillinger uses Node 20 features)
- **pnpm 10+** (Package manager)
- **Docker** (For building and testing runner images)
- **Git**

### Recommended
- **VS Code** with TypeScript and ESLint extensions
- **Docker Compose** (for testing)
- **8GB+ RAM** (for building containers)

## 🚀 Initial Setup

### 1. Clone the Repository

```bash
git clone https://github.com/Thrane20/dillinger.git
cd dillinger
```

### 2. Install Dependencies

```bash
# Install pnpm if you don't have it
npm install -g pnpm

# Install all workspace dependencies
pnpm install
```

### 3. Build Shared Libraries

The core application depends on the `@dillinger/shared` package:

```bash
pnpm build:shared
```

## 🏗️ Project Structure

```
dillinger/
├── packages/
│   ├── dillinger-core/          # Main Next.js application
│   │   ├── app/                 # Next.js app router
│   │   ├── lib/                 # Backend services
│   │   └── Dockerfile           # Core app container
│   ├── shared/                  # Shared TypeScript library
│   │   └── src/                 # Types, schemas, utilities
│   └── runner-images/           # Docker images for platforms
│       ├── base/                # Base runner image
│       ├── wine/                # Windows games
│       ├── vice/                # C64 emulation
│       ├── retroarch/           # Multi-system emulation
│       ├── fs-uae/              # Amiga emulation
│       ├── retroarch/           # RetroArch with libretro cores (MAME, etc)
│       └── linux-native/        # Native Linux games
├── scripts/
│   └── publish.sh               # Publishing script
├── versioning.env               # Image versions
├── package.json                 # Root workspace config
└── pnpm-workspace.yaml          # pnpm workspace definition
```

## 💻 Development Workflow

### Running the Development Server

```bash
# Start the Next.js dev server with hot reload
pnpm dev

# The app will be available at http://localhost:3010
```

By default, dev mode writes data and logs under `packages/dillinger-core/data`.
To override the dev data root, set `DILLINGER_ROOT_DEV`:

```bash
DILLINGER_ROOT_DEV=/data pnpm dev
```

This runs the core application in development mode with:
- Hot module reloading
- TypeScript type checking
- API routes on `/api/*`

### Type Checking

```bash
# Check types across all packages
pnpm type-check
```

### Linting

```bash
# Run ESLint
pnpm lint
```

### Formatting

```bash
# Format all code with Prettier
pnpm format
```

### Running Tests

```bash
# Run all tests
pnpm test
```

## 🐳 Building Docker Images

### Core Application

Build the main Dillinger container:

```bash
# Build only
pnpm docker:build:core

# This builds: ghcr.io/thrane20/dillinger/core:latest
```

The core Dockerfile uses a multi-stage build:
1. **Builder stage**: Installs deps and builds Next.js
2. **Runtime stage**: Arch Linux base with Node.js

### Runner Images

Build individual runner images:

```bash
# Build base runner (required by all others)
pnpm docker:build:base

# Build specific runners
pnpm docker:build:wine
pnpm docker:build:vice
pnpm docker:build:retroarch
pnpm docker:build:fs-uae
pnpm docker:build:retroarch
pnpm docker:build:linux-native

# Build all runners sequentially
pnpm docker:build:all

# Build all runners in parallel (faster, uses more RAM)
pnpm docker:build:parallel
```

All runner images extend `ghcr.io/thrane20/dillinger/runner-base` which includes:
- X11 server (Xvfb, Xorg)
- GPU drivers (Mesa, Vulkan)
- Audio (PulseAudio)
- Wolf streaming server
- Input support (gamepad, keyboard, mouse)

## 📦 Publishing Images

### Authentication

First, login to GitHub Container Registry:

```bash
# Create a GitHub PAT with `write:packages` scope at:
# https://github.com/settings/tokens/new

# Login (or source from .env)
echo "YOUR_TOKEN" | docker login ghcr.io -u YOUR_USERNAME --password-stdin
```

### Version Management

All image versions are defined in `versioning.env`:

```bash
# View current versions
pnpm -w run publish:versions

# Edit versioning.env to bump versions before publishing
```

### Publishing Commands

```bash
# Build and push core
pnpm -w run publish:core:build

# Build and push all runners
pnpm -w run publish:runners:build

# Build and push everything (core + all runners)
pnpm -w run publish:all:build

# Publish individual runners
pnpm -w run publish:wine:build
pnpm -w run publish:vice:build
pnpm -w run publish:retroarch:build
pnpm -w run publish:fs-uae:build
pnpm -w run publish:retroarch:build
pnpm -w run publish:linux-native:build
```

Each publish command:
1. Optionally builds the image (`:build` suffix)
2. Tags with both version (from `versioning.env`) and `latest`
3. Pushes both tags to ghcr.io

See [docs/GHCR_PUBLISHING.md](docs/GHCR_PUBLISHING.md) for detailed publishing docs.

## 🧪 Testing Locally

### Test the Full Stack

1. Build the core image:
   ```bash
   pnpm docker:build:core
   ```

2. Run it locally:
   ```bash
   docker run -d \
     --name dillinger-dev \
     -p 3010:3010 \
     -v /var/run/docker.sock:/var/run/docker.sock \
     -v dillinger_dev_data:/data \
     ghcr.io/thrane20/dillinger/core:latest
   ```

3. Build a runner to test:
   ```bash
   pnpm docker:build:wine
   ```

4. Access the UI at http://localhost:3010
5. Go to Platforms and verify the Wine runner appears

### View Logs

```bash
# Core app logs
docker logs dillinger-dev

# Follow logs in real-time
docker logs -f dillinger-dev
```

### Cleanup

```bash
docker rm -f dillinger-dev
docker volume rm dillinger_dev_data
```

## 📝 Code Style Guide

### TypeScript
- Use TypeScript strict mode
- Prefer `interface` over `type` for objects
- Use explicit return types for functions
- Avoid `any` - use `unknown` if necessary

### React/Next.js
- Use functional components with hooks
- Prefer `async/await` over `.then()`
- Keep components small and focused
- Use Server Components by default, Client Components when needed

### File Organization
```
app/
├── page.tsx                    # Route page
├── layout.tsx                  # Layout wrapper
├── components/                 # Page-specific components
│   └── ComponentName.tsx
├── api/                        # API routes
│   └── route-name/
│       └── route.ts
└── utils/                      # Route-specific utilities
```

### Naming Conventions
- **Components**: PascalCase (`GameCard.tsx`)
- **Utilities**: camelCase (`formatDate.ts`)
- **Constants**: UPPER_SNAKE_CASE (`DEFAULT_PORT`)
- **Types/Interfaces**: PascalCase (`GameMetadata`)

## 🔧 Working on Runner Images

### Runner Image Structure

Each runner follows this pattern:

```dockerfile
FROM ghcr.io/thrane20/dillinger/runner-base:latest

# Install platform-specific software
RUN pacman -S --noconfirm wine

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
```

### Testing a Runner Locally

```bash
# Build the runner
cd packages/runner-images/wine
docker build -t test-wine .

# Run it with a mounted game directory
docker run --rm -it \
  -v /path/to/game:/game \
  -e GAME_EXECUTABLE=/game/game.exe \
  test-wine
```

### Adding a New Runner

1. Create directory in `packages/runner-images/`
2. Add `Dockerfile` extending `runner-base`
3. Add `build.sh` script
4. Add entrypoint script for platform-specific setup
5. Add to root `package.json` scripts
6. Add to `versioning.env`
7. Update `scripts/publish.sh`
8. Add to API routes in `dillinger-core/app/api/runners/route.ts`

## 🌊 Git Workflow

### Branch Strategy

- `main` - Production-ready code
- `dev` - Development branch
- `feature/*` - New features
- `fix/*` - Bug fixes

### Commit Messages

Follow conventional commits:

```
feat: add RetroArch runner support
fix: resolve Wine virtual desktop sizing
docs: update developer guide
chore: bump dependencies
```

### Pull Request Process

1. Create feature branch from `main`
2. Make changes and commit
3. Run `pnpm type-check` and `pnpm lint`
4. Push and open PR
5. Wait for review and CI checks

## 🏃 Scripts Reference

All scripts use `pnpm -w run <script>` from any directory, or `pnpm <script>` from root.

### Development
- `dev` - Start Next.js dev server
- `build` - Build all packages for production
- `start` - Start production server

### Quality
- `type-check` - TypeScript type checking
- `lint` - Run ESLint
- `format` - Format code with Prettier
- `test` - Run tests

### Docker Build
- `docker:build:core` - Build core app
- `docker:build:base` - Build runner base
- `docker:build:wine` - Build Wine runner
- `docker:build:all` - Build all runners
- (See `package.json` for full list)

### Publishing
- `publish:versions` - Show versions
- `publish:core:build` - Build & push core
- `publish:all:build` - Build & push everything
- (See `package.json` for individual runners)

## 🔍 Debugging

### Next.js Debugging

Add to your VS Code `launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Next.js: debug server-side",
  "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/next",
  "runtimeArgs": ["dev"],
  "port": 9229,
  "console": "integratedTerminal",
  "cwd": "${workspaceFolder}/packages/dillinger-core"
}
```

### Docker Debugging

```bash
# Enter running container
docker exec -it dillinger-dev /bin/bash

# Inspect image layers
docker history ghcr.io/thrane20/dillinger/core:latest

# Check build logs
docker build --progress=plain -t test .
```

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Docker Documentation](https://docs.docker.com/)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 🐛 Known Issues

- Hot reload may be slow with large game libraries
- Docker socket access requires careful permission management
- Some Wine games need specific Wine versions (future work)

## 🤝 Contributing

See the main [README.md](README.md) for contribution guidelines.

---

Happy coding! 🚀
