#!/bin/bash
# Publish Dillinger Docker images to ghcr.io
# Usage: ./scripts/publish.sh [target] [--build]
#   target: all, core, runners, base, wine, vice, retroarch, fs-uae, linux-native
#   --build: Build before pushing (optional)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}→ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Load .env file if it exists
if [[ -f "$ROOT_DIR/.env" ]]; then
    print_info "Loading environment from .env file..."
    export $(grep -v '^#' "$ROOT_DIR/.env" | xargs)
fi

# Load versions
source "$ROOT_DIR/versioning.env"

# Registry config
REGISTRY="ghcr.io/thrane20"

# Docker authentication
if [[ -n "$GITHUB_TOKEN" ]]; then
    print_info "Authenticating with GitHub Container Registry..."
    echo "$GITHUB_TOKEN" | docker login ghcr.io -u thrane20 --password-stdin >/dev/null 2>&1 || {
        print_error "Failed to authenticate with ghcr.io. Check your GITHUB_TOKEN."
        exit 1
    }
    print_success "Authenticated with ghcr.io"
else
    print_error "GITHUB_TOKEN not found in environment or .env file"
    print_info "Please set GITHUB_TOKEN in .env or run: export GITHUB_TOKEN=your_token"
    exit 1
fi

# Parse arguments
TARGET="${1:-all}"
BUILD_FIRST=false
if [[ "$2" == "--build" ]] || [[ "$1" == "--build" ]]; then
    BUILD_FIRST=true
    if [[ "$1" == "--build" ]]; then
        TARGET="all"
    fi
fi

# Tag and push an image with both version and latest
push_image() {
    local image_name="$1"
    local version="$2"
    local build_context="$3"
    local dockerfile="$4"
    
    local full_name="$REGISTRY/$image_name"
    
    print_header "Publishing $image_name v$version"
    
    # Build if requested
    if [[ "$BUILD_FIRST" == true ]] && [[ -n "$build_context" ]]; then
        print_info "Building $image_name..."
        if [[ -n "$dockerfile" ]]; then
            docker build \
                --build-arg VERSION="$version" \
                -t "$full_name:latest" \
                -f "$dockerfile" \
                "$build_context"
        else
            docker build \
                --build-arg VERSION="$version" \
                -t "$full_name:latest" \
                "$build_context"
        fi
    fi
    
    # Check if image exists locally
    if ! docker image inspect "$full_name:latest" &>/dev/null; then
        print_error "Image $full_name:latest not found locally. Build it first or use --build flag."
        return 1
    fi
    
    # Tag with version
    print_info "Tagging $full_name:$version"
    docker tag "$full_name:latest" "$full_name:$version"
    
    # Push both tags
    print_info "Pushing $full_name:$version"
    docker push "$full_name:$version"
    
    print_info "Pushing $full_name:latest"
    docker push "$full_name:latest"
    
    print_success "Published $image_name v$version"
}

# Publish core
publish_core() {
    push_image "dillinger/core" "$DILLINGER_CORE_VERSION" "$ROOT_DIR" "packages/dillinger-core/Dockerfile"
}

# Publish runner base
publish_base() {
    push_image "dillinger/runner-base" "$DILLINGER_RUNNER_BASE_VERSION" "$ROOT_DIR/packages/runner-images/base"
}

# Publish individual runners
publish_wine() {
    push_image "dillinger/runner-wine" "$DILLINGER_RUNNER_WINE_VERSION" "$ROOT_DIR/packages/runner-images/wine"
}

publish_vice() {
    push_image "dillinger/runner-vice" "$DILLINGER_RUNNER_VICE_VERSION" "$ROOT_DIR/packages/runner-images/vice"
}

publish_retroarch() {
    push_image "dillinger/runner-retroarch" "$DILLINGER_RUNNER_RETROARCH_VERSION" "$ROOT_DIR/packages/runner-images/retroarch"
}

publish_fs_uae() {
    push_image "dillinger/runner-fs-uae" "$DILLINGER_RUNNER_FS_UAE_VERSION" "$ROOT_DIR/packages/runner-images/fs-uae"
}

publish_retroarch() {
    push_image "dillinger/runner-retroarch" "$DILLINGER_RUNNER_RETROARCH_VERSION" "$ROOT_DIR/packages/runner-images/retroarch"
}

publish_linux_native() {
    push_image "dillinger/runner-linux-native" "$DILLINGER_RUNNER_LINUX_NATIVE_VERSION" "$ROOT_DIR/packages/runner-images/linux-native"
}

# Publish all runners (not including base)
publish_runners() {
    publish_base
    publish_wine
    publish_vice
    publish_retroarch
    publish_fs_uae
    publish_linux_native
}

# Publish everything
publish_all() {
    publish_core
    publish_runners
}

# Show current versions
show_versions() {
    print_header "Current Image Versions"
    echo -e "  ${BLUE}Core:${NC}          $DILLINGER_CORE_VERSION"
    echo -e "  ${BLUE}Runner Base:${NC}   $DILLINGER_RUNNER_BASE_VERSION"
    echo -e "  ${BLUE}Wine:${NC}          $DILLINGER_RUNNER_WINE_VERSION"
    echo -e "  ${BLUE}VICE:${NC}          $DILLINGER_RUNNER_VICE_VERSION"
    echo -e "  ${BLUE}RetroArch:${NC}     $DILLINGER_RUNNER_RETROARCH_VERSION"
    echo -e "  ${BLUE}FS-UAE:${NC}        $DILLINGER_RUNNER_FS_UAE_VERSION"
    echo -e "  ${BLUE}Linux Native:${NC}  $DILLINGER_RUNNER_LINUX_NATIVE_VERSION"
    echo ""
}

# Show usage
show_usage() {
    echo "Usage: $0 [target] [--build]"
    echo ""
    echo "Targets:"
    echo "  all           Publish core and all runners (default)"
    echo "  core          Publish core application only"
    echo "  runners       Publish all runner images"
    echo "  base          Publish runner-base only"
    echo "  wine          Publish runner-wine only"
    echo "  vice          Publish runner-vice only"
    echo "  retroarch     Publish runner-retroarch only"
    echo "  fs-uae        Publish runner-fs-uae only"
    echo "  linux-native  Publish runner-linux-native only"
    echo "  versions      Show current versions"
    echo ""
    echo "Options:"
    echo "  --build       Build images before pushing"
    echo ""
    echo "Examples:"
    echo "  $0 core              # Push core (must be built first)"
    echo "  $0 core --build      # Build and push core"
    echo "  $0 wine --build      # Build and push wine runner"
    echo "  $0 all --build       # Build and push everything"
    echo ""
}

# Main
case "$TARGET" in
    all)
        show_versions
        publish_all
        ;;
    core)
        publish_core
        ;;
    runners)
        show_versions
        publish_runners
        ;;
    base)
        publish_base
        ;;
    wine)
        publish_wine
        ;;
    vice)
        publish_vice
        ;;
    retroarch)
        publish_retroarch
        ;;
    fs-uae)
        publish_fs_uae
        ;;
    linux-native)
        publish_linux_native
        ;;
    versions)
        show_versions
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        print_error "Unknown target: $TARGET"
        show_usage
        exit 1
        ;;
esac

print_header "Done!"
