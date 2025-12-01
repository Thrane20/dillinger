# Dillinger MAME Arcade Emulator Runner
# Extends base runner with MAME for running Arcade games
# Based on Dillinger Base Runner with Games on Whales architecture

FROM archlinux:latest

LABEL maintainer="Dillinger Project"
LABEL description="MAME emulator runner (Standalone Build)"
LABEL version="1.0.0"

# Initialize keyring and update system
# Use kernel.org mirror for better reliability
RUN echo 'Server = https://mirrors.kernel.org/archlinux/$repo/os/$arch' > /etc/pacman.d/mirrorlist && \
    pacman-key --init && \
    pacman-key --populate archlinux && \
    pacman -Sy --noconfirm archlinux-keyring && \
    pacman -Syu --noconfirm

# Install base dependencies, MAME, and X11/Audio support
RUN pacman -S --noconfirm \
    base-devel \
    curl \
    wget \
    git \
    sudo \
    mesa \
    xorg-server \
    xorg-xinit \
    pulseaudio \
    alsa-utils \
    ttf-dejavu \
    mame \
    icu \
    libglvnd \
    && pacman -Scc --noconfirm

# Install gosu
RUN GOSU_VERSION=1.17 && \
    ARCH=$(uname -m) && \
    case "$ARCH" in \
        x86_64) GOSU_ARCH="amd64" ;; \
        aarch64) GOSU_ARCH="arm64" ;; \
        *) GOSU_ARCH="amd64" ;; \
    esac && \
    wget -O /usr/local/bin/gosu "https://github.com/tianon/gosu/releases/download/${GOSU_VERSION}/gosu-${GOSU_ARCH}" && \
    chmod +x /usr/local/bin/gosu

# Create gameuser
RUN useradd -m -s /bin/bash -u 1000 gameuser && \
    usermod -aG audio,video,input,disk gameuser && \
    mkdir -p /home/gameuser/.config /home/gameuser/.local/share && \
    chown -R gameuser:gameuser /home/gameuser

# Configure MAME directories
ENV MAME_CONFIG_DIR=/config/mame \
    MAME_ROM_PATH=/roms \
    MAME_SAMPLE_PATH=/samples \
    MAME_ARTWORK_PATH=/artwork \
    XDG_RUNTIME_DIR=/run/user/1000

RUN mkdir -p /config/mame \
             /roms \
             /samples \
             /artwork \
             /run/user/1000 && \
    chown -R gameuser:gameuser /config/mame /roms /samples /artwork /run/user/1000

# Copy entrypoint
COPY mame-entrypoint.sh /usr/local/bin/mame-entrypoint.sh
RUN chmod +x /usr/local/bin/mame-entrypoint.sh

VOLUME ["/config/mame", "/roms", "/samples", "/artwork"]
WORKDIR /home/gameuser

ENTRYPOINT ["/usr/local/bin/mame-entrypoint.sh"]
CMD ["/bin/bash"]
