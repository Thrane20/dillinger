# BUILDER
FROM ubuntu:23.04 as wine-ge-custom-builder

# 32-bit architecture support
RUN dpkg --add-architecture i386
RUN apt update

# Install wine and wine tricks
RUN apt install -y wget software-properties-common
RUN wget -nc https://dl.winehq.org/wine-builds/winehq.key
RUN apt-key add winehq.key
RUN apt-add-repository 'https://dl.winehq.org/wine-builds/ubuntu/'
RUN apt update

FROM wine-ge-custom-builder as wine-ge-custom
RUN apt install -y --install-recommends winehq-staging
RUN apt install -y winetricks

