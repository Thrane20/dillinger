# Start with the official Arch Linux base image
FROM localhost/dillinger-base

# Enable multilib, update pacman, and install all dependencies in one command
RUN echo -e "\n[multilib]\nInclude = /etc/pacman.d/mirrorlist" >> /etc/pacman.conf && \
    pacman -Syu --noconfirm archlinux-keyring && \
    pacman -S --noconfirm \
    # base-devel wget nano git sudo \
    wine wine-mono wine-gecko lib32-gnutls lib32-mesa lib32-vulkan-icd-loader supertuxkart \
    lib32-libx11 xorg-server-xwayland libva-mesa-driver vulkan-icd-loader libglvnd \
    lib32-gcc-libs lib32-glibc lib32-libjpeg-turbo lib32-alsa-lib lib32-libpulse \
    lib32-libxcomposite lib32-libxinerama lib32-libxcursor lib32-libxi lib32-libxrandr \
    lib32-libglvnd lib32-libva-mesa-driver libxkbcommon libxkbcommon-x11 

RUN pacman -S --noconfirm pulseaudio
RUN echo "enable-shm=no" >> /etc/pulse/client.conf
RUN pacman -S --noconfirm openal
RUN pacman -S --noconfirm gamescope
RUN pacman -S --noconfirm gtk3

RUN pacman -Sy --noconfirm vulkan-intel lib32-vulkan-intel vulkan-radeon lib32-vulkan-radeon


# Set up Wine prefixes if both 32-bit and 64-bit Wine are needed
# ENV WINEPREFIX32=/wine32
# ENV WINEPREFIX64=/wine64

# RUN WINEARCH=win32 WINEPREFIX=$WINEPREFIX32 winecfg && \
#     echo "32-bit Wine prefix created at $WINEPREFIX32" && \
#     WINEARCH=win64 WINEPREFIX=$WINEPREFIX64 winecfg && \
#     echo "64-bit Wine prefix created at $WINEPREFIX64"

# Set environment variables to select the appropriate Wine prefix
# ENV WINEPREFIX=$WINEPREFIX32
# ENV WINEARCH=win32

# Configure for both X11 and Wayland display protocols
# ENV DISPLAY=:0
# VOLUME ["/tmp/.X11-unix"]
# ENV WAYLAND_DISPLAY=wayland-0
# VOLUME ["/run/user/1000/wayland-0"]

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Set entrypoint
ENTRYPOINT ["/entrypoint.sh"]
