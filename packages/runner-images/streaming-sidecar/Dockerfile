# syntax=docker/dockerfile:1.7

ARG UBUNTU_VERSION=25.04
ARG GSTREAMER_VERSION=1.26.7
ARG RUST_VERSION=1.91.1

FROM ubuntu:${UBUNTU_VERSION} AS gstreamer-builder
ARG GSTREAMER_VERSION
ENV DEBIAN_FRONTEND=noninteractive
ENV GSTREAMER_VERSION=${GSTREAMER_VERSION}
WORKDIR /build

RUN apt-get update -y && apt-get install -y --no-install-recommends \
    build-essential ninja-build gcc meson cmake ccache bison equivs \
    pkg-config \
    ca-certificates git curl \
    flex libx265-dev libopus-dev nasm libzxing-dev libzbar-dev libdrm-dev libva-dev \
    libvpl-dev libunwind8 libcap2-bin \
    libx11-dev libx11-xcb-dev libxfixes-dev libxdamage-dev libwayland-dev wayland-protocols libpulse-dev libglib2.0-dev \
    libopenjp2-7-dev liblcms2-dev libcairo2-dev libcairo-gobject2 libwebp7 librsvg2-dev libaom-dev \
    libharfbuzz-dev libpango1.0-dev libsoup-2.4-1 libopengl-dev libgbm-dev libegl-dev \
    libglu1-mesa-dev freeglut3-dev mesa-common-dev libgl1-mesa-dev libgles-dev libgl-dev libglx-dev libgudev-1.0-dev libudev-dev \
    && rm -rf /var/lib/apt/lists/*

RUN <<'GSTREAMER_BUILD'
    set -e

    git clone https://gitlab.freedesktop.org/gstreamer/gstreamer.git /build/gstreamer
    cd /build/gstreamer
    git checkout "${GSTREAMER_VERSION}"
    git submodule update --recursive --remote

    meson setup \
        --buildtype=release \
        --strip \
        -Dgst-full-libraries=app,video \
        -Dorc=disabled \
        -Dgpl=enabled \
        -Dbase=enabled \
        -Dgood=enabled \
        -Dugly=enabled \
        -Drs=disabled \
        -Dtls=disabled \
        -Dgst-examples=disabled \
        -Dlibav=disabled \
        -Dtests=disabled \
        -Dexamples=disabled \
        -Ddoc=disabled \
        -Dpython=disabled \
        -Drtsp_server=disabled \
        -Dqt5=disabled \
        -Dbad=enabled \
        -Dgst-plugins-good:soup=disabled \
        -Dgst-plugins-good:ximagesrc=enabled \
        -Dgst-plugins-good:pulse=enabled \
        -Dgst-plugins-bad:x265=enabled \
        -Dgst-plugins-bad:qsv=enabled \
        -Dgst-plugins-bad:aom=enabled \
        -Dgst-plugins-bad:nvcodec=enabled \
        -Dgst-plugins-base:gl=enabled \
        -Dgstreamer-vaapi:x11=disabled \
        -Dgst-plugins-base:gl_winsys=wayland,egl,gbm,surfaceless \
        -Dvaapi=enabled \
        build

    meson compile -C build
    meson install -C build

    git clone https://github.com/games-on-whales/gst-interpipe.git /build/gst-interpipe
    cd /build/gst-interpipe
    meson build -Denable-gtk-doc=false
    meson install -C build

    rm -rf /build/gstreamer /build/gst-interpipe
GSTREAMER_BUILD

FROM gstreamer-builder AS gpu-drivers
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update -y && apt-get install -y --no-install-recommends \
    va-driver-all intel-media-va-driver-non-free \
    libmfx-gen1.2 libigfxcmrt7 \
    libva-drm2 libva-x11-2 libvpl2 \
    && rm -rf /var/lib/apt/lists/*

RUN <<'BUILD_LIBMFX'
    set -e

    apt-get update -y
    apt-get install -y curl git build-essential cmake pkg-config \
        libdrm-dev libva-dev libx11-dev libx11-xcb-dev libxcb-present-dev libxcb-dri3-dev

    cd /tmp
    git clone https://github.com/Intel-Media-SDK/MediaSDK msdk
    cd msdk
    git submodule init
    git pull

    curl -fsSL https://patch-diff.githubusercontent.com/raw/Intel-Media-SDK/MediaSDK/pull/3005.patch | git apply -

    mkdir build
    cd build
    cmake -DCMAKE_BUILD_TYPE=Release -DENABLE_WAYLAND=ON -DENABLE_X11_DRI3=ON -DENABLE_OPENCL=ON ../
    make -j"$(nproc)"
    make install -j"$(nproc)"

    echo "/opt/intel/mediasdk/lib" >> /etc/ld.so.conf.d/msdk.conf
    echo "/opt/intel/mediasdk/plugins" >> /etc/ld.so.conf.d/msdk.conf
    ldconfig

    apt-get remove -y --purge curl git build-essential cmake pkg-config
    rm -rf /var/lib/apt/lists/* /tmp/*
BUILD_LIBMFX

RUN <<'ADD_NVRTC'
    set -e

    apt-get update -y
    apt-get install -y unzip curl

    cd /tmp
    curl -fsSL -o nvidia_cuda_nvrtc_linux_x86_64.whl "https://developer.download.nvidia.com/compute/redist/nvidia-cuda-nvrtc/nvidia_cuda_nvrtc-11.0.221-cp36-cp36m-linux_x86_64.whl"
    unzip -joq -d ./nvrtc nvidia_cuda_nvrtc_linux_x86_64.whl
    cd nvrtc
    chmod 755 libnvrtc*
    find . -maxdepth 1 -type f -name "*libnvrtc.so.*" -exec sh -c 'ln -snf $(basename {}) libnvrtc.so' \;
    mkdir -p /usr/local/nvidia/lib
    mv -f libnvrtc* /usr/local/nvidia/lib

    echo "/usr/local/nvidia/lib" >> /etc/ld.so.conf.d/nvidia.conf
    echo "/usr/local/nvidia/lib64" >> /etc/ld.so.conf.d/nvidia.conf

    apt-get remove -y --purge unzip curl
    rm -rf /var/lib/apt/lists/* /tmp/*
ADD_NVRTC

FROM gpu-drivers AS wolf-builder
ARG RUST_VERSION
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update -y && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    ninja-build \
    cmake \
    pkg-config \
    ccache \
    git \
    clang \
    build-essential \
    libboost-thread-dev libboost-locale-dev libboost-filesystem-dev libboost-log-dev libboost-stacktrace-dev libboost-container-dev \
    libwayland-dev libwayland-server0 libinput-dev libxkbcommon-dev libgbm-dev \
    libcurl4-openssl-dev \
    libssl-dev \
    libevdev-dev \
    libpulse-dev \
    libunwind-dev \
    libudev-dev \
    libdrm-dev \
    libpci-dev \
    libglib2.0-dev libegl-dev libgles-dev libopengl-dev \
    && rm -rf /var/lib/apt/lists/*

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"
RUN rustup install ${RUST_VERSION} && rustup default ${RUST_VERSION}

COPY third_party/gst-wayland-display /build/gst-wayland-display
RUN <<'GST_WAYLAND_DISPLAY'
    set -e

    cd /build/gst-wayland-display
    cargo install cargo-c
    cargo cinstall --features="cuda" --prefix=/usr/local/lib/x86_64-linux-gnu/ --libdir=/usr/local/lib/x86_64-linux-gnu/gstreamer-1.0
GST_WAYLAND_DISPLAY

COPY third_party/wolf /build/wolf
WORKDIR /build/wolf

ENV CCACHE_DIR=/cache/ccache
ENV CMAKE_BUILD_DIR=/cache/cmake-build
RUN --mount=type=cache,target=/cache/ccache \
    cmake -B"${CMAKE_BUILD_DIR}" \
    -DCMAKE_BUILD_TYPE=RelWithDebInfo \
    -DCMAKE_CXX_STANDARD=20 \
    -DCMAKE_CXX_EXTENSIONS=OFF \
    -DCMAKE_CXX_FLAGS="-Wno-missing-template-arg-list-after-template-kw" \
    -DBUILD_SHARED_LIBS=OFF \
    -DBoost_USE_STATIC_LIBS=ON \
    -DBUILD_FAKE_UDEV_CLI=ON \
    -DBUILD_TESTING=OFF \
    -G Ninja && \
    ninja -C "${CMAKE_BUILD_DIR}" wolf && \
    ninja -C "${CMAKE_BUILD_DIR}" fake-udev && \
    mkdir -p /wolf && \
    cp "${CMAKE_BUILD_DIR}/src/moonlight-server/wolf" /wolf/wolf && \
    cp "${CMAKE_BUILD_DIR}/src/fake-udev/fake-udev" /wolf/fake-udev

FROM gpu-drivers AS runtime
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update -y && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl3 \
    libicu76 \
    libevdev2 \
    libudev1 \
    libcurl4 \
    libdrm2 \
    libpci3 \
    libunwind8 \
    libpulse0 \
    libwayland-server0 libinput10 libxkbcommon0 libgbm1 \
    libglvnd0 libgl1 libglx0 libegl1 libgles2 xwayland hwdata \
    && rm -rf /var/lib/apt/lists/*

ENV GST_PLUGIN_PATH=/usr/local/lib/x86_64-linux-gnu/gstreamer-1.0/
ENV GST_PLUGIN_SCANNER=/usr/local/libexec/gstreamer-1.0/gst-plugin-scanner

COPY --from=wolf-builder /usr/local/lib/x86_64-linux-gnu/gstreamer-1.0/* ${GST_PLUGIN_PATH}
COPY --from=wolf-builder /usr/local/lib/liblibgstwaylanddisplay* /usr/local/lib/
COPY --from=wolf-builder /wolf/wolf /wolf/wolf
COPY --from=wolf-builder /wolf/fake-udev /wolf/fake-udev

WORKDIR /wolf

ENV GST_GL_API=gles2 \
    GST_GL_PLATFORM=egl \
    GST_GL_WINDOW=surfaceless \
    WOLF_USE_ZERO_COPY=TRUE \
    WOLF_LOG_LEVEL=INFO \
    WOLF_RENDER_NODE=/dev/dri/renderD128 \
    RUST_BACKTRACE=full \
    RUST_LOG=WARN \
    GST_DEBUG=2 \
    PUID=0 \
    PGID=0 \
    UNAME="root"

COPY packages/runner-images/streaming-sidecar/streaming-sidecar-entrypoint.sh /opt/dillinger/streaming-sidecar-entrypoint.sh
COPY packages/runner-images/streaming-sidecar/dillinger-agent.sh /opt/dillinger/dillinger-agent.sh
COPY packages/runner-images/streaming-sidecar/gst-video-test.sh /opt/dillinger/gst-video-test.sh
COPY packages/runner-images/streaming-sidecar/gst-av-test.sh /opt/dillinger/gst-av-test.sh
RUN chmod +x /opt/dillinger/streaming-sidecar-entrypoint.sh \
    /opt/dillinger/dillinger-agent.sh \
    /opt/dillinger/gst-video-test.sh \
    /opt/dillinger/gst-av-test.sh

EXPOSE 47984/tcp
EXPOSE 47989/tcp
EXPOSE 47999/udp
EXPOSE 48010/tcp
EXPOSE 48100/udp
EXPOSE 48200/udp
EXPOSE 9999/tcp

ENTRYPOINT ["/opt/dillinger/streaming-sidecar-entrypoint.sh"]
