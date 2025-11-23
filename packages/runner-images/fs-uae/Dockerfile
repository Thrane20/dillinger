# Dillinger FS-UAE Amiga Emulator Runner
# Extends base runner with FS-UAE for running Amiga games
# Based on Dillinger Base Runner with Games on Whales architecture

FROM dillinger/runner-base:latest

LABEL maintainer="Dillinger Project"
LABEL description="FS-UAE emulator runner extending base runner for Amiga games"
LABEL version="1.0.0"

#######################################################
# Install FS-UAE Amiga Emulator
#######################################################

RUN set -e && \
    echo "**** Installing FS-UAE Amiga Emulator ****" && \
    \
    # Install dependencies for FS-UAE
    pacman -Sy --noconfirm && \
    pacman -S --noconfirm \
        libpng \
        zlib \
        sdl2 \
        openal \
        libpulse \
        alsa-plugins \
        libmpeg2 \
        freetype2 \
        glew \
        libgl && \
    \
    echo "**** Cleanup ****" && \
    pacman -Scc --noconfirm

# Copy and extract FS-UAE binary
COPY FS-UAE_3.2.35_Linux_x86-64.tar.xz /tmp/fs-uae.tar.xz

RUN set -e && \
    echo "**** Installing FS-UAE binary ****" && \
    cd /tmp && \
    tar xf fs-uae.tar.xz && \
    cd FS-UAE && \
    mkdir -p /opt/fs-uae && \
    cp -r * /opt/fs-uae/ && \
    \
    # Copy data to standard system location
    mkdir -p /usr/share/fs-uae && \
    cp /opt/fs-uae/Linux/x86-64/fs-uae.dat /usr/share/fs-uae/ && \
    if [ -d "/opt/fs-uae/Locale" ]; then cp -r /opt/fs-uae/Locale /usr/share/fs-uae/; fi && \
    \
    # Create symlinks for main executables
    ln -sf /opt/fs-uae/Linux/x86-64/fs-uae /usr/bin/fs-uae && \
    ln -sf /opt/fs-uae/Linux/x86-64/fs-uae-device-helper /usr/bin/fs-uae-device-helper && \
    \
    # Configure OpenAL to use PulseAudio
    mkdir -p /etc/openal && \
    echo "drivers = pulse" > /etc/openal/alsoft.conf && \
    \
    echo "**** Cleanup ****" && \
    cd / && \
    rm -rf /tmp/fs-uae.tar.xz /tmp/FS-UAE

#######################################################
# Configure FS-UAE defaults
#######################################################

# Set FS-UAE environment defaults
ENV FSUAE_CONFIG_DIR=/config/fs-uae \
    FSUAE_KICKSTARTS_DIR=/bios

# Create FS-UAE configuration directories
RUN mkdir -p /config/fs-uae /bios && \
    chown -R gameuser:gameuser /config/fs-uae /bios

#######################################################
# Copy FS-UAE-specific entrypoint
#######################################################

# Copy the FS-UAE entrypoint
COPY fs-uae-entrypoint.sh /usr/local/bin/fs-uae-entrypoint.sh
RUN chmod +x /usr/local/bin/fs-uae-entrypoint.sh

#######################################################
# Volumes and Working Directory
#######################################################

# Additional volumes for FS-UAE
VOLUME ["/config/fs-uae", "/roms", "/bios"]

WORKDIR /home/gameuser

# Health check - verify FS-UAE is available
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD fs-uae --version || exit 1

# Use FS-UAE-specific entrypoint that calls base entrypoint first
ENTRYPOINT ["/usr/local/bin/fs-uae-entrypoint.sh"]
CMD ["/bin/bash"]
