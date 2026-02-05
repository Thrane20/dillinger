#!/bin/bash

# Comprehensive Docker Runner Images Build Script
# Provides flexible building options for all Dillinger runner images

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load versions from versioning.env
if [ -f "../../versioning.env" ]; then
    source "../../versioning.env"
fi

# Color output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Default options
NO_CACHE=""
PARALLEL=false
PUSH=false
IMAGES=()

# Image registry prefix
# thrane20 = Gaming On Linux
# All images default to ghcr.io/thrane20/dillinger
IMAGE_PREFIX="ghcr.io/thrane20/dillinger/runner"

# Function to display usage
usage() {
    printf "\n"
    printf "\033[0;34mDillinger Runner Images Build Script\033[0m\n"
    printf "\n"
    printf "Usage: %s [OPTIONS] [IMAGES...]\n" "$0"
    printf "\n"
    printf "\033[1;33mOPTIONS:\033[0m\n"
    printf "    -h, --help              Show this help message\n"
    printf "    -n, --no-cache          Build without using Docker cache\n"
    printf "    -p, --parallel          Build images in parallel (experimental)\n"
    printf "    -a, --all               Build all images (default if no images specified)\n"
    printf "    --push                  Push images after building (requires ghcr.io login)\n"
    printf "\n"
    printf "\033[1;33mIMAGES:\033[0m\n"
    printf "    base                    Build only the base runner image\n"
    printf "    linux-native            Build only the linux-native runner image\n"
    printf "    wine                    Build only the wine runner image\n"
    printf "    vice                    Build only the vice runner image\n"
    printf "    fs-uae                  Build only the fs-uae runner image\n"
    printf "    retroarch               Build only the retroarch runner image\n"
    printf "    streaming-sidecar       Build only the streaming sidecar image\n"
    printf "\n"
    printf "\033[1;33mEXAMPLES:\033[0m\n"
    printf "    %s                      # Build all images\n" "$0"
    printf "    %s --all                # Build all images\n" "$0"
    printf "    %s --push               # Build and push to ghcr.io\n" "$0"
    printf "    %s --no-cache           # Build all images without cache\n" "$0"
    printf "    %s base                 # Build only base image\n" "$0"
    printf "    %s base wine            # Build base and wine images\n" "$0"
    printf "    %s --no-cache wine      # Build wine image without cache\n" "$0"
    printf "    %s --parallel --all     # Build all images in parallel\n" "$0"
    printf "\n"
    printf "\033[1;33mREGISTRY:\033[0m\n"
    printf "    All images are tagged for ghcr.io/thrane20 (Gaming On Linux)\n"
    printf "\n"
    printf "\033[1;33mBUILD ORDER:\033[0m\n"
    printf "    The script respects dependency order:\n"
    printf "    1. base (required by all others)\n"
    printf "    2. linux-native (depends on base)\n"
    printf "    3. wine (depends on base)\n"
    printf "    4. vice (depends on base)\n"
    printf "    5. fs-uae (depends on base)\n"
    printf "    6. retroarch (depends on base)\n"
    printf "    7. streaming-sidecar (depends on base)\n"
    printf "\n"
    exit 0
}

# Get the image tag (version from versioning.env, fallback to latest)
get_tag() {
    local name=$1
    local version=""
    
    case $name in
        base)
            version="${DILLINGER_RUNNER_BASE_VERSION:-latest}"
            ;;
        wine)
            version="${DILLINGER_RUNNER_WINE_VERSION:-latest}"
            ;;
        vice)
            version="${DILLINGER_RUNNER_VICE_VERSION:-latest}"
            ;;
        retroarch)
            version="${DILLINGER_RUNNER_RETROARCH_VERSION:-latest}"
            ;;
        fs-uae)
            version="${DILLINGER_RUNNER_FS_UAE_VERSION:-latest}"
            ;;
        linux-native)
            version="${DILLINGER_RUNNER_LINUX_NATIVE_VERSION:-latest}"
            ;;
        streaming-sidecar)
            version="${DILLINGER_STREAMING_SIDECAR_VERSION:-latest}"
            ;;
        *)
            version="latest"
            ;;
    esac
    
    # Streaming sidecar uses a different prefix (not a runner)
    if [ "$name" = "streaming-sidecar" ]; then
        echo "ghcr.io/thrane20/dillinger/${name}:${version}"
    else
        echo "${IMAGE_PREFIX}-${name}:${version}"
    fi
}

