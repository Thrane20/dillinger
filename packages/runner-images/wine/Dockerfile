# Dillinger Wine Game Runner
# Extends base runner with Wine/Proton for running Windows games
# Based on Dillinger Base Runner with Games on Whales architecture

# BASE_VERSION is passed from build.sh (sourced from versioning.env)
ARG BASE_VERSION
FROM ghcr.io/thrane20/dillinger/runner-base:${BASE_VERSION}

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
    lib32-mesa
    lib32-mesa-utils
    lib32-libglvnd
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
# Install UMU Launcher for GE-Proton support
# Required for running GE-Proton outside of Steam
# https://github.com/Open-Wine-Components/umu-launcher
#######################################################

RUN <<_INSTALL_UMU
set -e
echo "**** Installing UMU Launcher ****"

# Install Python dependencies for UMU
pacman -S --noconfirm --needed \
    python \
    python-pip \
    python-xlib \
    python-filelock \
    python-urllib3 \
    git

# Install UMU from PyPI (most reliable method)
pip install --break-system-packages umu-launcher || {
    echo "PyPI install failed, trying from GitHub..."
    
    # Clone and install from source
    cd /tmp
    git clone --depth 1 https://github.com/Open-Wine-Components/umu-launcher.git
    cd umu-launcher
    pip install --break-system-packages . || python -m pip install --break-system-packages .
    cd /
    rm -rf /tmp/umu-launcher
}

# Create directory structure for Wine versions
mkdir -p /opt/wine-versions

# Verify installation
if command -v umu-run &>/dev/null; then
    echo "✓ umu-run installed successfully"
    umu-run --version 2>/dev/null || true
else
    echo "⚠ umu-run not in PATH, checking Python module..."
    python -c "import umu" && echo "✓ UMU Python module available" || echo "⚠ UMU module not found"
fi

echo "**** UMU setup complete ****"
_INSTALL_UMU

#######################################################
# Configure Wine defaults
#######################################################

# Set Wine environment defaults
ENV WINEPREFIX=/wineprefix \
    WINEARCH=win64 \
    WINEDEBUG=-all \
    WINE_LARGE_ADDRESS_AWARE=1

# Create default Wine prefix structure and generate machine-id
# machine-id is needed by Steam Runtime's dbus/launcher-service
RUN mkdir -p /wineprefix && \
    chown -R gameuser:gameuser /wineprefix && \
    dbus-uuidgen > /etc/machine-id && \
    mkdir -p /var/lib/dbus && \
    ln -sf /etc/machine-id /var/lib/dbus/machine-id 2>/dev/null || true

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
