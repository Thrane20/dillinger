# Dillinger RetroArch Runner
# Extends base runner for multi-system emulation via RetroArch

# BASE_VERSION is passed from build.sh (sourced from versioning.env)
ARG BASE_VERSION
FROM ghcr.io/thrane20/dillinger/runner-base:${BASE_VERSION}

LABEL maintainer="Dillinger Project"
LABEL description="RetroArch multi-system emulator extending base runner"
LABEL version="2.0.0"

#######################################################
# Stage 1: RetroArch Installation
#######################################################

# Install RetroArch and cores
# retroarch: The frontend
# libretro-mame: MAME core
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
             /run/user/1000 && \
    chown -R gameuser:gameuser /config/retroarch /roms /saves /states /system /run/user/1000

# Copy entrypoint script
COPY retroarch-entrypoint.sh /usr/local/bin/retroarch-entrypoint.sh
RUN chmod +x /usr/local/bin/retroarch-entrypoint.sh

WORKDIR /home/gameuser
ENTRYPOINT ["/usr/local/bin/retroarch-entrypoint.sh"]
