# Dillinger Base Game Runner
# Provides shared infrastructure for all game runners:
# - X11/Wayland display server
# - GPU drivers (NVIDIA, AMD, Intel)
# - PulseAudio audio system
# - Gamescope compositor
# - Moonlight/Wolf streaming server
#
# Based on Games on Whales architecture

ARG BASE_IMAGE=ubuntu:25.04
FROM ${BASE_IMAGE} AS base

LABEL maintainer="Dillinger Project"
LABEL description="Base runner with X11, GPU, PulseAudio, Gamescope, and Moonlight streaming"
LABEL version="1.0.0"

# Configure default user and environment
ENV PUID=1000 \
    PGID=1000 \
    UMASK=000 \
    UNAME="gameuser" \
    HOME="/home/gameuser" \
    TZ="UTC" \
    DEBIAN_FRONTEND=noninteractive \
    LANG=en_US.UTF-8 \
    LC_ALL=en_US.UTF-8

ARG TARGETARCH=amd64
ARG TARGETVARIANT

#######################################################
# Stage 1: Install base system dependencies
#######################################################

# Install base packages and gosu for user management
ARG GOSU_VERSION=1.14
RUN <<_INSTALL_BASE
set -e
echo "**** Update apt database ****"
apt-get update

echo "**** Install certificates ****"
apt-get install -y --reinstall --no-install-recommends ca-certificates

echo "**** Install base packages ****"
apt-get install -y --no-install-recommends \
    curl wget gnupg2 software-properties-common \
    fuse libnss3 jq \
    locales tzdata sudo \
    psmisc procps net-tools

echo "**** Install gosu for user switching ****"
wget --progress=dot:giga \
    -O /usr/bin/gosu \
    "https://github.com/tianon/gosu/releases/download/${GOSU_VERSION}/gosu-${TARGETARCH}${TARGETVARIANT}"
chmod +x /usr/bin/gosu
gosu nobody true && echo "gosu working!"

echo "**** Generate locales ****"
locale-gen en_US.UTF-8

