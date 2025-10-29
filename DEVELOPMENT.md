# Development — Running Dillinger locally (dev)

This document explains how to run the Dillinger core web site in development, and how to launch a `dillinger-runner` (game runner) on-demand.

It covers both the quick local (pnpm) workflow and the Docker Compose dev environment.

---

## Quick summary

- Run the core web site (frontend + backend) locally with pnpm: `pnpm run dev` from repo root.
- The app uses a JSON-based dev data directory at `./data` (controlled by `DATA_PATH`).
- The `dillinger-runner` is a separate process/container responsible for launching games; it is started on demand. We provide a recommended Docker Compose service example to start it when needed.

---

## Prerequisites

- Node.js 18+
- pnpm 8+
- Docker & Docker Compose (if you want to use Docker dev environment)
- Optional: jq, curl (for quick checks)

---

## 1) Run the core site locally (fast development)

This is the fastest workflow for editing frontend and backend code with hot-reload.

1. From repo root, install dependencies (one-time):

```bash
pnpm install
pnpm run build:shared   # builds the shared TypeScript package used by frontend/backend
```

2. Start both frontend and backend in parallel (recommended):

```bash
pnpm run dev
```

What the `dev` script does:
- Sets `DATA_PATH` to the project `data/` directory (used by the backend JSON storage)
- Starts the backend (Express) and frontend (Next.js) in parallel

Important notes:
- Backend: http://localhost:3001
- Frontend: http://localhost:3000
- The frontend rewrites `/api/*` to the backend in dev, so requests from the browser like `/api/health` are proxied to the backend.
- If you prefer to run services individually you can:

```bash
pnpm run dev:backend   # start backend only
pnpm run dev:frontend  # start frontend only
```

Environment variables you may want to set locally:
- DATA_PATH — where JSON files are stored (default in dev: `./data`) 
- FRONTEND_URL — URL used by backend CORS (default `http://localhost:3000`)

Example starting with explicit DATA_PATH:

```bash
DATA_PATH=$(pwd)/data pnpm run dev
```

