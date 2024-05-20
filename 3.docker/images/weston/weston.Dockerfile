# Use an official Ubuntu base image
FROM ubuntu:24.04

# Set environment variables to avoid user interaction during installation
ENV DEBIAN_FRONTEND=noninteractive

# Install Weston and X11 utilities
RUN apt-get update && \
    apt-get install -y \
    weston \
    x11-xserver-utils \
    dbus-x11

# Set up the user environment
RUN useradd -m westonuser
USER westonuser
ENV HOME /home/westonuser
WORKDIR /home/westonuser

RUN mkdir /home/westonuser/xdg_runtime_dir && \
    chmod 0700 /home/westonuser/xdg_runtime_dir && \
    chown westonuser:westonuser /home/westonuser/xdg_runtime_dir

# Set the XDG_RUNTIME_DIR environment variable
ENV XDG_RUNTIME_DIR /home/westonuser/xdg_runtime_dir

# Run Weston
CMD ["weston"]