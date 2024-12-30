#!/bin/bash

# Run the server in development mode - using the dev_root_dir as the root directory
DILLINGER_ROOT_DIR=./dev_root_dir RUST_LOG=info cargo run
