# Multi-stage build for Dillinger Core (Next.js App Router)

# 1) Build stage using Node for faster installs
FROM node:18-bullseye AS builder
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@10.4.0 --activate

# Copy workspace manifests first for better caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./

# Copy package manifests so pnpm can resolve workspaces without full source
COPY packages/shared/package.json ./packages/shared/
COPY packages/dillinger-core/package.json ./packages/dillinger-core/
COPY packages/dillinger-core/backend/package.json ./packages/dillinger-core/backend/
COPY packages/dillinger-core/frontend/package.json ./packages/dillinger-core/frontend/

# Install dependencies (workspace-aware)
RUN pnpm install --frozen-lockfile

# Copy full source for the build
COPY packages ./packages

# Build shared libraries consumed by the frontend
RUN pnpm --filter=@dillinger/shared run build

# Build the Next.js application
WORKDIR /app/packages/dillinger-core/frontend
ENV NODE_ENV=production
RUN pnpm run build

# 2) Runtime stage on Arch Linux base image
FROM archlinux:base AS runner
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    PORT=3010 \
    DILLINGER_ROOT=/data

# Install Node.js LTS, pulseaudio-utils (for pactl), and docker CLI, clean up package cache
RUN pacman -Sy --noconfirm --needed nodejs pulseaudio docker && \
    pacman -Scc --noconfirm

WORKDIR /app

# Copy the standalone build (includes server.js and bundled node_modules)
COPY --from=builder /app/packages/dillinger-core/frontend/.next/standalone ./
# Copy static files to the correct location relative to server.js
COPY --from=builder /app/packages/dillinger-core/frontend/.next/static ./packages/dillinger-core/frontend/.next/static

# Copy worker scripts that are not bundled by Next.js standalone output
RUN mkdir -p ./packages/dillinger-core/frontend/lib/workers
COPY --from=builder /app/packages/dillinger-core/frontend/lib/workers/download-worker.js ./packages/dillinger-core/frontend/lib/workers/download-worker.js

# Create empty public directory where server.js expects it
RUN mkdir -p ./packages/dillinger-core/frontend/public

# Create data directory for persistent JSON storage
RUN mkdir -p "$DILLINGER_ROOT"
VOLUME ["/data"]

EXPOSE 3010

# Start the standalone Next.js server
CMD ["node", "packages/dillinger-core/frontend/server.js"]
