# BUILDER
FROM ubuntu:22.10

# Build essentials
RUN apt update
RUN apt install -y git build-essential meson ninja-build python3-setuptools cmake hwdata 
RUN apt install -y libx11-xcb-dev libxxf86vm-dev libxres-dev libxmu-dev libsdl2-dev libinput-dev libseat-dev
RUN apt install -y libxcb-composite0-dev libxcb-icccm4-dev libxcb-res0-dev glslang-tools libpipewire-0.3-dev
RUN apt install -y libwlroots-dev libvulkan-dev 
RUN apt install -y libwlroots10 libxcb-dri3-dev libxcb-image0-dev libxcb-present-dev libxcb-render-util0-dev
RUN apt install -y libxcb-sync-dev libxmu-dev libbenchmark-dev libxcb-res0-dev glslang-tools 
RUN apt install -y software-properties-common
RUN apt install wget

# RUN apt install -y libliftoff-dev 
# RUN apt install -y libliftoff0 libstb-dev libstb0
RUN wget -qO- https://packages.lunarg.com/lunarg-signing-key-pub.asc | tee /etc/apt/trusted.gpg.d/lunarg.asc
RUN wget -qO /etc/apt/sources.list.d/lunarg-vulkan-jammy.list http://packages.lunarg.com/vulkan/lunarg-vulkan-jammy.list
RUN apt update
RUN apt install -y vulkan-sdk

# Get the gamescope source code
RUN mkdir /home/src
RUN cd /home/src
WORKDIR /home/src
RUN git clone https://github.com/ValveSoftware/gamescope.git
WORKDIR /home/src/gamescope
RUN git submodule update --init

# RUN apt install -y hwdata

# And build via meson and ninja
RUN meson build/

CMD ["/bin/bash"]
