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

# Docker tools so we can run "docker from docker" commands against the host
RUN install -m 0755 -d /etc/apt/keyrings
RUN curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
RUN chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository to Apt sources:
RUN echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null
RUN apt-get update

RUN apt-get -y install containerd.io docker-ce docker-ce-cli
RUN mkdir -p ~/.docker/cli-plugins
RUN curl -Lo ~/.docker/cli-plugins/docker-buildx curl -Lo ~/.docker/cli-plugins/docker-buildx "https://github.com/docker/buildx/releases/download/v0.16.0/buildx-v0.16.0.linux-amd64"
RUN chmod +x ~/.docker/cli-plugins/docker-buildx

# Install Rust - needed for dillinger server
RUN curl https://sh.rustup.rs -sSf | bash -s -- -y
ENV PATH="~/.cargo/bin:${PATH}"

# Install cargo-watch - useful for auto-reloading the server during development
# RUN cargo install cargo-watch

# Install Bun - needed for the client web portal
RUN curl  https://bun.sh/install -fsSL | bash