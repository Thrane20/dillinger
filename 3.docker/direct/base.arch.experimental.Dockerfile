FROM archlinux:multilib-devel

## System Upgrade - will pull in core, extras, and multilib package pointers
RUN pacman -Syu --noconfirm

ARG RP=" \
    wget \
    xorg-xauth xorg-xeyes \
    wayland \
    wayland-protocols \
    weston \
    mesa \
    libglvnd \
    qt5-wayland \
    gtk3 \
    "

RUN pacman -S --noconfirm $RP

CMD ["/usr/bin/xeyes"]
# CMD ["tail", "-f", "/dev/null"]