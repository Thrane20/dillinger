# Dillinger Wine Game Runner
# Extends base runner with Wine/Proton for running Windows games
# Based on Dillinger Base Runner with Games on Whales architecture

FROM dillinger/runner-base:latest

LABEL maintainer="Dillinger Project"
LABEL description="Wine game runner extending base runner for Windows games"
LABEL version="2.0.0"

ENV DEBIAN_FRONTEND=noninteractive

#######################################################
# Install Wine and Windows compatibility layer
#######################################################

# Add Wine repository for latest stable version
RUN <<_INSTALL_WINE
set -e
echo "**** Adding Wine repository ****"
dpkg --add-architecture i386
mkdir -pm755 /etc/apt/keyrings
wget -O /etc/apt/keyrings/winehq-archive.key https://dl.winehq.org/wine-builds/winehq.key

# Add WineHQ repository
wget -NP /etc/apt/sources.list.d/ https://dl.winehq.org/wine-builds/ubuntu/dists/noble/winehq-noble.sources || \
    echo "deb [signed-by=/etc/apt/keyrings/winehq-archive.key] https://dl.winehq.org/wine-builds/ubuntu/ noble main" > /etc/apt/sources.list.d/winehq.list

echo "**** Installing Wine ****"
apt-get update
apt-get install -y --install-recommends \
    winehq-stable \
    winetricks

echo "**** Installing 32-bit libraries for Wine ****"
apt-get install -y --no-install-recommends \
    libc6:i386 \
    libstdc++6:i386 \
    libgcc-s1:i386 \
    libfreetype6:i386 \
    libfontconfig1:i386 \
    libpulse0:i386 \
    libglib2.0-0:i386 \
    libx11-6:i386 \
    libxext6:i386 \
    libxrender1:i386 \
    libxrandr2:i386 \
    libxinerama1:i386 \
    libxcursor1:i386 \
    libxi6:i386 \
    libxfixes3:i386 \
    libxcomposite1:i386

echo "**** Installing Windows gaming dependencies ****"
apt-get install -y --no-install-recommends \
    cabextract \
    p7zip-full \
    unzip \
    zenity

echo "**** Cleanup ****"
rm -rf /var/lib/apt/lists/*
_INSTALL_WINE

#######################################################
# Install DXVK for DirectX to Vulkan translation
#######################################################

RUN <<_INSTALL_DXVK
set -e
echo "**** Installing DXVK ****"
# DXVK can be installed via winetricks or manually
# For now, we'll prepare the environment for it
mkdir -p /opt/dxvk
echo "DXVK can be installed per-prefix using winetricks dxvk"
_INSTALL_DXVK

#######################################################
# Configure Wine defaults
#######################################################

# Set Wine environment defaults
ENV WINEPREFIX=/wineprefix \
    WINEARCH=win64 \
    WINEDEBUG=-all \
    WINE_LARGE_ADDRESS_AWARE=1

# Create default Wine prefix structure
RUN mkdir -p /wineprefix && \
    chown -R gameuser:gameuser /wineprefix

#######################################################
# Copy Wine-specific entrypoint
#######################################################

# Copy the original entrypoint from base
# Then add Wine initialization
COPY wine-entrypoint.sh /usr/local/bin/wine-entrypoint.sh
RUN chmod +x /usr/local/bin/wine-entrypoint.sh

# Copy helper scripts for Wine
COPY scripts/ /opt/dillinger/wine-scripts/
RUN chmod +x /opt/dillinger/wine-scripts/*.sh || true

#######################################################
# Volumes and Working Directory
#######################################################

# Additional volumes for Wine
VOLUME ["/wineprefix"]

WORKDIR /home/gameuser

# Health check - verify Wine is available
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wine --version || exit 1

# Use Wine-specific entrypoint that calls base entrypoint first
ENTRYPOINT ["/usr/local/bin/wine-entrypoint.sh"]
CMD ["/bin/bash"]