# Function to build an image
build_image() {
    local image_name=$1
    local image_dir=$2
    local docker_tag=$3
    
    printf "\n"
    printf "\033[0;34m========================================\033[0m\n"
    printf "\033[0;32mBuilding %s...\033[0m\n" "$image_name"
    printf "\033[0;34mTag: %s\033[0m\n" "$docker_tag"
    printf "\033[0;34m========================================\033[0m\n"
    
    cd "$SCRIPT_DIR/$image_dir"
    
    # Get base version for child images
    local base_version="${DILLINGER_RUNNER_BASE_VERSION:-0.1.2}"
    
    # Progress mode: auto (default), plain (verbose), or tty (compact)
    local progress_mode="${DOCKER_PROGRESS:-plain}"
    
    # Record start time
    local build_start=$(date +%s)
    
    # Build with version tag only (no :latest) - pass BASE_VERSION for child images
    if DOCKER_BUILDKIT=1 docker buildx build --network=host --progress="$progress_mode" --load $NO_CACHE \
        --build-arg BASE_VERSION="$base_version" \
        -t "$docker_tag" .; then
        local build_end=$(date +%s)
        local build_duration=$((build_end - build_start))
        local minutes=$((build_duration / 60))
        local seconds=$((build_duration % 60))
        printf "\033[0;32m✓ %s built successfully (${minutes}m ${seconds}s)\033[0m\n" "$image_name"
        printf "\033[0;32m  Tagged as: %s\033[0m\n" "$docker_tag"
        
        # Push if requested
        if [ "$PUSH" = true ]; then
            printf "\033[0;34mPushing %s...\033[0m\n" "$docker_tag"
            if docker push "$docker_tag"; then
                printf "\033[0;32m✓ Pushed %s\033[0m\n" "$docker_tag"
            else
                printf "\033[0;31m✗ Failed to push %s\033[0m\n" "$docker_tag"
                return 1
            fi
        fi
        
        printf "\n"
        return 0
    else
        printf "\033[0;31m✗ %s build failed\033[0m\n" "$image_name"
        printf "\n"
        return 1
    fi
}

# Function to check if image should be built
should_build() {
    local image=$1
    
    # If no images specified, build all
    if [ ${#IMAGES[@]} -eq 0 ]; then
        return 0
    fi
    
    # Check if image is in the list
    for img in "${IMAGES[@]}"; do
        if [ "$img" = "$image" ]; then
            return 0
        fi
    done
    
    return 1
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            ;;
        -n|--no-cache)
            NO_CACHE="--no-cache"
            shift
            ;;
        -p|--parallel)
            PARALLEL=true
            shift
            ;;
        --push)
            PUSH=true
            shift
            ;;
        -a|--all)
            # Build all images (default behavior)
            shift
            ;;
        base|linux-native|wine|vice|fs-uae|retroarch|streaming-sidecar)
            IMAGES+=("$1")
            shift
            ;;
        *)
            printf "\033[0;31mUnknown option: %s\033[0m\n" "$1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Display build configuration
printf "\n"
printf "\033[0;34m========================================\033[0m\n"
printf "\033[0;34mDillinger Runner Images Build\033[0m\n"
printf "\033[0;34m========================================\033[0m\n"
printf "\033[1;33mConfiguration:\033[0m\n"
if [ -z "$NO_CACHE" ]; then
    printf "  Cache: \033[0;32menabled\033[0m\n"
else
    printf "  Cache: \033[0;31mdisabled\033[0m\n"
fi

if [ "$PARALLEL" = true ]; then
    printf "  Parallel: \033[0;32menabled\033[0m\n"
else
    printf "  Parallel: \033[1;33mdisabled\033[0m\n"
fi

printf "  Registry: \033[0;32mghcr.io/thrane20\033[0m\n"

if [ "$PUSH" = true ]; then
    printf "  Push: \033[0;32menabled\033[0m\n"
else
    printf "  Push: \033[1;33mdisabled\033[0m\n"
fi

