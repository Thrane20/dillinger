FROM ubuntu:23.04

# Avoid warnings by switching to noninteractive
ENV DEBIAN_FRONTEND=noninteractive

# 32-bit architecture support
RUN dpkg --add-architecture i386

# Configure apt and install base packages
RUN apt-get update
RUN apt-get -y install --no-install-recommends \
    wget curl build-essential git software-properties-common \
    unzip pkg-config libssl-dev 

# Install Rust - needed for dillinger server
RUN curl https://sh.rustup.rs -sSf | bash -s -- -y
ENV PATH="~/.cargo/bin:${PATH}"

# Install cargo-watch - useful for auto-reloading the server during development
# RUN cargo install cargo-watch

# Install Bun - needed for the client web portal
RUN curl  https://bun.sh/install -fsSL | bash