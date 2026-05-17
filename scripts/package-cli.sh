#!/usr/bin/env bash
# scripts/package-cli.sh
# Builds a native OS package (deb / rpm / arch) for the dillinger-gaming CLI
# using nfpm. Run via: pnpm cli:package:deb | pnpm cli:package:rpm | pnpm cli:package:arch
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT_DIR"

PACKAGER="${1:-deb}"
OUT_DIR="$ROOT_DIR/release_assets"

# ── Validate ─────────────────────────────────────────────────────────────
if ! command -v nfpm >/dev/null 2>&1; then
  echo "ERROR: nfpm is not installed. Rebuild the devcontainer or install it manually." >&2
  echo "  https://nfpm.goreleaser.com/install/" >&2
  exit 1
fi

case "$PACKAGER" in
  deb|rpm|archlinux) ;;
  *)
    echo "ERROR: Unknown packager '$PACKAGER'. Use: deb, rpm, archlinux" >&2
    exit 1
    ;;
esac

# ── Ensure dist/ is current ───────────────────────────────────────────────
if [[ ! -f "$ROOT_DIR/packages/cli/dist/index.js" ]]; then
  echo "dist/index.js not found — running cli:prepublish first..."
  pnpm cli:prepublish
fi

# ── Read CLI version from package.json ────────────────────────────────────
DILLINGER_CLI_VERSION="$(node -e "process.stdout.write(require('./packages/cli/package.json').version)")"
export DILLINGER_CLI_VERSION

echo "→ Packaging dillinger-gaming v${DILLINGER_CLI_VERSION} as ${PACKAGER}..."

mkdir -p "$OUT_DIR"

nfpm package \
  --config "$SCRIPT_DIR/nfpm-cli.yaml" \
  --packager "$PACKAGER" \
  --target "$OUT_DIR/"

echo "✓ Package written to $OUT_DIR/"
ls -lh "$OUT_DIR"/dillinger-gaming_* 2>/dev/null || true
