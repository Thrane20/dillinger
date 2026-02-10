# Dillinger Streaming Sidecar
# Ubuntu 24.10 based - matches Wolf's build environment for GLib compatibility
# Wolf's GStreamer was built against GLib 2.82+ (Ubuntu 24.10), not GLib 2.80 (Ubuntu 24.04)
# Note: Ubuntu 24.10 is EOL, using old-releases.ubuntu.com for archived packages
#
# Build: docker build -t ghcr.io/thrane20/dillinger/streaming-sidecar:0.4.0 .

#######################################################
# Stage 1: Extract Wolf binaries and libraries from GOW image
#######################################################
FROM ghcr.io/games-on-whales/wolf:stable AS wolf-source

# Wolf is built on Ubuntu 24.10 - we must match this for GLib/GStreamer ABI compatibility
# This provides Wolf binary and its complete GStreamer 1.25 stack

#######################################################
# Stage 2: Ubuntu 24.10 base with all dependencies
#######################################################
FROM ubuntu:24.10

# Ubuntu 24.10 is EOL - switch to archived repos
RUN sed -i 's|http://archive.ubuntu.com/ubuntu|http://old-releases.ubuntu.com/ubuntu|g' /etc/apt/sources.list.d/ubuntu.sources 2>/dev/null || \
    sed -i 's|http://archive.ubuntu.com/ubuntu|http://old-releases.ubuntu.com/ubuntu|g' /etc/apt/sources.list && \
    sed -i 's|http://security.ubuntu.com/ubuntu|http://old-releases.ubuntu.com/ubuntu|g' /etc/apt/sources.list.d/ubuntu.sources 2>/dev/null || \
    sed -i 's|http://security.ubuntu.com/ubuntu|http://old-releases.ubuntu.com/ubuntu|g' /etc/apt/sources.list

LABEL maintainer="Dillinger Project"
LABEL description="Dillinger streaming sidecar - Sway compositor + Wolf server for Moonlight"
LABEL org.opencontainers.image.source="https://github.com/thrane20/dillinger"

# Avoid interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

#######################################################
# Install system dependencies
#######################################################
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
    # GStreamer core and plugins (matching Wolf's build)
    gstreamer1.0-tools \
    gstreamer1.0-plugins-base \
    gstreamer1.0-plugins-good \
    gstreamer1.0-plugins-bad \
    gstreamer1.0-plugins-ugly \
    gstreamer1.0-libav \
    gstreamer1.0-vaapi \
    gstreamer1.0-pulseaudio \
    libgstreamer1.0-0 \
    libgstreamer-plugins-base1.0-0 \
    libgstreamer-plugins-bad1.0-0 \
    # VA-API for hardware encoding (AMD/Intel)
    libva2 \
    libva-drm2 \
    libva-wayland2 \
    va-driver-all \
    mesa-va-drivers \
    # Vulkan for GPU compute
    libvulkan1 \
    mesa-vulkan-drivers \
    # OpenSSL for Wolf's HTTPS
    libssl3 \
    # libcurl for Wolf HTTP operations
    libcurl4 \
    # libpci for Wolf hardware detection
    libpci3 \
    # ICU libraries (Wolf dependency)
    libicu74 \
    # Process management
    htop \
    psmisc \
    procps \
    # Networking tools
    iproute2 \
    net-tools \
    netcat-openbsd \
    # Utilities
    sudo \
    ca-certificates \
    && \
    # Clean up
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

#######################################################
# Copy Wolf binary and complete GStreamer stack from GOW image
# We use Wolf's bundled GStreamer 1.25 which is compatible with Ubuntu 24.10's GLib
#######################################################
# Wolf binary
COPY --from=wolf-source /wolf/wolf /wolf/wolf
COPY --from=wolf-source /wolf/fake-udev /wolf/fake-udev

# Wolf's custom Wayland display capture library
COPY --from=wolf-source /usr/local/lib/liblibgstwaylanddisplay.so* /usr/local/lib/

# Wolf's complete GStreamer 1.25 stack (built for Ubuntu 24.10)
COPY --from=wolf-source /usr/local/lib/x86_64-linux-gnu/ /usr/local/lib/x86_64-linux-gnu/
COPY --from=wolf-source /usr/local/libexec/gstreamer-1.0/ /usr/local/libexec/gstreamer-1.0/
COPY --from=wolf-source /usr/local/bin/gst-* /usr/local/bin/

# Set up library paths and permissions
RUN chmod +x /wolf/wolf /wolf/fake-udev && \
    echo "/usr/local/lib" >> /etc/ld.so.conf.d/wolf.conf && \
    echo "/usr/local/lib/x86_64-linux-gnu" >> /etc/ld.so.conf.d/wolf.conf && \
    ldconfig

#######################################################
# Create user and directories
#######################################################
# Ubuntu 24.04 has an 'ubuntu' user with UID 1000 - remove it first
RUN userdel -r ubuntu 2>/dev/null || true && \
    groupdel ubuntu 2>/dev/null || true && \
    groupadd -g 1000 gameuser && \
    useradd -u 1000 -g 1000 -m -s /bin/bash gameuser && \
    echo "gameuser ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers && \
    mkdir -p \
        /config/sway \
        /config/sway-configs \
        /run/sway \
        /run/dillinger \
        /run/user/1000 \
        /var/log/dillinger \
        /data/wolf && \
    chown -R 1000:1000 /config /run/sway /run/dillinger /run/user/1000 /var/log/dillinger /data

#######################################################
# Copy entrypoint and config
#######################################################
COPY streaming-sidecar-entrypoint.sh /usr/local/bin/streaming-sidecar-entrypoint.sh
RUN chmod +x /usr/local/bin/streaming-sidecar-entrypoint.sh

COPY sway-config-template /config/sway/config.template

# Static Wolf config template (only uuid + paired_clients modified at runtime)
COPY wolf-config.toml /wolf/config.toml.template

#######################################################
# Environment variables
#######################################################
ENV SIDECAR_MODE=game \
    SWAY_CONFIG_NAME=default \
    IDLE_TIMEOUT_MINUTES=15 \
    WAYLAND_SOCKET_PATH=/run/dillinger/wayland-dillinger \
    TEST_PATTERN=smpte \
    GPU_TYPE=auto \
    # Wolf configuration
    WOLF_CFG_FOLDER=/data/wolf \
    # GStreamer paths - use Wolf's bundled GStreamer 1.25
    GST_PLUGIN_PATH=/usr/local/lib/x86_64-linux-gnu/gstreamer-1.0 \
    GST_PLUGIN_SCANNER=/usr/local/libexec/gstreamer-1.0/gst-plugin-scanner

# Wolf streaming ports (Moonlight protocol)
EXPOSE 47984/tcp 47984/udp
EXPOSE 47989/tcp 47989/udp  
EXPOSE 47999/tcp 47999/udp
EXPOSE 48010/tcp 48010/udp

# Control API port for sidecar management
EXPOSE 9999/tcp

WORKDIR /home/gameuser

ENTRYPOINT ["/usr/local/bin/streaming-sidecar-entrypoint.sh"]
