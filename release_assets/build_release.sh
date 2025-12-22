#!/usr/bin/env bash
set -euo pipefail

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
  printf "%b%s%b\n" "$BLUE" "$1" "$NC"
}

success() {
  printf "%b%s%b\n" "$GREEN" "$1" "$NC"
}

error() {
  printf "%b%s%b\n" "$RED" "$1" "$NC" >&2
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

PROMPT_ON_ERROR=${PROMPT_ON_ERROR:-true}
CURRENT_STEP="initialization"

on_error() {
  local exit_code=$?
  trap - ERR
  error "✗ Release build failed during: ${CURRENT_STEP} (exit code ${exit_code})."
  error "Check the logs above for details."
  if [[ -t 1 && "${PROMPT_ON_ERROR}" != "false" ]]; then
    read -rp "Press Enter to exit..." _ || true
  fi
  exit "$exit_code"
}
trap on_error ERR

step() {
  local description="$1"
  shift
  CURRENT_STEP="$description"
  log "$description"
  "$@"
}

if ! command -v pnpm >/dev/null 2>&1; then
  error "pnpm is required but was not found on PATH"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  error "Docker CLI is required but was not found on PATH"
  exit 1
fi

step "Installing workspace dependencies" pnpm install --frozen-lockfile

step "Building shared packages" pnpm run build:shared

step "Building Dillinger Core Next.js app" bash -c "cd packages/dillinger-core && pnpm run build"

step "Building Dillinger Core Docker image" pnpm run docker:build:core

step "Building runner images" bash -c "cd packages/runner-images && ./build.sh --all"

trap - ERR

success "Release build complete"
printf "${YELLOW}Images ready:${NC}\n"
printf "  - ghcr.io/thrane20/dillinger/core:latest\n"
printf "  - ghcr.io/thrane20/dillinger/runner-base:latest\n"
printf "  - ghcr.io/thrane20/dillinger/runner-linux-native:latest\n"
printf "  - ghcr.io/thrane20/dillinger/runner-wine:latest\n"
printf "  - ghcr.io/thrane20/dillinger/runner-vice:latest\n"
printf "  - ghcr.io/thrane20/dillinger/runner-fs-uae:latest\n"
printf "  - ghcr.io/thrane20/dillinger/runner-mame:latest\n"
printf "\n"
printf "${YELLOW}To push all images to ghcr.io:${NC}\n"
printf "  docker push ghcr.io/thrane20/dillinger/core:latest\n"
printf "  cd packages/runner-images && ./build.sh --push\n"
