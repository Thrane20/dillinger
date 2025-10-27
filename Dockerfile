# Multi-stage Dockerfile for Dillinger production build
# This creates a single image that runs both the backend API and frontend Next.js app

FROM node:18-slim AS base

# Install pnpm
RUN npm config set strict-ssl false && npm install -g pnpm@8.15.0 && npm config set strict-ssl true

# Stage 1: Install dependencies
FROM base AS deps

WORKDIR /app

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy all package.json files
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/
COPY packages/frontend/package.json ./packages/frontend/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Stage 2: Build shared package
FROM base AS shared-builder

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy shared source and build
COPY packages/shared/src ./packages/shared/src/
COPY packages/shared/tsconfig.json ./packages/shared/

WORKDIR /app/packages/shared
RUN pnpm run build

# Stage 3: Build backend
FROM base AS backend-builder

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/backend/package.json ./packages/backend/

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/backend/node_modules ./packages/backend/node_modules

# Copy built shared package
COPY --from=shared-builder /app/packages/shared/dist ./packages/shared/dist
COPY packages/shared/package.json ./packages/shared/

# Copy backend source and build
COPY packages/backend/src ./packages/backend/src/
COPY packages/backend/tsconfig.json ./packages/backend/

WORKDIR /app/packages/backend
RUN pnpm run build

# Stage 4: Build frontend
FROM base AS frontend-builder

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/frontend/package.json ./packages/frontend/

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/frontend/node_modules ./packages/frontend/node_modules

# Copy built shared package
COPY --from=shared-builder /app/packages/shared/dist ./packages/shared/dist
COPY packages/shared/package.json ./packages/shared/

# Copy frontend source
COPY packages/frontend ./packages/frontend/

WORKDIR /app/packages/frontend

# Set environment variables for build
ENV NODE_ENV=production
ENV NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_TELEMETRY_DISABLED=1

# Build Next.js application
RUN pnpm run build

# Stage 5: Production runtime
FROM node:18-slim AS runner

WORKDIR /app

# Install pnpm and PM2
RUN npm config set strict-ssl false && \
    npm install -g pnpm@8.15.0 pm2 && \
    npm config set strict-ssl true

# Create non-root user
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home dillinger

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy built backend
COPY --from=backend-builder --chown=dillinger:nodejs /app/packages/backend/dist ./packages/backend/dist
COPY --from=backend-builder --chown=dillinger:nodejs /app/packages/backend/package.json ./packages/backend/

# Copy built frontend
COPY --from=frontend-builder --chown=dillinger:nodejs /app/packages/frontend/.next ./packages/frontend/.next
COPY --from=frontend-builder --chown=dillinger:nodejs /app/packages/frontend/public ./packages/frontend/public
COPY --from=frontend-builder --chown=dillinger:nodejs /app/packages/frontend/package.json ./packages/frontend/
COPY --from=frontend-builder --chown=dillinger:nodejs /app/packages/frontend/next.config.js ./packages/frontend/

# Copy shared package (needed by both)
COPY --from=shared-builder --chown=dillinger:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=shared-builder --chown=dillinger:nodejs /app/packages/shared/package.json ./packages/shared/

# Copy all production node_modules
COPY --from=deps --chown=dillinger:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=dillinger:nodejs /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps --chown=dillinger:nodejs /app/packages/backend/node_modules ./packages/backend/node_modules
COPY --from=deps --chown=dillinger:nodejs /app/packages/frontend/node_modules ./packages/frontend/node_modules

# Create data directory and set permissions
RUN mkdir -p /data && chown -R dillinger:nodejs /data

# Copy PM2 ecosystem file
COPY --chown=dillinger:nodejs ecosystem.config.cjs ./

# Switch to non-root user
USER dillinger

# Expose port 4000 for the application
EXPOSE 4000

# Set production environment
ENV NODE_ENV=production
ENV PORT=4000
ENV BACKEND_PORT=4001
ENV DATA_PATH=/data
ENV FRONTEND_URL=http://localhost:4000

# Health check - using node instead of curl
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/health', (r) => { if (r.statusCode === 200) process.exit(0); process.exit(1); })"

# Start both backend and frontend with PM2
CMD ["pm2-runtime", "start", "ecosystem.config.cjs"]
