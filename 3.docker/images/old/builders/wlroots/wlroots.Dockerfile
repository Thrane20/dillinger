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

# libraries
RUN apt-get install -y freerdp2-dev
RUN apt-get install -y libavcodec-dev 
RUN apt-get install -y libavformat-dev 
    
RUN apt-get install -y
RUN apt-get install -y libdrm-dev
RUN apt-get install -y libinput-dev 
    
RUN apt-get install -y libpixman-1-dev \
    libsystemd-dev \
    libwayland-dev \
    libudev-dev \
    libxcb-icccm4-dev \
    libxcb-xinput-dev \
    libxkbcommon-dev \
    wayland-protocols


RUN mkdir -p /home/retro/install
RUN useradd -m retro

# build wlroots
WORKDIR /root
RUN git clone https://gitlab.freedesktop.org/wlroots/wlroots.git
WORKDIR /root/wlroots
COPY ./docker/images/builders/wlroots/libdrm-2.4.119/ ./subprojects/libdrm/
COPY ./docker/images/builders/wlroots/libdrm.wrap ./subprojects/libdrm.wrap
RUN apt-get install -y libseat-dev

RUN apt-get install -y xwayland
RUN apt-get install -y libxcb-composite0-dev
RUN apt-get install -y libxcb-ewmh-dev
RUN apt-get install -y libxcb-res0-dev
RUN apt-get install -y hwdata
RUN apt-get install -y libdisplay-info-dev
RUN apt-get install -y libxcb-dri3-dev
RUN apt-get install -y libxcb-present-dev
RUN apt-get install -y libxcb-render-util0-dev
RUN apt-get install -y libxcb-shm0-dev

WORKDIR /root/wlroots
RUN meson setup build/ -Dsession=enabled -Dxwayland=enabled -Dbackends=x11,libinput

RUN apt-get install -y ninja-build
RUN ninja -C build
RUN ninja -C build install
RUN cp /root/wlroots/build/tinywl/tinywl /home/retro/install/tinywl
RUN chown retro:retro /home/retro/install/tinywl
RUN chmod +x /home/retro/install/tinywl

# USER retro


CMD ["/root/wlroots/build/tinywl/tinywl"]
