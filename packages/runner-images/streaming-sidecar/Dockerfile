FROM archlinux:latest

ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

# Base tools and chaotic-aur bootstrap for Sunshine
RUN set -e && \
    pacman -Sy --noconfirm archlinux-keyring && \
    pacman-key --init && \
    pacman-key --populate archlinux && \
    pacman -Syu --noconfirm --needed ca-certificates curl gnupg && \
    curl -L -o /tmp/chaotic-keyring.pkg.tar.zst https://cdn-mirror.chaotic.cx/chaotic-aur/chaotic-keyring.pkg.tar.zst && \
    curl -L -o /tmp/chaotic-mirrorlist.pkg.tar.zst https://cdn-mirror.chaotic.cx/chaotic-aur/chaotic-mirrorlist.pkg.tar.zst && \
    pacman -U --noconfirm /tmp/chaotic-keyring.pkg.tar.zst /tmp/chaotic-mirrorlist.pkg.tar.zst && \
    rm -f /tmp/chaotic-keyring.pkg.tar.zst /tmp/chaotic-mirrorlist.pkg.tar.zst && \
    echo "[chaotic-aur]" >> /etc/pacman.conf && \
    echo "Include = /etc/pacman.d/chaotic-mirrorlist" >> /etc/pacman.conf

RUN set -e && \
    pacman -Syu --noconfirm --needed \
      sway \
      swaybg \
      seatd \
      gamescope \
      wayland \
      xorg-xwayland \
      mesa \
      vulkan-radeon \
      vulkan-icd-loader \
      libinput \
      libevdev \
      pipewire \
      wireplumber \
      pipewire-pulse \
      nodejs \
      gettext \
            procps-ng && \
    pacman -Scc --noconfirm

RUN set -e && \
    pacman -S --noconfirm --needed zstd && \
    curl -L -o /tmp/icu-76.1-1-x86_64.pkg.tar.zst https://archive.archlinux.org/packages/i/icu/icu-76.1-1-x86_64.pkg.tar.zst && \
    mkdir -p /tmp/icu76 && \
    tar --use-compress-program=unzstd -xf /tmp/icu-76.1-1-x86_64.pkg.tar.zst -C /tmp/icu76 && \
    mkdir -p /usr/lib/icu76 && \
    cp -a /tmp/icu76/usr/lib/libicu*.so.76* /usr/lib/icu76/ && \
    printf '%s\n' '/usr/lib/icu76' > /etc/ld.so.conf.d/icu76.conf && \
    ldconfig && \
    rm -rf /tmp/icu76 /tmp/icu-76.1-1-x86_64.pkg.tar.zst && \
    pacman -Scc --noconfirm

RUN set -e && \
    curl -L -o /tmp/sunshine.pkg.tar.zst https://github.com/LizardByte/Sunshine/releases/latest/download/sunshine.pkg.tar.zst && \
    pacman -U --noconfirm /tmp/sunshine.pkg.tar.zst && \
    rm -f /tmp/sunshine.pkg.tar.zst

# Create runtime user
RUN useradd -m -u 1000 -s /bin/bash streamer && \
    usermod -aG audio,video,input,render streamer

# Runtime directories
RUN mkdir -p \
      /run/dillinger \
      /var/lib/sunshine \
      /etc/sunshine \
      /etc/sway \
      /config/sway-configs/include.d \
      /opt/health-server && \
    chown -R streamer:streamer /run/dillinger /var/lib/sunshine /config

ENV XDG_RUNTIME_DIR=/run/dillinger
ENV WAYLAND_DISPLAY=wayland-dillinger
ENV WLR_BACKENDS=headless

COPY streaming-sidecar-entrypoint.sh /usr/local/bin/streaming-sidecar-entrypoint.sh
COPY sunshine.conf.template /etc/sunshine/sunshine.conf.template
COPY sway-config-template /etc/sway/sway-config-template
COPY health-server/index.js /opt/health-server/index.js

RUN chmod +x /usr/local/bin/streaming-sidecar-entrypoint.sh

EXPOSE 47984/tcp
EXPOSE 47984/udp
EXPOSE 47989/tcp
EXPOSE 47989/udp
EXPOSE 47990/tcp
EXPOSE 47999/udp
EXPOSE 48010/tcp
EXPOSE 48010/udp
EXPOSE 9999/tcp

ENTRYPOINT ["/usr/local/bin/streaming-sidecar-entrypoint.sh"]
