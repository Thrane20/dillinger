# Dillinger Base Game Runner
# Provides shared infrastructure for all game runners:
# - X11/Wayland display server
# - GPU drivers (NVIDIA, AMD, Intel)
# - PulseAudio audio system
# - Gamescope compositor
# - Moonlight/Wolf streaming server
#
# Based on Games on Whales architecture

FROM archlinux:latest AS base

LABEL maintainer="Dillinger Project"
LABEL description="Base runner with X11, GPU, PulseAudio, Gamescope, and Moonlight streaming"
LABEL version="2.0.0"

# Configure default user and environment
ENV PUID=1000 \
    PGID=1000 \
    UMASK=000 \
    UNAME="gameuser" \
    HOME="/home/gameuser" \
    TZ="UTC" \
    LANG=en_US.UTF-8 \
    LC_ALL=en_US.UTF-8

#######################################################
# Stage 1: Install base system dependencies
#######################################################

# Update system and install base packages + gosu
RUN set -e && \
    echo "**** Initialize Arch Linux keyring ****" && \
    pacman-key --init && \
    pacman-key --populate archlinux && \
    \
    echo "**** Update system ****" && \
    pacman -Syu --noconfirm && \
    \
    echo "**** Install base packages ****" && \
    pacman -S --noconfirm \
        base-devel \
        curl wget \
        git \
        jq \
        sudo \
        ca-certificates \
        nss \
        fuse3 \
        psmisc \
        procps-ng \
        net-tools \
        inetutils && \
    \
    echo "**** Install gosu for user switching ****" && \
    GOSU_VERSION=1.17 && \
    ARCH=$(uname -m) && \
    case "$ARCH" in \
        x86_64) GOSU_ARCH="amd64" ;; \
        aarch64) GOSU_ARCH="arm64" ;; \
        *) GOSU_ARCH="amd64" ;; \
    esac && \
    wget -O /usr/local/bin/gosu "https://github.com/tianon/gosu/releases/download/${GOSU_VERSION}/gosu-${GOSU_ARCH}" && \
    chmod +x /usr/local/bin/gosu && \
    gosu nobody true && echo "gosu working!" && \
    \
    echo "**** Configure locale ****" && \
    echo "en_US.UTF-8 UTF-8" > /etc/locale.gen && \
    locale-gen && \
    \
    echo "**** Cleanup ****" && \
    pacman -Scc --noconfirm

#######################################################
# Stage 2: Install display server (X11/Wayland)
#######################################################

RUN <<_INSTALL_DISPLAY
set -e
echo "**** Install X11 and Wayland support ****"
pacman -S --noconfirm \
    xorg-server \
    xorg-xauth \
    xorg-xinit \
    xorg-xrandr \
    xorg-server-xwayland \
    wayland \
    wayland-protocols \
    xdotool \
    xterm \
    kitty \
    nano \
    libinput \
    libxkbcommon \
    mesa

echo "**** Cleanup ****"
pacman -Scc --noconfirm
_INSTALL_DISPLAY

#######################################################
# Stage 3: Install GPU drivers and graphics libraries
#######################################################

RUN <<_INSTALL_GPU
set -e
echo "**** Install Mesa and Vulkan drivers ****"
pacman -S --noconfirm \
    mesa \
    mesa-utils \
    vulkan-icd-loader \
    vulkan-tools \
    vulkan-mesa-layers \
    lib32-mesa \
    lib32-vulkan-icd-loader \
    nvidia-utils \
    lib32-nvidia-utils \
    libva-mesa-driver \
    lib32-libva-mesa-driver \
    mesa-vdpau \
    lib32-mesa-vdpau

echo "**** Cleanup ****"
pacman -Scc --noconfirm
_INSTALL_GPU

#######################################################
# Stage 4: Install PulseAudio for audio
#######################################################

RUN <<_INSTALL_AUDIO
set -e
echo "**** Install PulseAudio ****"
pacman -S --noconfirm \
    pulseaudio \
    pulseaudio-alsa \
    alsa-utils \
    alsa-plugins \
    lib32-alsa-plugins \
    lib32-libpulse

echo "**** Cleanup ****"
pacman -Scc --noconfirm
_INSTALL_AUDIO

#######################################################
# Stage 5: Install Gamescope compositor and MangoHUD
#######################################################

RUN set -e && \
    echo "**** Install Gamescope, MangoHUD and dependencies ****" && \
    pacman -S --noconfirm \
        gamescope \
        mangohud \
        noto-fonts-cjk \
        ttf-font-awesome && \
    echo "**** Cleanup ****" && \
    pacman -Scc --noconfirm

# Gamescope and MangoHUD are already in PATH on Arch
ENV PATH="/usr/bin:${PATH}"

#######################################################
# Stage 6: Install Wolf/Moonlight streaming components
#######################################################

# Install Wolf runtime dependencies for Moonlight streaming
RUN <<_INSTALL_MOONLIGHT
set -e
echo "**** Install Wolf/Moonlight dependencies ****"
pacman -S --noconfirm \
    openssl \
    icu \
    libevdev \
    systemd-libs \
    curl \
    libdrm \
    pciutils \
    libunwind

echo "**** Cleanup ****"
pacman -Scc --noconfirm
_INSTALL_MOONLIGHT

#######################################################
# Stage 7: Setup GStreamer for streaming
#######################################################

RUN <<_INSTALL_GSTREAMER
set -e
echo "**** Install GStreamer for video/audio streaming ****"
pacman -S --noconfirm \
    gstreamer \
    gst-plugins-base \
    gst-plugins-good \
    gst-plugins-bad \
    gst-plugins-ugly \
    gst-libav \
    gst-plugin-pipewire \
    gst-plugin-va

echo "**** Cleanup ****"
pacman -Scc --noconfirm
_INSTALL_GSTREAMER

# Set GStreamer environment for optimal performance
ENV GST_PLUGIN_PATH=/usr/lib/gstreamer-1.0/ \
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

# Create directory for optional helper scripts
RUN mkdir -p /opt/dillinger/scripts

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
