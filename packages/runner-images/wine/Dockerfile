# Dillinger Wine Game Runner
# Extends base runner with Wine/Proton for running Windows games
# Based on Dillinger Base Runner with Games on Whales architecture

FROM dillinger/runner-base:latest

LABEL maintainer="Dillinger Project"
LABEL description="Wine game runner extending base runner for Windows games"
LABEL version="2.0.0"

#######################################################
# Install Wine and Windows compatibility layer
#######################################################

RUN set -e && \
    echo "**** Installing Wine ****" && \
    echo "[multilib]" >> /etc/pacman.conf && \
    echo "Include = /etc/pacman.d/mirrorlist" >> /etc/pacman.conf && \
    \
    pacman -Sy --noconfirm && \
    \
    pacman -S --noconfirm \
        wine \
        wine-mono \
        wine-gecko \
        winetricks \
        lib32-gnutls \
        lib32-libldap \
        lib32-mpg123 \
        lib32-openal \
        lib32-v4l-utils \
        lib32-libpulse \
        lib32-alsa-plugins \
        lib32-alsa-lib \
        lib32-libjpeg-turbo \
        lib32-libxcomposite \
        lib32-libxinerama \
        lib32-ncurses \
        lib32-opencl-icd-loader \
        lib32-libxslt \
        lib32-libva \
        lib32-gtk3 \
        lib32-gst-plugins-base-libs \
        lib32-vulkan-icd-loader \
        lib32-sdl2 && \
    \
    echo "**** Installing Windows gaming dependencies ****" && \
    pacman -S --noconfirm \
        cabextract \
        p7zip \
        unzip \
        zenity && \
    \
    echo "**** Cleanup ****" && \
    pacman -Scc --noconfirm

#######################################################
# Install DXVK for DirectX to Vulkan translation
#######################################################

RUN set -e && \
    echo "**** Installing DXVK ****" && \
    mkdir -p /opt/dxvk && \
    echo "DXVK can be installed per-prefix using winetricks dxvk"

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
