ARG BASE_IMAGE
FROM $BASE_IMAGE AS builder

# All the base things...
RUN dpkg --add-architecture i386
RUN apt-get update

# Wine - this makes all the window->linuxy things happen
RUN apt-get install -y wget gnupg2 software-properties-common
RUN wget -qO - https://dl.winehq.org/wine-builds/winehq.key | apt-key add -
RUN apt-add-repository 'deb https://dl.winehq.org/wine-builds/ubuntu/ jammy main'
RUN apt-get update
RUN apt-get install -y --install-recommends winehq-staging winetricks
RUN apt-get install -y mesa-utils

# Get opentrack builds
COPY ./dillinger_builds/opentrack /opt/opentrack

# Add the directory containing the .so files to the LD_LIBRARY_PATH environment variable
ENV LD_LIBRARY_PATH=/opt/opentrack/lib:${LD_LIBRARY_PATH}

# This is only here for debugging purposes 
# (when no run command is given, this will keep the container open)
CMD ["/bin/bash"]