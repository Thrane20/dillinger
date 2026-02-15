FROM node:18-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm config set strict-ssl false && npm install -g pnpm@10.20.0 && npm config set strict-ssl true

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/dillinger-core/package.json ./packages/dillinger-core/

RUN npm config set strict-ssl false && pnpm config set strict-ssl false && pnpm install --frozen-lockfile && pnpm config set strict-ssl true && npm config set strict-ssl true

FROM base AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/dillinger-core ./packages/dillinger-core

# Build shared packages
WORKDIR /app/packages/shared
RUN pnpm run build

# Build Dillinger Core (Next.js)
WORKDIR /app/packages/dillinger-core
ENV NODE_ENV=production
ENV NEXT_PUBLIC_API_URL=http://localhost:3010
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build

FROM node:18-slim AS runner
WORKDIR /app

# Install gosu for dropping privileges and other runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gosu \
    && rm -rf /var/lib/apt/lists/*

RUN npm config set strict-ssl false && npm install -g pnpm@10.20.0 pm2 && npm config set strict-ssl true

# Create app user with default uid/gid (will be updated at runtime via PUID/PGID)
RUN groupadd --gid 1001 nodejs && useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home dillinger

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy built artifacts
COPY --from=builder --chown=dillinger:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=dillinger:nodejs /app/packages/shared/package.json ./packages/shared/

COPY --from=builder --chown=dillinger:nodejs /app/packages/dillinger-core/.next ./packages/dillinger-core/.next
COPY --from=builder --chown=dillinger:nodejs /app/packages/dillinger-core/package.json ./packages/dillinger-core/
COPY --from=builder --chown=dillinger:nodejs /app/packages/dillinger-core/next.config.js ./packages/dillinger-core/
COPY --from=builder --chown=dillinger:nodejs /app/packages/dillinger-core/assets ./packages/dillinger-core/assets

# Copy node_modules
COPY --from=deps --chown=dillinger:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=dillinger:nodejs /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps --chown=dillinger:nodejs /app/packages/dillinger-core/node_modules ./packages/dillinger-core/node_modules

RUN mkdir -p /data && chown -R dillinger:nodejs /data

COPY --chown=dillinger:nodejs docker/dillinger-core/ecosystem.config.cjs ./
COPY --chmod=755 docker/dillinger-core/entrypoint.sh /entrypoint.sh

# Default PUID/PGID (override at runtime for your user)
ENV PUID=1000
ENV PGID=1000

# Run as root initially - entrypoint will drop to PUID/PGID
# USER dillinger
EXPOSE 3010
ENV NODE_ENV=production
ENV PORT=3010
ENV DILLINGER_CORE_PATH=/data
ENV FRONTEND_URL=http://localhost:3010
ENV DOCKER_CONTAINER=true

ENTRYPOINT ["/entrypoint.sh"]
CMD ["pm2-runtime", "start", "ecosystem.config.cjs"]
