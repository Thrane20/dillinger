# Dillinger development container
# Debian-based environment with latest Node.js ("current") + pnpm

FROM node:current-bookworm

ARG PNPM_VERSION=10.20.0

# Ensure common tooling required by Dev Container features is present
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash \
        sudo \
        coreutils \
        curl \
        ca-certificates \
        git \
        build-essential \
        cmake \
        ninja-build \
        meson \
        clang \
        libboost-dev \
        libwayland-dev \
        pkg-config \
        python3 \
        python3-pip \
        unzip \
        pulseaudio-utils \
    && rm -rf /var/lib/apt/lists/*

# Enable pnpm via Corepack at the requested version
RUN if ! command -v corepack >/dev/null 2>&1; then \
        npm install -g --force --no-fund --no-audit corepack; \
    fi \
    && corepack enable \
    && corepack prepare pnpm@${PNPM_VERSION} --activate

# Pre-create pnpm store directory with correct permissions
ENV PNPM_HOME=/home/node/.local/share/pnpm
RUN mkdir -p ${PNPM_HOME} \
    && chown -R node:node ${PNPM_HOME}

# Set PATH to include pnpm binaries and preserve base image PATH
ENV PATH="${PNPM_HOME}/bin:${PATH}"

# Allow node user to talk to host Docker socket
RUN groupadd -f docker \
    && usermod -aG docker node

# Allow devcontainer lifecycle commands to use sudo without prompting
RUN echo 'node ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/99-node-nopasswd \
    && chmod 0440 /etc/sudoers.d/99-node-nopasswd

USER node
RUN pnpm --version
USER root