echo "**** Cleanup ****"
rm -rf /var/lib/apt/lists/*
_INSTALL_BASE

#######################################################
# Stage 2: Install display server (X11/Wayland)
#######################################################

RUN <<_INSTALL_DISPLAY
set -e
echo "**** Install X11 and Wayland support ****"
apt-get update
apt-get install -y --no-install-recommends \
    xserver-xorg-core \
    xorg-video-abi-25 \
    xserver-xorg-legacy \
    xwayland \
    x11-utils \
    x11-xserver-utils \
    xauth \
    xdotool \
    kitty \
    nano \
    xterm \
    libwayland-server0 \
    libwayland-client0 \
    libinput10 \
    libxkbcommon0 \
    libgbm1

echo "**** Cleanup ****"
rm -rf /var/lib/apt/lists/*
_INSTALL_DISPLAY

#######################################################
# Stage 3: Install GPU drivers and graphics libraries
#######################################################

RUN <<_INSTALL_GPU
set -e
echo "**** Install Mesa and Vulkan drivers ****"
apt-get update
apt-get install -y --no-install-recommends \
    mesa-utils \
    mesa-vulkan-drivers \
    libgl1-mesa-dri \
    libgles2 \
    libegl1 \
    libgbm1 \
    vulkan-tools \
    libvulkan1 \
    libglvnd0 \
    libgl1 \
    libglx0 \
    libglapi-mesa \
    libnvidia-egl-wayland1 \
    libnvidia-egl-gbm1

echo "**** Cleanup ****"
rm -rf /var/lib/apt/lists/*
_INSTALL_GPU

#######################################################
# Stage 4: Install PulseAudio for audio
#######################################################

RUN <<_INSTALL_AUDIO
set -e
echo "**** Install PulseAudio ****"
apt-get update
apt-get install -y --no-install-recommends \
    pulseaudio \
    pulseaudio-utils \
    alsa-utils \
    alsa-oss \
    libasound2 \
    libpulse0

echo "**** Cleanup ****"
rm -rf /var/lib/apt/lists/*
_INSTALL_AUDIO

#######################################################
# Stage 5: Install Gamescope compositor
#######################################################

ARG GAMESCOPE_VERSION="3.15.14"
ENV GAMESCOPE_VERSION=$GAMESCOPE_VERSION

RUN <<_INSTALL_GAMESCOPE
set -e
echo "**** Install Gamescope and dependencies ****"
apt-get update
apt-get install -y --no-install-recommends \
    gamescope \
    fonts-noto-cjk \
    fonts-font-awesome

# Add /usr/games/ to PATH for gamescope
echo "**** Cleanup ****"
rm -rf /var/lib/apt/lists/*
_INSTALL_GAMESCOPE

# Add gamescope to PATH
ENV PATH="/usr/games/:${PATH}"

#######################################################
# Stage 6: Install Wolf/Moonlight streaming components
#######################################################

# Install Wolf runtime dependencies for Moonlight streaming
RUN <<_INSTALL_MOONLIGHT
set -e
echo "**** Install Wolf/Moonlight dependencies ****"
apt-get update
apt-get install -y --no-install-recommends \
    libssl3 \
    libicu76 \
    libevdev2 \
    libudev1 \
    libcurl4 \
    libdrm2 \
    libpci3 \
    libunwind8

echo "**** Cleanup ****"
rm -rf /var/lib/apt/lists/*
_INSTALL_MOONLIGHT

#######################################################
# Stage 7: Setup GStreamer for streaming
#######################################################

RUN <<_INSTALL_GSTREAMER
set -e
echo "**** Install GStreamer for video/audio streaming ****"
apt-get update
apt-get install -y --no-install-recommends \
    gstreamer1.0-tools \
    gstreamer1.0-plugins-base \
    gstreamer1.0-plugins-good \
    gstreamer1.0-plugins-bad \
    gstreamer1.0-plugins-ugly \
    gstreamer1.0-libav \
    gstreamer1.0-pulseaudio \
    gstreamer1.0-x \
    gstreamer1.0-vaapi \
    gstreamer1.0-gl

echo "**** Cleanup ****"
rm -rf /var/lib/apt/lists/*
_INSTALL_GSTREAMER

# Set GStreamer environment for optimal performance
ENV GST_PLUGIN_PATH=/usr/lib/x86_64-linux-gnu/gstreamer-1.0/ \
    GST_GL_API=gles2 \
    GST_GL_WINDOW=surfaceless \
    GST_DEBUG=2

#######################################################
# Stage 8: Create user and setup directories
#######################################################

# Create gameuser with proper groups
RUN useradd -m -s /bin/bash -u 1000 gameuser && \
    usermod -aG audio,video,input,render gameuser && \
    mkdir -p /home/gameuser/.config /home/gameuser/.local/share && \
    chown -R gameuser:gameuser /home/gameuser

# Create mount points and directories for games
RUN mkdir -p \
    /game \
    /saves \
    /config \
    /wineprefix \
    /installers \
    /opt/dillinger \
    /tmp/sessions \
    /run/user/gameuser && \
    chown -R gameuser:gameuser \
        /game /saves /config /wineprefix /installers /opt/dillinger /tmp/sessions /run/user/gameuser

# Set XDG runtime directory for Wayland/PulseAudio
ENV XDG_RUNTIME_DIR=/run/user/gameuser

#######################################################
# Stage 9: Copy entrypoint and helper scripts
#######################################################

# Copy entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Copy helper scripts
COPY scripts/ /opt/dillinger/scripts/
RUN chmod +x /opt/dillinger/scripts/*.sh || true

#######################################################
# Configuration and Volumes
#######################################################

# Volumes for persistent data
VOLUME ["/game", "/saves", "/config", "/wineprefix", "/installers", "/run/user/gameuser"]

# Expose Moonlight/Wolf ports
# HTTPS
EXPOSE 47984/tcp
# HTTP  
EXPOSE 47989/tcp
# Control
EXPOSE 47999/udp
# RTSP
EXPOSE 48010/tcp
# Video
EXPOSE 48100/udp
# Audio
EXPOSE 48200/udp

# Working directory
WORKDIR /home/gameuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD [ -x /usr/local/bin/entrypoint.sh ] || exit 1

# Set entrypoint
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["/bin/bash"]
