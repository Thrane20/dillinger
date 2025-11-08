# Dillinger Linux Native Game Runner
# Extends base runner for running native Linux games and applications

FROM dillinger/runner-base:latest

LABEL maintainer="Dillinger Project"
LABEL description="Linux native game runner extending base runner"
LABEL version="2.0.0"

ENV DEBIAN_FRONTEND=noninteractive

#######################################################
# Install additional gaming libraries for native Linux games
#######################################################

RUN <<_INSTALL_NATIVE
set -e
echo "**** Installing native Linux gaming libraries ****"
apt-get update
apt-get install -y --no-install-recommends \
    # SDL2 for game input/controllers
    libsdl2-2.0-0 \
    libsdl2-image-2.0-0 \
    libsdl2-mixer-2.0-0 \
    libsdl2-ttf-2.0-0 \
    libsdl2-net-2.0-0 \
    # OpenAL for 3D audio
    libopenal1 \
    libopenal-data \
    # Additional gaming libraries
    libvorbisfile3 \
    libtheora0 \
    libogg0 \
    libflac12 \
    libsndfile1 \
    libglew2.2 \
    # Common game dependencies
    libcurl4 \
    libpng16-16 \
    libjpeg-turbo8 \
    zlib1g \
    libncurses6 \
    libncursesw6

echo "**** Install 32-bit libraries for 32-bit games ****"
dpkg --add-architecture i386
apt-get update
apt-get install -y --no-install-recommends \
    libsdl2-2.0-0:i386 \
    libopenal1:i386 \
    libgl1:i386 \
    libglu1-mesa:i386

echo "**** Cleanup ****"
rm -rf /var/lib/apt/lists/*
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
