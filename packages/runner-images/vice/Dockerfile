# Dillinger VICE Commodore Emulator Runner
# Extends base runner with VICE for running Commodore games (C64, C128, VIC-20, etc.)
# Based on Dillinger Base Runner with Games on Whales architecture

FROM dillinger/runner-base:latest

LABEL maintainer="Dillinger Project"
LABEL description="VICE emulator runner extending base runner for Commodore games"
LABEL version="1.0.0"

#######################################################
# Install VICE Commodore Emulator
#######################################################

RUN set -e && \
    echo "**** Installing VICE Commodore Emulator ****" && \
    pacman -Sy --noconfirm && \
    \
    pacman -S --noconfirm \
        vice && \
    \
    echo "**** Cleanup ****" && \
    pacman -Scc --noconfirm

#######################################################
# Configure VICE defaults
#######################################################

# Set VICE environment defaults
ENV VICE_ROM_PATH=/usr/lib/vice \
    VICE_CONFIG_DIR=/config/vice

# Create VICE configuration directory
RUN mkdir -p /config/vice && \
    chown -R gameuser:gameuser /config/vice

#######################################################
# Copy VICE-specific entrypoint
#######################################################

# Copy the VICE entrypoint
COPY vice-entrypoint.sh /usr/local/bin/vice-entrypoint.sh
RUN chmod +x /usr/local/bin/vice-entrypoint.sh

#######################################################
# Volumes and Working Directory
#######################################################

# Additional volumes for VICE
VOLUME ["/config/vice", "/roms"]

WORKDIR /home/gameuser

# Health check - verify VICE is available
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD x64sc --version || exit 1

# Use VICE-specific entrypoint that calls base entrypoint first
ENTRYPOINT ["/usr/local/bin/vice-entrypoint.sh"]
CMD ["/bin/bash"]
