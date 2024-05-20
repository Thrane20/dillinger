# Use an official Ubuntu base image
# BUILDER
FROM ubuntu:24.04 as builder

# Build essentials
RUN apt update
# build environment
RUN apt-get install -y \
    cmake \
    gcc \
    git \
    meson \
    pkg-config \
    universal-ctags \
    wget

# Set environment variables to avoid user interaction during installation
ENV DEBIAN_FRONTEND=noninteractive

WORKDIR /root
RUN git clone https://gitlab.freedesktop.org/gstreamer/gst-build.git
WORKDIR /root/gst-build

RUN apt-get install -y flex
RUN apt-get install -y bison

RUN meson setup /build
RUN ninja -C /build