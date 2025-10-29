# Multi-stage Dockerfile for Dillinger Runner
# Provides containerized game execution with Wine/Proton support
# Based on Ubuntu 25.04 with gaming optimizations

# ================================
# Base Stage: Ubuntu with core dependencies
# ================================
FROM ubuntu:25.04 as base

# Set timezone and locale
ENV TZ=UTC
ENV DEBIAN_FRONTEND=noninteractive
ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8

# Install base system dependencies
RUN apt-get update && apt-get install -y \
    # Core system utilities
    curl wget gnupg2 software-properties-common ca-certificates \
    locales tzdata sudo \
    # Node.js and development tools
    nodejs npm \
    # Wine and Windows compatibility
    wine-staging winetricks \
    # Display and graphics
    xvfb x11-utils x11-xserver-utils xauth \
    mesa-utils vulkan-utils \
    # Audio support
    pulseaudio pulseaudio-utils \
    # Streaming and media
    gstreamer1.0-tools gstreamer1.0-plugins-base \
    gstreamer1.0-plugins-good gstreamer1.0-plugins-bad \
    gstreamer1.0-plugins-ugly gstreamer1.0-libav \
    # Network utilities
    netcat-openbsd iproute2 \
    # Process management
    psmisc procps \
    && rm -rf /var/lib/apt/lists/*

# Generate locales
RUN locale-gen en_US.UTF-8

# Install Node.js 18+ (if not available in base image)
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# Install pnpm
RUN npm install -g pnpm@8.15.0

# ================================
# Wine Stage: Wine configuration and optimization
# ================================
FROM base as wine-setup

# Create wine user and configure Wine
RUN useradd -m -s /bin/bash wine \
    && usermod -aG audio,video wine

# Switch to wine user for Wine setup
USER wine
WORKDIR /home/wine

# Initialize Wine prefix
ENV WINEPREFIX=/home/wine/.wine
ENV WINEARCH=win64
RUN wine wineboot --init \
    && winetricks -q vcrun2019 \
    && wine reg add "HKCU\\Software\\Wine\\Direct3D" /v "renderer" /t REG_SZ /d "vulkan" \
    && wine reg add "HKCU\\Software\\Wine\\DirectSound" /v "DefaultSampleRate" /t REG_DWORD /d 44100

# Switch back to root for application setup
USER root

# ================================
# Development Stage: Node.js application
# ================================
FROM wine-setup as development

# Create application directory
WORKDIR /app

# Set up pnpm workspace
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY tsconfig.base.json ./

# Copy package configurations
COPY packages/runner-types/package.json ./packages/runner-types/
COPY packages/validation/package.json ./packages/validation/
COPY apps/dillinger-runner/package.json ./apps/dillinger-runner/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/runner-types/src ./packages/runner-types/src
COPY packages/validation/src ./packages/validation/src
COPY apps/dillinger-runner/src ./apps/dillinger-runner/src

# Build shared packages
RUN pnpm --filter @dillinger/runner-types run build
RUN pnpm --filter @dillinger/validation run build

# Create runner user for application execution
RUN useradd -m -s /bin/bash runner \
    && usermod -aG audio,video,wine runner \
    && chown -R runner:runner /app

# Set up directories
RUN mkdir -p /opt/games /tmp/sessions \
    && chown -R runner:runner /opt/games /tmp/sessions

# Configure PulseAudio for containerized audio
RUN mkdir -p /etc/pulse \
    && echo "load-module module-pipe-sink sink_name=audio_out file=/tmp/audio_out format=s16le rate=44100 channels=2" > /etc/pulse/default.pa

# Expose ports
EXPOSE 3002 8080

# Set working directory for application
WORKDIR /app/apps/dillinger-runner

# Switch to runner user
USER runner

# Default command
CMD ["pnpm", "run", "dev"]

# ================================
# Production Stage: Optimized runtime
# ================================
FROM development as production

# Switch back to root for final setup
USER root

# Build application
RUN pnpm --filter @dillinger/runner run build

# Remove development dependencies
RUN pnpm prune --prod

# Create production user
RUN useradd -m -s /bin/bash -u 1001 dillinger-runner \
    && usermod -aG audio,video,wine dillinger-runner \
    && chown -R dillinger-runner:dillinger-runner /app

# Switch to production user
USER dillinger-runner

# Production command
CMD ["node", "dist/index.js"]