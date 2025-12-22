# Dillinger Docker Production Build

This document describes how to build and run the Dillinger application as a single Docker container.

## Overview

The Docker image combines both the backend API and frontend Next.js application into a single container that:
- Exposes port **4000** for the web application
- Runs the backend API internally on port **4001**
- Proxies `/api` requests from the frontend to the backend
- Uses PM2 for process management to run both services
- Mounts the `dillinger_library` Docker volume for persistent JSON data storage

## Building the Image

### Quick Build

Use the provided build script:

```bash
./build-docker.sh
```

### Manual Build

Build the image manually:

```bash
docker build -t dillinger-core:latest -f packages/dillinger-core/Dockerfile .
```

The build process uses multi-stage builds to:
1. Install all dependencies
2. Build the shared package
3. Build the backend TypeScript code
4. Build the frontend Next.js application
5. Create a minimal runtime image with only production dependencies

## Running the Container

### Using Docker Compose (Recommended)

1. First, ensure the `dillinger_library` volume exists:

```bash
docker volume create dillinger_library
```

2. Start the container using docker-compose:

```bash
docker-compose up -d
```

3. View logs:

```bash
docker-compose logs -f
```

4. Stop the container:

```bash
docker-compose down
```

### Using Docker Run

1. Create the volume:

```bash
docker volume create dillinger_library
```

2. Run the container:

```bash
docker run -d \
  -p 4000:4000 \
  -v dillinger_library:/data \
  --name dillinger \
  thrane20/dillinger:1.0
```

3. View logs:

```bash
docker logs -f dillinger
```

4. Stop and remove the container:

```bash
docker stop dillinger
docker rm dillinger
```

## Configuration

### Environment Variables

The following environment variables can be configured:

- `NODE_ENV` - Environment mode (default: `production`)
- `PORT` - Frontend port (default: `4000`)
- `BACKEND_PORT` - Backend API port (default: `4001`)
- `DATA_PATH` - Path to data directory (default: `/data`)
- `FRONTEND_URL` - Frontend URL for CORS (default: `http://localhost:4000`)

Example with custom configuration:

```bash
docker run -d \
  -p 8080:8080 \
  -e PORT=8080 \
  -e BACKEND_PORT=8081 \
  -v dillinger_library:/data \
  --name dillinger \
  thrane20/dillinger:1.0
```

### Data Persistence

All game library data is stored in the `dillinger_library` Docker volume, which is mounted at `/data` inside the container. This includes:
- Game metadata (JSON files)
- Platform information
- Collections
- User data

To backup the data:

```bash
docker run --rm -v dillinger_library:/data -v $(pwd):/backup alpine tar czf /backup/dillinger-backup.tar.gz -C /data .
```

To restore from backup:

```bash
docker run --rm -v dillinger_library:/data -v $(pwd):/backup alpine sh -c "cd /data && tar xzf /backup/dillinger-backup.tar.gz"
```

## Accessing the Application

Once the container is running:

- **Web Application**: http://localhost:4000
- **API Health Check**: http://localhost:4000/api/health
- **API Endpoints**: http://localhost:4000/api/*

## Health Checks

The container includes a health check that monitors the API health endpoint. The health check runs every 30 seconds and will mark the container as unhealthy if the API doesn't respond.

Check container health:

```bash
docker inspect --format='{{.State.Health.Status}}' dillinger
```

## Troubleshooting

### Container won't start

Check the logs:

```bash
docker logs dillinger
```

### Port already in use

If port 4000 is already in use, you can map to a different port:

```bash
docker run -d -p 8080:4000 -v dillinger_library:/data --name dillinger thrane20/dillinger:1.0
```

Then access the application at http://localhost:8080

### Data not persisting

Ensure the volume is properly mounted:

```bash
docker inspect dillinger | grep -A 10 Mounts
```

### PM2 processes not running

Exec into the container and check PM2 status:

```bash
docker exec -it dillinger pm2 list
docker exec -it dillinger pm2 logs
```

## Development vs Production

This Dockerfile is for **production use**. For development, use:

```bash
pnpm run docker:dev
```

This uses the `docker-compose.dev.yml` file which includes hot-reloading and development features.

## Architecture

```
┌─────────────────────────────────────────────┐
│         Docker Container (Port 4000)         │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │  Next.js Frontend (Port 4000)          │ │
│  │  - Serves web application              │ │
│  │  - Proxies /api/* to backend           │ │
│  └────────────────────────────────────────┘ │
│                    ↓                         │
│  ┌────────────────────────────────────────┐ │
│  │  Express Backend API (Port 4001)       │ │
│  │  - Handles /api/* endpoints            │ │
│  │  - Manages game library data           │ │
│  └────────────────────────────────────────┘ │
│                    ↓                         │
│  ┌────────────────────────────────────────┐ │
│  │  Data Volume: dillinger_library        │ │
│  │  Mounted at: /data                     │ │
│  │  - JSON data files                     │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

## Image Details

- **Base Image**: node:18-slim
- **Process Manager**: PM2
- **Package Manager**: pnpm 8.15.0
- **Node Version**: 18.x
- **User**: dillinger (non-root, UID 1001)
- **Working Directory**: /app
- **Exposed Port**: 4000
- **Health Check**: Every 30s via /api/health

## Security

The container runs as a non-root user (dillinger:nodejs) for improved security. The data directory is owned by this user to allow write access for the application.
