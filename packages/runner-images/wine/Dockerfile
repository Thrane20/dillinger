# Dillinger Wine Game Runner
# Arch Linux foundation for running Windows games via Wine
# Inspired by Games on Whales architecture

FROM archlinux:latest

LABEL maintainer="Dillinger Project"
LABEL description="Wine game runner with X11, audio, and GPU support for Windows games"
LABEL version="1.0.0"

# Enable multilib repository for 32-bit support (critical for Wine)
RUN echo -e "\n[multilib]\nInclude = /etc/pacman.d/mirrorlist" >> /etc/pacman.conf

# Update system and install base-devel
RUN pacman -Syu --noconfirm && \
    pacman -S --noconfirm base-devel

# Install Wine and related packages
RUN pacman -S --noconfirm --needed \
    # Wine core packages
    wine \
    wine-mono \
    wine-gecko \
    winetricks \
    # Display and windowing (X11 support)
    xorg-server \
    xorg-xinit \
    xorg-xauth \
    xorg-xdpyinfo \
    xorg-xrandr \
    xorg-xinput \
    xdotool \
    xterm \
    # Graphics libraries (64-bit and 32-bit for Wine)
    mesa \
    mesa-utils \
    vulkan-icd-loader \
    vulkan-tools \
    lib32-mesa \
    lib32-vulkan-icd-loader \
    glew \
    glfw-x11 \
    lib32-glu \
    glu \
    # DXVK for DirectX to Vulkan translation
    # Note: DXVK is available in community repo or can be installed via winetricks
    # Audio - PulseAudio support (learned from GoW)
    pulseaudio \
    pulseaudio-alsa \
    alsa-utils \
    alsa-lib \
    lib32-alsa-lib \
    lib32-libpulse \
    alsa-plugins \
    lib32-alsa-plugins \
    # Common gaming and Windows compatibility libraries
    freetype2 \
    lib32-freetype2 \
    fontconfig \
    lib32-fontconfig \
    openal \
    lib32-openal \
    libvorbis \
    lib32-libvorbis \
    libtheora \
    lib32-libtheora \
    libogg \
    lib32-libogg \
    flac \
    lib32-flac \
    libsndfile \
    lib32-libsndfile \
    # X11 libraries for Wine
    libxrandr \
    lib32-libxrandr \
    libxinerama \
    lib32-libxinerama \
    libxcursor \
    lib32-libxcursor \
    libxi \
    lib32-libxi \
    libxss \
    libxcomposite \
    lib32-libxcomposite \
    libxrender \
    lib32-libxrender \
    # System utilities
    ca-certificates \
    curl \
    wget \
    unzip \
    xz \
    file \
    procps-ng \
    net-tools \
    bash \
    coreutils \
    grep \
    sed \
    gawk \
    which \
    cabextract \
    p7zip \
    unrar \
    && pacman -Scc --noconfirm

# Optionally install NVIDIA utilities if needed (won't fail if unavailable)
# This allows the image to work on both NVIDIA and non-NVIDIA systems
RUN pacman -S --noconfirm lib32-nvidia-utils || echo "NVIDIA utils not available, skipping..."

# Install NVIDIA drivers detection script (inspired by GoW)
# This script will detect and configure NVIDIA drivers at runtime if needed
COPY scripts/nvidia-check.sh /usr/local/bin/nvidia-check.sh
RUN chmod +x /usr/local/bin/nvidia-check.sh

# Create non-root user for running games
RUN useradd -m -s /bin/bash -u 1000 gameuser && \
    usermod -aG audio,video gameuser

# Create mount points and directories
RUN mkdir -p /game /saves /config /wineprefix /installers && \
    chown -R gameuser:gameuser /game /saves /config /wineprefix /installers

# Copy entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Copy test installer script
COPY test-installer.sh /usr/local/bin/test-installer.sh
RUN chmod +x /usr/local/bin/test-installer.sh

# Set working directory
WORKDIR /home/gameuser

# Switch to game user
USER gameuser

# Set environment variables
ENV HOME=/home/gameuser
ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8

# Wine-specific environment
ENV WINEPREFIX=/wineprefix
ENV WINEARCH=win64
ENV WINEDEBUG=-all

# Default save directory
ENV SAVE_DIR=/saves

# Volumes for game data
VOLUME ["/game", "/saves", "/config", "/wineprefix", "/installers"]

# Health check - verify entrypoint exists
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD [ -x /usr/local/bin/entrypoint.sh ] || exit 1

# Entrypoint
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
