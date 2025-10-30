# Dillinger Linux Native Game Runner
# Arch Linux foundation for running native Linux games and applications

FROM archlinux:latest

LABEL maintainer="Dillinger Project"
LABEL description="Linux native game runner with X11, audio, and GPU support"
LABEL version="2.0.0"

# Enable multilib repository for 32-bit support
RUN echo -e "\n[multilib]\nInclude = /etc/pacman.d/mirrorlist" >> /etc/pacman.conf

# Update system and install base-devel
RUN pacman -Syu --noconfirm && \
    pacman -S --noconfirm base-devel

# Install system dependencies
RUN pacman -S --noconfirm --needed \
    # Display and windowing
    xorg-server \
    xorg-xinit \
    xorg-xauth \
    xorg-xdpyinfo \
    xorg-xrandr \
    xorg-xinput \
    xdotool \
    # Graphics libraries
    mesa \
    mesa-utils \
    vulkan-icd-loader \
    vulkan-tools \
    lib32-mesa \
    lib32-vulkan-icd-loader \
    glew \
    glfw-x11 \
    # Audio
    pulseaudio \
    pulseaudio-alsa \
    alsa-utils \
    alsa-lib \
    lib32-alsa-lib \
    lib32-libpulse \
    # SDL2 for game input/controllers
    sdl2 \
    sdl2_image \
    sdl2_mixer \
    sdl2_ttf \
    sdl2_net \
    lib32-sdl2 \
    lib32-sdl2_image \
    lib32-sdl2_mixer \
    lib32-sdl2_ttf \
    # Common gaming libraries
    freetype2 \
    fontconfig \
    openal \
    libvorbis \
    libtheora \
    libogg \
    flac \
    libsndfile \
    lib32-freetype2 \
    lib32-fontconfig \
    lib32-openal \
    lib32-libvorbis \
    lib32-libtheora \
    lib32-libogg \
    lib32-flac \
    # Additional gaming dependencies
    libxrandr \
    libxinerama \
    libxcursor \
    libxi \
    libxss \
    lib32-libxrandr \
    lib32-libxinerama \
    lib32-libxcursor \
    lib32-libxi \
    # OpenGL/Vulkan support
    glu \
    lib32-glu \
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
    && pacman -Scc --noconfirm

# Create non-root user for running games
RUN useradd -m -s /bin/bash -u 1000 gameuser && \
    usermod -aG audio,video gameuser

# Create mount points and directories
RUN mkdir -p /game /saves /config && \
    chown -R gameuser:gameuser /game /saves /config

# Copy entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Copy test game
COPY test-game.sh /usr/local/bin/test-game.sh
RUN chmod +x /usr/local/bin/test-game.sh

# Set working directory
WORKDIR /home/gameuser

# Switch to game user
USER gameuser

# Set environment variables
ENV HOME=/home/gameuser
ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8

# Default save directory
ENV SAVE_DIR=/saves

# Volumes for game data
VOLUME ["/game", "/saves", "/config"]

# Health check - verify entrypoint exists
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD [ -x /usr/local/bin/entrypoint.sh ] || exit 1

# Entrypoint
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
