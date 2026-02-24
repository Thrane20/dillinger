#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUBMODULE_DIR="$ROOT_DIR/third_party/umu-protonfixes"

if [[ ! -d "$SUBMODULE_DIR" ]]; then
  echo "Submodule not found at $SUBMODULE_DIR"
  exit 1
fi

echo "Updating umu-protonfixes submodule..."
git -C "$SUBMODULE_DIR" pull --ff-only

echo "Updating nested submodules..."
git -C "$SUBMODULE_DIR" submodule update --init --recursive

echo "Regenerating protonfixes index..."
python3 "$ROOT_DIR/scripts/index-protonfixes.py"

echo "Done."
