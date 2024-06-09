# BUILDER
FROM ubuntu:23.04

ENV DEBIAN_FRONTEND=noninteractive

# 32-bit architecture support
RUN dpkg --add-architecture i386
RUN apt update

# All the base things...
RUN apt-get install -y wget qtbase5-dev fuse libnss3 wget
RUN apt-get install -y --reinstall --no-install-recommends ca-certificates
RUN apt-get install -y --no-install-recommends \
    x11-utils \
    pulseaudio-utils \
    mesa-vulkan-drivers libgbm1 libgles2-mesa libegl1 libgl1-mesa-dri 

RUN apt-get install -y --no-install-recommends \
    alsa-utils \
    libasound2 \
    libasound2-plugins \
    pulseaudio

ENV UNAME="root" HOME="/root" 

# Copy base scripts
COPY images/base/scripts /opt/dillinger/scripts

# Copy pulse audio config
COPY images/base/pulse_config/default.pa /etc/pulse/default.pa
COPY images/base/pulse_config/client.conf /etc/pulse/client.conf
COPY images/base/pulse_config/daemon.conf /etc/pulse/daemon.conf
CMD [ "/bin/bash", "-c", "bash" ]