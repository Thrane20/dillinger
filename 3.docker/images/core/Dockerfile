# BUILDER
ARG BASE_IMAGE
FROM $BASE_IMAGE AS builder

RUN apt update && apt install -y musl-tools musl-dev
RUN rustup target add x86_64-unknown-linux-musl

# Get the dillinger core source code and copy it over
WORKDIR /src/dillinger
COPY ../2.server/src ./src
COPY ../2.server/Cargo.toml .

# Run the build
RUN cargo build --target x86_64-unknown-linux-musl --release

CMD ["/bin/sh"]