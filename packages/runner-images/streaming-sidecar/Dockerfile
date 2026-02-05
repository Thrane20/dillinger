# Dillinger Streaming Sidecar
# Based directly on Wolf image to ensure full GStreamer compatibility
# Adds Sway compositor for headless Wayland
#
# Build: docker build -t ghcr.io/thrane20/dillinger/streaming-sidecar:0.3.1 .

# Start from the official Wolf image - includes all GStreamer dependencies
FROM ghcr.io/games-on-whales/wolf:stable

LABEL maintainer="Dillinger Project"
LABEL description="Streaming sidecar with Sway compositor and Wolf server"
LABEL org.opencontainers.image.source="https://github.com/thrane20/dillinger"

# Avoid interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Ubuntu 24.10 (Oracular) may have moved to old-releases
# Update sources.list to use old-releases mirror if needed
RUN sed -i 's|archive.ubuntu.com|old-releases.ubuntu.com|g' /etc/apt/sources.list 2>/dev/null || true && \
    sed -i 's|security.ubuntu.com|old-releases.ubuntu.com|g' /etc/apt/sources.list 2>/dev/null || true && \
    find /etc/apt/sources.list.d -name "*.list" -exec sed -i 's|archive.ubuntu.com|old-releases.ubuntu.com|g' {} \; 2>/dev/null || true && \
    find /etc/apt/sources.list.d -name "*.list" -exec sed -i 's|security.ubuntu.com|old-releases.ubuntu.com|g' {} \; 2>/dev/null || true && \
    find /etc/apt/sources.list.d -name "*.sources" -exec sed -i 's|archive.ubuntu.com|old-releases.ubuntu.com|g' {} \; 2>/dev/null || true && \
    find /etc/apt/sources.list.d -name "*.sources" -exec sed -i 's|security.ubuntu.com|old-releases.ubuntu.com|g' {} \; 2>/dev/null || true

# Install Sway compositor, audio, and additional utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Sway compositor and Wayland tools
    sway \
    swayidle \
    swaybg \
    wlr-randr \
    wayland-utils \
    wl-clipboard \
    # Audio support
    pulseaudio \
    pulseaudio-utils \
    # Wayland test clients (for testing)
    weston \
    foot \
    # Process management
    htop \
    psmisc \
    # Networking tools
    iproute2 \
    net-tools \
    && \
    # Clean up
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create gameuser (UID/GID 1000) if it doesn't exist
RUN (getent group 1000 > /dev/null || groupadd -g 1000 gameuser) && \
    (id -u 1000 > /dev/null 2>&1 || useradd -u 1000 -g 1000 -m -s /bin/bash gameuser) && \
    echo "gameuser ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Create directories for Sway configs and sockets
RUN mkdir -p \
    /config/sway \
    /config/sway-configs \
    /run/sway \
    /run/dillinger \
    /run/user/1000 \
    /var/log/dillinger \
    /data/wolf && \
    chown -R 1000:1000 /config /run/sway /run/dillinger /run/user/1000 /var/log/dillinger /data

# Copy entrypoint script
COPY streaming-sidecar-entrypoint.sh /usr/local/bin/streaming-sidecar-entrypoint.sh
RUN chmod +x /usr/local/bin/streaming-sidecar-entrypoint.sh

# Copy default Sway configuration
COPY sway-config-template /config/sway/config.template

# Environment variables
ENV SIDECAR_MODE=game
ENV SWAY_CONFIG_NAME=default
ENV IDLE_TIMEOUT_MINUTES=15
ENV WAYLAND_SOCKET_PATH=/run/dillinger/wayland-dillinger
ENV TEST_PATTERN=smpte
ENV GPU_TYPE=auto

# Wolf streaming ports
EXPOSE 47984/tcp 47984/udp
EXPOSE 47989/tcp 47989/udp
EXPOSE 47999/tcp 47999/udp
EXPOSE 48010/tcp 48010/udp

# Control API port for sidecar management
EXPOSE 9999/tcp

WORKDIR /home/gameuser

# Override Wolf's default entrypoint with ours
ENTRYPOINT ["/usr/local/bin/streaming-sidecar-entrypoint.sh"]
