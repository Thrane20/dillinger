# Dillinger Linux Native Game Runner
# Extends base runner for running native Linux games and applications

# BASE_VERSION is passed from build.sh (sourced from versioning.env)
ARG BASE_VERSION
FROM ghcr.io/thrane20/dillinger/runner-base:${BASE_VERSION}

LABEL maintainer="Dillinger Project"
LABEL description="Linux native game runner extending base runner"
LABEL version="2.0.0"

#######################################################
# Install additional gaming libraries for native Linux games
#######################################################

RUN <<_INSTALL_NATIVE
set -e
echo "**** Refreshing pacman mirrors ****"
if command -v reflector >/dev/null 2>&1; then
    reflector --verbose --latest 10 --protocol https --sort rate --fastest 5 --save /etc/pacman.d/mirrorlist || true
fi
pacman -Syy --noconfirm

echo "**** Installing native Linux gaming libraries ****"
if ! pacman -S --noconfirm --needed \
    sdl2 \
    sdl2_image \
    sdl2_mixer \
    sdl2_ttf \
    sdl2_net \
    openal \
    libvorbis \
    libtheora \
    libogg \
    flac \
    libsndfile \
    glew \
    curl \
    libpng \
    libjpeg-turbo \
    zlib \
    ncurses; then
    echo "**** Package install failed; refreshing mirrors and retrying ****"
    if command -v reflector >/dev/null 2>&1; then
        reflector --verbose --latest 20 --protocol https --sort rate --fastest 10 --save /etc/pacman.d/mirrorlist || true
    fi
    pacman -Syy --noconfirm
    pacman -S --noconfirm --needed \
        sdl2 \
        sdl2_image \
        sdl2_mixer \
        sdl2_ttf \
        sdl2_net \
        openal \
        libvorbis \
        libtheora \
        libogg \
        flac \
        libsndfile \
        glew \
        curl \
        libpng \
        libjpeg-turbo \
        zlib \
        ncurses
fi

echo "**** Install 32-bit libraries for 32-bit games ****"
OPTIONAL_32BIT_PKGS=(
    lib32-sdl2 \
    lib32-openal \
    lib32-mesa \
    lib32-glu
)

for pkg in "${OPTIONAL_32BIT_PKGS[@]}"; do
    if pacman -Si "$pkg" >/dev/null 2>&1; then
        pacman -S --noconfirm --needed "$pkg"
    else
        echo "**** Skipping missing optional package: $pkg ****"
    fi
done

echo "**** Cleanup ****"
pacman -Scc --noconfirm
_INSTALL_NATIVE

#######################################################
# Install Steam Runtime (optional for Steam games)
#######################################################

RUN <<_INSTALL_STEAM_RUNTIME
set -e
echo "**** Preparing for Steam Runtime support ****"
mkdir -p /opt/steam-runtime
echo "Steam Runtime can be mounted at /opt/steam-runtime if needed"
_INSTALL_STEAM_RUNTIME

#######################################################
# Copy Linux Native-specific entrypoint
#######################################################

COPY native-entrypoint.sh /usr/local/bin/native-entrypoint.sh
RUN chmod +x /usr/local/bin/native-entrypoint.sh

WORKDIR /home/gameuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD [ -x /usr/local/bin/native-entrypoint.sh ] || exit 1

# Use native-specific entrypoint that calls base entrypoint
ENTRYPOINT ["/usr/local/bin/native-entrypoint.sh"]
CMD ["/bin/bash"]
