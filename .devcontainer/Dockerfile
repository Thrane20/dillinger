# Dillinger development container
# Provides a reproducible Node.js + pnpm environment with Docker CLI support

FROM mcr.microsoft.com/devcontainers/typescript-node:18

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
        unzip \
    && rm -rf /var/lib/apt/lists/*

# Enable pnpm via Corepack at the requested version
RUN corepack enable \
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

USER node
RUN pnpm --version
USER root
