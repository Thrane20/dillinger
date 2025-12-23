# Dillinger Wine Game Runner
# Extends base runner with Wine/Proton for running Windows games
# Based on Dillinger Base Runner with Games on Whales architecture

FROM ghcr.io/thrane20/dillinger/runner-base:latest

LABEL maintainer="Dillinger Project"
LABEL description="Wine game runner extending base runner for Windows games"
LABEL version="2.0.0"

#######################################################
# Install Wine and Windows compatibility layer
#######################################################

RUN <<_INSTALL_WINE
set -e
echo "**** Installing Wine and core dependencies ****"

# Core Wine packages (required)
CORE_WINE_PKGS=(
    wine
    wine-mono
    wine-gecko
    winetricks
)

# 32-bit libraries (best-effort, some may not exist in current repos)
LIB32_PKGS=(
    lib32-gnutls
    lib32-mpg123
    lib32-openal
    lib32-v4l-utils
    lib32-libpulse
    lib32-alsa-plugins
    lib32-alsa-lib
    lib32-libjpeg-turbo
    lib32-libxcomposite
    lib32-libxinerama
    lib32-ncurses
    lib32-opencl-icd-loader
    lib32-libxslt
    lib32-libva
    lib32-gtk3
    lib32-gst-plugins-base-libs
    lib32-vulkan-icd-loader
    lib32-sdl2
)

# Utilities for Windows software installation
UTIL_PKGS=(
    cabextract
    p7zip
    unzip
    zenity
)

# Install core Wine packages (these must exist)
pacman -Sy --noconfirm
pacman -S --noconfirm --needed "${CORE_WINE_PKGS[@]}"

# Install utilities
pacman -S --noconfirm --needed "${UTIL_PKGS[@]}"

# Install lib32 packages, skipping any that don't exist
echo "**** Installing 32-bit libraries (optional) ****"
for pkg in "${LIB32_PKGS[@]}"; do
    if pacman -Si "$pkg" >/dev/null 2>&1; then
        pacman -S --noconfirm --needed "$pkg" || echo "Warning: Failed to install $pkg"
    else
        echo "Skipping unavailable package: $pkg"
    fi
done

echo "**** Cleanup ****"
pacman -Scc --noconfirm
_INSTALL_WINE

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

# NOTE: Do not declare a VOLUME for /wineprefix.
# Historically the runner used /wineprefix, but Dillinger now stores prefixes under
# the installed volume (mounted at /installed) and points WINEPREFIX there.
# Declaring /wineprefix as a VOLUME causes Docker to create an anonymous volume at
# /wineprefix, which is confusing during inspection and can mask mistakes.

WORKDIR /home/gameuser

# Health check - verify Wine is available
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wine --version || exit 1

# Use Wine-specific entrypoint that calls base entrypoint first
ENTRYPOINT ["/usr/local/bin/wine-entrypoint.sh"]
CMD ["/bin/bash"]
