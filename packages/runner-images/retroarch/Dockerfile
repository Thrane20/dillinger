FROM archlinux:latest

# Configure pacman to use kernel.org mirror
RUN echo 'Server = https://mirrors.kernel.org/archlinux/$repo/os/$arch' > /etc/pacman.d/mirrorlist && \
    pacman-key --init && \
    pacman-key --populate archlinux && \
    pacman -Sy --noconfirm

# Install dependencies
# retroarch: The frontend
# libretro-mame: MAME core
# libretro-fbneo: Final Burn Neo core (good alternative for arcade)
# mesa, xorg-server, pulseaudio: Graphics and audio support
# icu: Required for internationalization support (fixes libicui18n.so error)
RUN pacman -Syu --noconfirm && \
    pacman -S --noconfirm \
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
    icu \
    retroarch \
    libretro-mame \
    libretro-core-info \
    retroarch-assets-xmb \
    retroarch-assets-ozone \
    retroarch-assets-glui \
    libglvnd

# Install gosu for user switching
RUN GOSU_VERSION=1.17 && \
    ARCH=$(uname -m) && \
    case "$ARCH" in \
        x86_64) GOSU_ARCH="amd64" ;; \
        aarch64) GOSU_ARCH="arm64" ;; \
        *) GOSU_ARCH="amd64" ;; \
    esac && \
    curl -o /usr/local/bin/gosu -SL "https://github.com/tianon/gosu/releases/download/$GOSU_VERSION/gosu-$GOSU_ARCH" && \
    chmod +x /usr/local/bin/gosu && \
    gosu nobody true

# Create game user
RUN useradd -m -s /bin/bash -u 1000 gameuser && \
    usermod -aG audio,video,input,disk gameuser && \
    mkdir -p /home/gameuser/.config/retroarch /home/gameuser/.local/share && \
    chown -R gameuser:gameuser /home/gameuser

# Create directories for RetroArch
RUN mkdir -p /config/retroarch \
             /roms \
             /saves \
             /states \
             /system \
             /run/user/1000 && \
    chown -R gameuser:gameuser /config/retroarch /roms /saves /states /system /run/user/1000

# Copy entrypoint script
COPY retroarch-entrypoint.sh /usr/local/bin/retroarch-entrypoint.sh
RUN chmod +x /usr/local/bin/retroarch-entrypoint.sh

WORKDIR /home/gameuser
ENTRYPOINT ["/usr/local/bin/retroarch-entrypoint.sh"]
