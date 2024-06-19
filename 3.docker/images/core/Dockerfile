ARG BASE_IMAGE
ARG RUN_IMAGE

# Use the base image as the base image for the builder
FROM $BASE_IMAGE AS builder

RUN apt update && apt install -y musl-tools musl-dev
RUN apt install -y curl

# Install Rustup (the Rust installer and version management tool)
RUN curl https://sh.rustup.rs -sSf | bash -s -- -y

# Set the PATH environment variable to include cargo, rustc, and other Rust binaries
ENV PATH="/root/.cargo/bin:${PATH}"

# Get the dillinger core source code and copy it over
WORKDIR /src/dillinger
COPY ../2.server/src ./src
COPY ../2.server/Cargo.toml .

# Run the build (no musl? no... we're only ever running inside a base ubuntu image)
RUN cargo build  --release

# Use the run image as the base image for the final image
FROM ${RUN_IMAGE} as final

# Copy the built binary from the builder image to the final image
COPY --from=builder /src/dillinger/target/release/dillinger /opt/dillinger

CMD ["/bin/bash", "-c", "/opt/dillinger/dillinger"]