FROM node:18-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm config set strict-ssl false && npm install -g pnpm@10.20.0 && npm config set strict-ssl true

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/runner-types/package.json ./packages/runner-types/
COPY packages/validation/package.json ./packages/validation/
COPY packages/dillinger-core/backend/package.json ./packages/dillinger-core/backend/
COPY packages/dillinger-core/frontend/package.json ./packages/dillinger-core/frontend/
COPY packages/dillinger-core/package.json ./packages/dillinger-core/

RUN npm config set strict-ssl false && pnpm config set strict-ssl false && pnpm install --frozen-lockfile && pnpm config set strict-ssl true && npm config set strict-ssl true

FROM base AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/runner-types ./packages/runner-types
COPY packages/validation ./packages/validation
COPY packages/dillinger-core ./packages/dillinger-core

# Build shared packages
WORKDIR /app/packages/shared
RUN pnpm run build

WORKDIR /app/packages/runner-types
RUN pnpm run build

WORKDIR /app/packages/validation
RUN pnpm run build

# Build backend
WORKDIR /app/packages/dillinger-core/backend
RUN pnpm run build

# Build frontend
WORKDIR /app/packages/dillinger-core/frontend
ENV NODE_ENV=production
ENV NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build

FROM node:18-slim AS runner
WORKDIR /app
RUN npm config set strict-ssl false && npm install -g pnpm@10.20.0 pm2 && npm config set strict-ssl true
RUN groupadd --gid 1001 nodejs && useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home dillinger

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy built artifacts
COPY --from=builder --chown=dillinger:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=dillinger:nodejs /app/packages/shared/package.json ./packages/shared/
COPY --from=builder --chown=dillinger:nodejs /app/packages/runner-types/dist ./packages/runner-types/dist
COPY --from=builder --chown=dillinger:nodejs /app/packages/runner-types/package.json ./packages/runner-types/
COPY --from=builder --chown=dillinger:nodejs /app/packages/validation/dist ./packages/validation/dist
COPY --from=builder --chown=dillinger:nodejs /app/packages/validation/package.json ./packages/validation/

COPY --from=builder --chown=dillinger:nodejs /app/packages/dillinger-core/backend/dist ./packages/dillinger-core/backend/dist
COPY --from=builder --chown=dillinger:nodejs /app/packages/dillinger-core/backend/package.json ./packages/dillinger-core/backend/

COPY --from=builder --chown=dillinger:nodejs /app/packages/dillinger-core/frontend/.next ./packages/dillinger-core/frontend/.next
COPY --from=builder --chown=dillinger:nodejs /app/packages/dillinger-core/frontend/package.json ./packages/dillinger-core/frontend/
COPY --from=builder --chown=dillinger:nodejs /app/packages/dillinger-core/frontend/next.config.js ./packages/dillinger-core/frontend/

# Copy node_modules
COPY --from=deps --chown=dillinger:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=dillinger:nodejs /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps --chown=dillinger:nodejs /app/packages/runner-types/node_modules ./packages/runner-types/node_modules
COPY --from=deps --chown=dillinger:nodejs /app/packages/validation/node_modules ./packages/validation/node_modules
COPY --from=deps --chown=dillinger:nodejs /app/packages/dillinger-core/backend/node_modules ./packages/dillinger-core/backend/node_modules
COPY --from=deps --chown=dillinger:nodejs /app/packages/dillinger-core/frontend/node_modules ./packages/dillinger-core/frontend/node_modules

RUN mkdir -p /data && chown -R dillinger:nodejs /data

COPY --chown=dillinger:nodejs docker/dillinger-core/ecosystem.config.cjs ./

# USER dillinger
EXPOSE 4000
ENV NODE_ENV=production
ENV PORT=4000
ENV BACKEND_PORT=4001
ENV DILLINGER_ROOT=/data
ENV FRONTEND_URL=http://localhost:4000

CMD ["pm2-runtime", "start", "ecosystem.config.cjs"]
