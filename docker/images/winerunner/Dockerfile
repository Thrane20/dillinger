# BUILDER
FROM docker.io/dillinger/gow-base-app:latest as wine-ge-customer-builder

# 32-bit architecture support
RUN dpkg --add-architecture i386
RUN apt update

# Install wine and wine tricks
RUN apt install -y wget software-properties-common
RUN wget -nc https://dl.winehq.org/wine-builds/winehq.key
RUN apt-key add winehq.key
RUN apt-add-repository 'https://dl.winehq.org/wine-builds/ubuntu/'
RUN apt update

RUN apt install -y --install-recommends winehq-staging
RUN apt install -y winetricks
RUN apt install -y curl
RUN apt install -y xz-utils

# Install GE-Proton binaries - later these will be dynamically downloadable (inbuilt for now)
WORKDIR /opt/dillinger/wine_proton_zips
RUN curl -SL https://github.com/GloriousEggroll/wine-ge-custom/releases/download/GE-Proton8-14/wine-lutris-GE-Proton8-14-x86_64.tar.xz -o wine-lutris-GE-Proton8-14-x86_64.tar.xz

WORKDIR /opt/dillinger/wine-ge-custom
RUN tar -xf /opt/dillinger/wine_proton_zips/wine-lutris-GE-Proton8-14-x86_64.tar.xz

RUN rm -rf /opt/dillinger/wine_proton_zips/wine-lutris-GE-Proton8-14-x86_64.tar.xz

USER ${UNAME}

# This does the starting up of the app
WORKDIR /opt/gow
COPY --chmod=777 scripts/startup.sh /opt/gow/startup-app.sh