if [ ${#IMAGES[@]} -eq 0 ]; then
    printf "  Images: \033[0;32mall\033[0m\n"
else
    printf "  Images: \033[0;32m%s\033[0m\n" "${IMAGES[*]}"
fi
printf "\n"

# Check for dependency issues
if should_build "linux-native" || should_build "wine" || should_build "vice" || should_build "fs-uae" || should_build "retroarch" || should_build "streaming-sidecar"; then
    if ! should_build "base" && ! docker images | grep -q "${IMAGE_PREFIX}-base"; then
        printf "\033[1;33mWarning: Dependent images require base image, but base not found.\033[0m\n"
        printf "\033[1;33mAdding base to build queue...\033[0m\n"
        IMAGES=("base" "${IMAGES[@]}")
        printf "\n"
    fi
fi

# Build images
BUILD_FAILED=false

if [ "$PARALLEL" = true ]; then
    printf "\033[1;33mParallel build mode enabled (experimental)\033[0m\n"
    printf "\033[1;33mNote: Base image will be built first, then others in parallel\033[0m\n"
    printf "\n"
    
    # Always build base first
    if should_build "base"; then
        if ! build_image "Base Runner" "base" "$(get_tag base)"; then
            BUILD_FAILED=true
            exit 1
        fi
    fi
    
    # Build others in parallel
    PIDS=()
    
    if should_build "linux-native"; then
        build_image "Linux Native Runner" "linux-native" "$(get_tag linux-native)" &
        PIDS+=($!)
    fi
    
    if should_build "wine"; then
        build_image "Wine Runner" "wine" "$(get_tag wine)" &
        PIDS+=($!)
    fi
    
    if should_build "vice"; then
        build_image "VICE Runner" "vice" "$(get_tag vice)" &
        PIDS+=($!)
    fi
    
    if should_build "fs-uae"; then
        build_image "FS-UAE Runner" "fs-uae" "$(get_tag fs-uae)" &
        PIDS+=($!)
    fi

    if should_build "retroarch"; then
        build_image "RetroArch Runner" "retroarch" "$(get_tag retroarch)" &
        PIDS+=($!)
    fi

    if should_build "streaming-sidecar"; then
        build_image "Streaming Sidecar" "streaming-sidecar" "$(get_tag streaming-sidecar)" &
        PIDS+=($!)
    fi
    
    # Wait for all background jobs
    for pid in "${PIDS[@]}"; do
        if ! wait "$pid"; then
            BUILD_FAILED=true
        fi
    done
else
    # Sequential build (respects dependencies)
    if should_build "base"; then
        if ! build_image "Base Runner" "base" "$(get_tag base)"; then
            BUILD_FAILED=true
            exit 1
        fi
    fi
    
    if should_build "linux-native"; then
        if ! build_image "Linux Native Runner" "linux-native" "$(get_tag linux-native)"; then
            BUILD_FAILED=true
            exit 1
        fi
    fi
    
    if should_build "wine"; then
        if ! build_image "Wine Runner" "wine" "$(get_tag wine)"; then
            BUILD_FAILED=true
            exit 1
        fi
    fi
    
    if should_build "vice"; then
        if ! build_image "VICE Runner" "vice" "$(get_tag vice)"; then
            BUILD_FAILED=true
            exit 1
        fi
    fi
    
    if should_build "fs-uae"; then
        if ! build_image "FS-UAE Runner" "fs-uae" "$(get_tag fs-uae)"; then
            BUILD_FAILED=true
            exit 1
        fi
    fi

    if should_build "retroarch"; then
        if ! build_image "RetroArch Runner" "retroarch" "$(get_tag retroarch)"; then
            BUILD_FAILED=true
            exit 1
        fi
    fi

    if should_build "streaming-sidecar"; then
        if ! build_image "Streaming Sidecar" "streaming-sidecar" "$(get_tag streaming-sidecar)"; then
            BUILD_FAILED=true
            exit 1
        fi
    fi
fi

# Summary
printf "\n"
printf "\033[0;34m========================================\033[0m\n"
if [ "$BUILD_FAILED" = false ]; then
    printf "\033[0;32mAll requested images built successfully!\033[0m\n"
    printf "\033[0;34m========================================\033[0m\n"
    printf "\n"
    printf "\033[1;33mBuilt images:\033[0m\n"
    should_build "base" && printf "  - $(get_tag base)\n"
    should_build "linux-native" && printf "  - $(get_tag linux-native)\n"
    should_build "wine" && printf "  - $(get_tag wine)\n"
    should_build "vice" && printf "  - $(get_tag vice)\n"
    should_build "fs-uae" && printf "  - $(get_tag fs-uae)\n"
    should_build "retroarch" && printf "  - $(get_tag retroarch)\n"
    should_build "streaming-sidecar" && printf "  - $(get_tag streaming-sidecar)\n"
    printf "\n"
    printf "\033[1;33mAvailable images:\033[0m\n"
    docker images | grep -E "(dillinger/runner-|ghcr.io.*runner-)" | awk '{printf "  - %-50s %10s %15s\n", $1":"$2, $6" "$7, $NF}'
    
    if [ "$PUSH" = true ]; then
        printf "\n"
        printf "\033[0;32mImages pushed to registry.\033[0m\n"
    fi
    exit 0
else
    printf "\033[0;31mSome images failed to build!\033[0m\n"
    printf "\033[0;34m========================================\033[0m\n"
    exit 1
fi
