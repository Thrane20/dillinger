ARG BASE_IMAGE
FROM $BASE_IMAGE AS builder

# All the base things...
RUN dpkg --add-architecture i386
RUN apt-get update

ARG TARGETARCH TARGETVARIANT

ENV \
    PUID=1000 \
    PGID=1000 \
    UMASK=000 \
    UNAME="root" \
    HOME="/home/root"

RUN apt-get update

RUN apt-get install -y ca-certificates x11-utils pulseaudio-utils mesa-vulkan-drivers libgbm1 libgles2-mesa libegl1 libgl1-mesa-dri \
    fuse libnss3 wget

RUN rm -rf /var/lib/apt/lists/*

# Import overlay
COPY /images/runners/overlay /

COPY xorg/configs/xorg.conf /usr/share/X11/xorg.conf.d/20-sunshine.conf
COPY xorg/configs/xorg-nvidia.conf /usr/share/X11/xorg.conf.d/09-nvidia-custom-location.conf
COPY xorg/configs/desktop.jwmrc.xml $HOME/.jwmrc

# TODO: is this really needed anymore? run-gow automatically mounts these from
# the host most of the time. I suppose it's helpful for less-well-supported distros
COPY --chmod=777 xorg/scripts/ensure-nvidia-xorg-driver.sh /opt/gow/ensure-nvidia-xorg-driver.sh
COPY --chmod=777 xorg/scripts/startup.sh /opt/gow/startup.sh

COPY --chmod=777 images/runners/scripts/wait-x11 /opt/gow/wait-x11
COPY --chmod=777 images/runners/scripts/startup.sh /opt/gow/startup.sh

# Get opentrack builds
COPY ./dillinger_builds/opentrack /opt/opentrack

# Add the directory containing the .so files to the LD_LIBRARY_PATH environment variable
ENV LD_LIBRARY_PATH=/opt/opentrack/libexec/opentrack:$LD_LIBRARY_PATH

# Set entrypoint script
CMD ["/bin/bash"]
# ENTRYPOINT ["/entrypoint.sh"]