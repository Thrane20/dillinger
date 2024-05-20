# BUILDER
ARG BASE_IMAGE
FROM $BASE_IMAGE AS builder

# All the base things...
RUN dpkg --add-architecture i386
RUN apt-get update
RUN apt-get install -y wget gnupg2 software-properties-common
RUN apt-get install -y build-essential
RUN apt-get install -y git
RUN apt-get install -y cmake
RUN apt-get install -y qttools5-dev
RUN apt-get install -y qtbase5-dev
RUN apt-get install -y qtbase5-private-dev
RUN apt-get install -y libproc2-dev
RUN apt-get install -y libopencv-dev

# Wine
RUN apt-get install -y mingw-w64
RUN wget -qO - https://dl.winehq.org/wine-builds/winehq.key | apt-key add -
RUN apt-add-repository 'deb https://dl.winehq.org/wine-builds/ubuntu/ jammy main'
RUN apt-get update
RUN apt-get install -y --install-recommends winehq-staging
RUN apt-get install -y wine-development
RUN apt-get install -y wine-staging-dev

CMD ["/bin/bash"]