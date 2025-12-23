# Multi-stage build for Dillinger Core (Next.js App Router)

# 1) Build stage using Node for faster installs
FROM node:20-bullseye AS builder
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@10.4.0 --activate

# Copy workspace manifests first for better caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./

# Copy package manifests so pnpm can resolve workspaces without full source
COPY packages/shared/package.json ./packages/shared/
COPY packages/dillinger-core/package.json ./packages/dillinger-core/

# Install dependencies (workspace-aware)
RUN pnpm install --frozen-lockfile

# Copy full source for the build
COPY packages ./packages

# Build shared libraries consumed by Dillinger Core
RUN pnpm --filter=@dillinger/shared run build

# Build the Next.js application
WORKDIR /app/packages/dillinger-core
ENV NODE_ENV=production
RUN pnpm run build

# 2) Runtime stage on Arch Linux base image
FROM archlinux:base AS runner

# Build-time argument for version (passed from build script)
ARG VERSION=unknown

ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    PORT=3010 \
    DILLINGER_ROOT=/data

# Add version label
LABEL version="${VERSION}" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.title="Dillinger Core" \
      org.opencontainers.image.description="Dillinger Gaming Platform - Core Application"

# Install Node.js LTS, pulseaudio-utils (for pactl), and docker CLI, clean up package cache
RUN pacman -Sy --noconfirm --needed nodejs pulseaudio docker && \
    pacman -Scc --noconfirm

# Create a user/group that can access the Docker socket
# The GID should match the host's docker group (usually 999 or similar)
# We'll run as root for now to avoid socket permission issues
# In production, consider adding: RUN groupadd -g 999 docker && useradd -m -g docker dillinger

WORKDIR /app

# Copy the standalone build (includes server.js and bundled node_modules)
COPY --from=builder /app/packages/dillinger-core/.next/standalone ./
# Copy static files to the correct location relative to server.js
COPY --from=builder /app/packages/dillinger-core/.next/static ./packages/dillinger-core/.next/static

# Copy worker scripts that are not bundled by Next.js standalone output
RUN mkdir -p ./packages/dillinger-core/lib/workers
COPY --from=builder /app/packages/dillinger-core/lib/workers/download-worker.js ./packages/dillinger-core/lib/workers/download-worker.js

# Create empty public directory where server.js expects it
RUN mkdir -p ./packages/dillinger-core/public

# Copy default templates/assets used for first-run scaffolding
# This includes platform configs at assets/defaults/platforms/
COPY --from=builder /app/packages/dillinger-core/assets ./packages/dillinger-core/assets

# Create data directory for persistent JSON storage
RUN mkdir -p "$DILLINGER_ROOT"
VOLUME ["/data"]

EXPOSE 3010

# Start the standalone Next.js server
CMD ["node", "packages/dillinger-core/server.js"]
