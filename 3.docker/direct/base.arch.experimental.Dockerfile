FROM archlinux:multilib-devel

## System Upgrade - will pull in core, extras, and multilib package pointers
RUN pacman -Syu --noconfirm

## Install wine
RUN pacman -S --noconfirm wine

CMD ["tail", "-f", "/dev/null"]