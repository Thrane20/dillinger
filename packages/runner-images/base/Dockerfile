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
    echo "**** Configure pacman (enable multilib) ****" && \
    # The Arch Docker image doesn't have multilib section, so add it
    echo "" >> /etc/pacman.conf && \
    echo "[multilib]" >> /etc/pacman.conf && \
    echo "Include = /etc/pacman.d/mirrorlist" >> /etc/pacman.conf && \
    \
    echo "**** Configure pacman defaults (parallel downloads + candy) ****" && \
    sed -i 's/^#ParallelDownloads = .*/ParallelDownloads = 10/' /etc/pacman.conf && \
    if ! grep -q '^ILoveCandy' /etc/pacman.conf; then echo 'ILoveCandy' >> /etc/pacman.conf; fi && \
    if ! grep -q '^DisableDownloadTimeout' /etc/pacman.conf; then echo 'DisableDownloadTimeout' >> /etc/pacman.conf; fi && \
    \
    echo "**** Set Fastly CDN as default mirror ****" && \
    echo 'Server = https://fastly.mirror.pkgbuild.com/$repo/os/$arch' > /etc/pacman.d/mirrorlist && \
    \
    echo "**** Initialize Arch Linux keyring ****" && \
    pacman-key --init && \
    pacman-key --populate archlinux && \
    \
    echo "**** Initial system update (bootstrap reflector) ****" && \
    pacman -Sy --noconfirm && \
    \
    echo "**** Install reflector for fast mirror selection ****" && \
    pacman -S --noconfirm --needed reflector bc && \
    \
    echo "**** Testing Fastly CDN mirror speed ****" && \
    FASTLY_SPEED=$(curl -o /dev/null -w '%{speed_download}' -s --connect-timeout 5 --max-time 7 https://fastly.mirror.pkgbuild.com/core/os/x86_64/core.db 2>/dev/null || echo 0) && \
    FASTLY_SPEED_KB=$(printf "%.0f" $(echo "$FASTLY_SPEED / 1024" | bc -l 2>/dev/null || echo 0)) && \
    echo "**** Fastly mirror speed: ${FASTLY_SPEED_KB} KiB/s ****" && \
    if [ "$FASTLY_SPEED_KB" -gt 1500 ] 2>/dev/null; then \
        echo "**** Fastly mirror is fast enough (>1500 KiB/s), using it ****"; \
    else \
        echo "**** Fastly mirror too slow or unavailable, scanning alternatives with reflector ****" && \
        reflector --verbose --latest 10 --protocol https --sort rate --fastest 1 \
            --download-timeout 5 --save /etc/pacman.d/mirrorlist; \
    fi && \
    echo "**** Mirror selection complete ****" && \
    \
    echo "**** Full system update with optimized mirrors ****" && \
    pacman -Syyu --noconfirm --needed && \
    \
    echo "**** Install base packages ****" && \
    pacman -S --noconfirm --needed \
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
pacman -S --noconfirm --needed \
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
GPU_PKGS=(
    mesa \
    mesa-utils \
    vulkan-icd-loader \
    vulkan-tools \
    vulkan-mesa-layers \
    libva-mesa-driver \
    vulkan-radeon
)

# Optional 32-bit userspace (requires multilib). Skip if repo/package isn't available.
OPTIONAL_32BIT_PKGS=(
    lib32-mesa \
    lib32-vulkan-icd-loader \
    lib32-libva-mesa-driver \
    lib32-mesa-vdpau \
    lib32-vulkan-radeon
)

# Optional VDPAU support (package name has changed over time on Arch)
OPTIONAL_VDPAU_PKGS=(
    mesa-vdpau \
    lib32-mesa-vdpau
)

# Optional NVIDIA userspace. Skip on non-x86_64 and if packages aren't available.
OPTIONAL_NVIDIA_PKGS=(
    nvidia-utils \
    lib32-nvidia-utils
)

pacman -S --noconfirm --needed "${GPU_PKGS[@]}"

for pkg in "${OPTIONAL_32BIT_PKGS[@]}"; do
    if pacman -Si "$pkg" >/dev/null 2>&1; then
        pacman -S --noconfirm --needed "$pkg"
    else
        echo "**** Skipping missing optional package: $pkg ****"
    fi
done

for pkg in "${OPTIONAL_NVIDIA_PKGS[@]}"; do
    if pacman -Si "$pkg" >/dev/null 2>&1; then
        pacman -S --noconfirm --needed "$pkg"
    else
        echo "**** Skipping missing optional package: $pkg ****"
    fi
done

for pkg in "${OPTIONAL_VDPAU_PKGS[@]}"; do
    if pacman -Si "$pkg" >/dev/null 2>&1; then
        pacman -S --noconfirm --needed "$pkg"
    else
        echo "**** Skipping missing optional package: $pkg ****"
    fi
done

echo "**** Cleanup ****"
pacman -Scc --noconfirm
_INSTALL_GPU

#######################################################
# Stage 4: Install PulseAudio for audio
#######################################################

RUN <<_INSTALL_AUDIO
set -e
echo "**** Install PulseAudio ****"
AUDIO_PKGS=(
    pulseaudio \
    pulseaudio-alsa \
    alsa-utils \
    alsa-plugins
)

OPTIONAL_AUDIO_32BIT_PKGS=(
    lib32-alsa-plugins \
    lib32-libpulse
)

pacman -S --noconfirm --needed "${AUDIO_PKGS[@]}"

for pkg in "${OPTIONAL_AUDIO_32BIT_PKGS[@]}"; do
    if pacman -Si "$pkg" >/dev/null 2>&1; then
        pacman -S --noconfirm --needed "$pkg"
    else
        echo "**** Skipping missing optional package: $pkg ****"
    fi
done

echo "**** Cleanup ****"
pacman -Scc --noconfirm
_INSTALL_AUDIO

#######################################################
# Stage 5: Install Gamescope compositor and MangoHUD
#######################################################

RUN set -e && \
    echo "**** Install Gamescope, MangoHUD and dependencies ****" && \
    pacman -S --noconfirm --needed \
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
pacman -S --noconfirm --needed \
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
pacman -S --noconfirm --needed \
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
    usermod -aG audio,video,input,render,disk gameuser && \
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