Troubleshooting:
- Permission errors creating `/data`: use a project-local path via `DATA_PATH=./data` (that's the default in the provided scripts).
- If ports are in use, Next.js will try the next port (3001, 3002...). Backend expects 3001 by default; update `FRONTEND_URL` or `NEXT_PUBLIC_API_URL` if you change ports.

---

## 2) Run in Docker Compose dev (closer to production and isolates environment)

The repo includes `docker-compose.dev.yml` and Dockerfiles for frontend, backend and a `shared-build` helper image. This launches three services:

- `shared-build` — builds the `@dillinger/shared` TypeScript package
- `backend-dev` — Express backend (hot-reload)
- `frontend-dev` — Next.js frontend (hot-reload)

### Start Docker dev

From repo root:

```bash
pnpm run docker:dev
```

This will build images and start containers. Open:
- Frontend: http://localhost:3000
- Backend (direct): http://localhost:3001

Notes about Docker networking and proxying:
- The frontend's Next.js rewrites are configured to proxy `/api/*` to the backend. In the Docker environment it uses the internal container host `backend-dev:3001` (configured automatically in `next.config.js` when `DOCKER_ENV=true`).
- If you access the backend from your host (e.g. `curl http://localhost:3001/api/health`), Docker maps the port to host so it will work as well.

Troubleshooting Docker:
- If you see a volume mount error, ensure `data/games` and `data/storage` exist in the repo root (the Docker Compose uses bind mounts). Create them if missing:

```bash
mkdir -p data/games data/storage
```

- If the build errors due to pnpm lockfile, ensure `pnpm-lock.yaml` is present in repo root.

---

## 3) Runner Service

## Running the Dillinger runner (game runner) on demand

The `dillinger-runner` is a separate service that manages containerized game sessions. Now fully implemented as `packages/runner` with Docker integration.

### A) Start runner locally (fast development)

```bash
# Start just the runner service
pnpm run dev:runner
```

The runner will be available at http://localhost:3002

### B) Start runner with Docker (recommended for testing container launches)

```bash
# Start runner container (after core services are running)
pnpm run docker:runner

# Or start everything including runner
docker-compose -f docker-compose.dev.yml --profile runner up --build
```

### C) Test the complete workflow

I've included a complete end-to-end test script:

```bash
# Start core services first
pnpm run dev

# In another terminal, start the runner
pnpm run dev:runner

# In a third terminal, run the end-to-end test
./test-end-to-end.sh
```

What the test does:
1. Checks that core services (backend/frontend) are running
2. Verifies runner service is healthy
3. Creates an example game session via the backend API
4. Monitors the session status
5. Shows Docker containers created by the runner
6. Optionally cleans up the session

### D) API Integration

The backend now provides runner integration endpoints:

- `POST /api/runner/launch` - Create a new game session
- `GET /api/runner/sessions` - List all active sessions  
- `GET /api/runner/sessions/:id` - Get specific session details
- `DELETE /api/runner/sessions/:id` - Stop a session
- `GET /api/runner/health` - Check runner service health

Example creating a session:

```bash
curl -X POST http://localhost:3001/api/runner/launch \
  -H "Content-Type: application/json" \
  -d '{
    "gameId": "my-game-001",
    "userId": "test-user",
    "gameConfig": {"type": "example"}
  }'
```

---

## 6) Environment variables of interest

1. Install deps & build shared package:

```bash
pnpm install
pnpm run build:shared
```

2a. Quick local development (3 terminals):

```bash
# Terminal 1 - Core services
pnpm run dev

# Terminal 2 - Runner service  
pnpm run dev:runner

# Terminal 3 - Test the integration
./test-end-to-end.sh
```

2b. Or: run everything with Docker:

```bash
# Start core services
pnpm run docker:dev

# In another terminal, start runner
pnpm run docker:runner

# Test in browser or with script
./test-end-to-end.sh
```

3. Access the services:
   - Frontend: http://localhost:3000
   - Backend: http://localhost:3001  
   - Runner: http://localhost:3002

---

## 6) Environment variables of interest

- `DATA_PATH` — where JSON storage writes data (defaults to repo `data/` in dev)
- `FRONTEND_URL` — backend CORS origin, default `http://localhost:3000`
- `NEXT_PUBLIC_API_URL` — frontend's API base when not using rewrites
- `DOCKER_ENV` — when `true`, Next.js rewrites route to container host `backend-dev`
- `RUNNER_URL` — backend uses this to call runner APIs (default `http://localhost:3002`)

---

## 7) Troubleshooting & tips

- If the frontend is unstyled: ensure Tailwind files exist and restart Next.js dev (we added `tailwind.config.js` and `postcss.config.js`).
- If proxying fails in Docker: confirm the frontend container sees `backend-dev:3001` (the container network is managed by Compose). The frontend sets `DOCKER_ENV=true` in `docker-compose.dev.yml` to make rewrites use the service name.
- If ports are occupied: Next.js may try subsequent ports. Confirm backend remains on 3001 or update `NEXT_PUBLIC_API_URL`.
- If the runner fails to start containers: ensure Docker socket is accessible (`/var/run/docker.sock`) and the user has Docker permissions.
- If runner service is unreachable: check that port 3002 is available and `RUNNER_URL` is correct in backend.

---

## 8) Example commands for testing

Here are some useful commands for testing the complete system:

```bash
# Check all service health
curl http://localhost:3001/api/health     # Backend
curl http://localhost:3000               # Frontend  
curl http://localhost:3002/health        # Runner

# Create a game session
curl -X POST http://localhost:3001/api/runner/launch \
  -H "Content-Type: application/json" \
  -d '{"gameId": "test-game", "gameConfig": {"type": "example"}}'

# List active sessions
curl http://localhost:3001/api/runner/sessions

# Check Docker containers
docker ps --filter "label=dillinger.type=game-session"

# View container logs
docker logs dillinger-game-<session-id>
``` 
