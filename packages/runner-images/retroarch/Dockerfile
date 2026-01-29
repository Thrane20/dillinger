# Dillinger RetroArch Runner
# Extends base runner for multi-system emulation via RetroArch

# BASE_VERSION is passed from build.sh (sourced from versioning.env)
ARG BASE_VERSION=0.2.0
FROM ghcr.io/thrane20/dillinger/runner-base:${BASE_VERSION}

LABEL maintainer="Dillinger Project"
LABEL description="RetroArch multi-system emulator extending base runner"
LABEL version="2.0.0"

#######################################################
# Stage 1: RetroArch Installation
#######################################################

# Install RetroArch and cores
# retroarch: The frontend
# libretro-mame: MAME core for arcade games
# libretro-nestopia: NES emulator core
# libretro-snes9x: SNES emulator core
# libretro-beetle-psx-hw: PlayStation 1 core (hardware accelerated with Vulkan/OpenGL)
# libretro-core-info: Core information files
# retroarch-assets-*: UI assets
# icu: Required for internationalization support (fixes libicui18n.so error)
RUN echo "Refreshing package database..." && \
    pacman -Sy --noconfirm && \
    echo "Installing RetroArch and cores (this may take a few minutes)..." && \
    echo "If downloads are slow, try: docker build --no-cache --network=host ..." && \
    timeout 600 yes | pacman -S --noconfirm --noprogressbar \
    icu \
    retroarch \
    libretro-mame \
    libretro-nestopia \
    libretro-snes9x \
    libretro-beetle-psx-hw \
    libretro-core-info \
    retroarch-assets-xmb \
    retroarch-assets-ozone \
    retroarch-assets-glui || \
    (echo "Installation timed out or failed. Try rebuilding with --no-cache" && exit 1) && \
    echo "Cleaning package cache..." && \
    yes | pacman -Scc --noconfirm && \
    echo "RetroArch installation complete!"

# Create directories for RetroArch
RUN mkdir -p /config/retroarch \
             /roms \
             /saves \
             /states \
             /system \
             /run/user/1000 \
             /usr/share/libretro/autoconfig/udev \
             /usr/share/libretro/autoconfig/sdl2 && \
    chown -R gameuser:gameuser /config/retroarch /roms /saves /states /system /run/user/1000

# Download joypad autoconfig profiles from libretro
# These provide automatic button mapping for common controllers
# We install both udev and sdl2 profiles (sdl2 is used in containers where udev isn't running)
RUN echo "Downloading joypad autoconfig profiles..." && \
    cd /tmp && \
    curl -sL "https://github.com/libretro/retroarch-joypad-autoconfig/archive/refs/heads/master.tar.gz" -o autoconfig.tar.gz && \
    tar -xzf autoconfig.tar.gz && \
    cp -r retroarch-joypad-autoconfig-master/udev/* /usr/share/libretro/autoconfig/udev/ && \
    cp -r retroarch-joypad-autoconfig-master/sdl2/* /usr/share/libretro/autoconfig/sdl2/ && \
    rm -rf autoconfig.tar.gz retroarch-joypad-autoconfig-master && \
    echo "Installed $(ls /usr/share/libretro/autoconfig/udev/*.cfg /usr/share/libretro/autoconfig/sdl2/*.cfg 2>/dev/null | wc -l) autoconfig profiles"

# Copy entrypoint script
COPY retroarch-entrypoint.sh /usr/local/bin/retroarch-entrypoint.sh
RUN chmod +x /usr/local/bin/retroarch-entrypoint.sh

WORKDIR /home/gameuser

# Health check - verify RetroArch is available
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD retroarch --version || exit 1

ENTRYPOINT ["/usr/local/bin/retroarch-entrypoint.sh"]
