# BUILDER
FROM rust:latest as builder

RUN rustup target add x86_64-unknown-linux-musl
RUN apt update && apt install -y musl-tools musl-dev
RUN update-ca-certificates

WORKDIR /dillinger-core

COPY daemon/ .

RUN cargo build --target x86_64-unknown-linux-musl --release

# FINAL IMAGE
FROM alpine:latest

RUN mkdir -p /opt/dillinger/bin
COPY --from=builder /dillinger-core/target/x86_64-unknown-linux-musl/release/dillinger-daemon /opt/dillinger/bin/

CMD ["/opt/dillinger/bin/dillinger-daemon"]