#!/bin/bash
# Dillinger Startup Script
# This script checks prerequisites and starts the Dillinger gaming platform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="ghcr.io/thrane20/dillinger/core"
IMAGE_TAG="latest"
CONTAINER_NAME="dillinger"
PORT="3010"
VOLUME_NAME="dillinger_root"

print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}→ $1${NC}"
}

# Check if Docker is installed
check_docker() {
    print_info "Checking Docker installation..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed!"
        echo ""
        echo "Please install Docker first:"
        echo ""
        echo "Ubuntu/Debian:"
        echo "  curl -fsSL https://get.docker.com | sudo sh"
        echo "  sudo usermod -aG docker \$USER"
        echo ""
        echo "Arch Linux:"
        echo "  sudo pacman -S docker"
        echo "  sudo systemctl enable --now docker"
        echo "  sudo usermod -aG docker \$USER"
        echo ""
        echo "After installation, log out and log back in, then run this script again."
        exit 1
    fi
    
    print_success "Docker is installed"
}

# Check if Docker daemon is running
check_docker_running() {
    print_info "Checking if Docker daemon is running..."
    
    if ! docker ps &> /dev/null; then
        print_error "Docker daemon is not running!"
        echo ""
        echo "Start Docker with:"
        echo "  sudo systemctl start docker"
        exit 1
    fi
    
    print_success "Docker daemon is running"
}

# Check if user is in docker group
check_docker_permissions() {
    if ! docker ps &> /dev/null 2>&1; then
        print_warning "You may need to run Docker commands as root or add yourself to the docker group"
        echo ""
        echo "Add yourself to the docker group:"
        echo "  sudo usermod -aG docker \$USER"
        echo ""
        echo "Then log out and log back in."
        echo ""
        read -p "Continue anyway? (you may need sudo) [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Check if dillinger_data volume exists
check_volume() {
    print_info "Checking for dillinger_data volume..."
    
    if ! docker volume inspect "$VOLUME_NAME" &> /dev/null; then
        print_warning "Volume '$VOLUME_NAME' does not exist"
        print_info "Creating volume '$VOLUME_NAME'..."
        
        if docker volume create "$VOLUME_NAME" &> /dev/null; then
            print_success "Volume '$VOLUME_NAME' created successfully"
            
            # Show where the volume is stored
            VOLUME_PATH=$(docker volume inspect "$VOLUME_NAME" --format '{{ .Mountpoint }}' 2>/dev/null || echo "unknown")
            print_info "Volume location: $VOLUME_PATH"
        else
            print_error "Failed to create volume"
            exit 1
        fi
    else
        print_success "Volume '$VOLUME_NAME' exists"
    fi
}

# Get the current version of local image
get_local_version() {
    # Try to get version from image labels
    local version=$(docker image inspect "$IMAGE_NAME:$IMAGE_TAG" 2>/dev/null | \
        grep -o '"version":"v[0-9]*\.[0-9]*\.[0-9]*"' | \
        head -1 | \
        cut -d'"' -f4)
    
    if [ -z "$version" ]; then
        # Fallback: check for version-tagged image
        version=$(docker images --format "{{.Tag}}" "$IMAGE_NAME" | \
            grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | \
            sort -V | \
            tail -1)
    fi
    
    echo "$version"
}

# Get the latest version from GitHub Container Registry
get_remote_version() {
    # Query GitHub Container Registry API for available tags
    local repo_name="dillinger/core"
    local latest_version=$(curl -s "https://ghcr.io/v2/thrane20/dillinger/core/tags/list" 2>/dev/null | \
        grep -o '"v[0-9]*\.[0-9]*\.[0-9]*"' | \
        tr -d '"' | \
        sort -V | \
        tail -1)
    
    echo "$latest_version"
}

# Compare semantic versions
version_greater() {
    # Returns 0 (true) if $1 > $2
    local ver1=$1
    local ver2=$2
    
    # Remove 'v' prefix if present
    ver1=${ver1#v}
    ver2=${ver2#v}
    
    # Use sort -V to compare versions
    if [ "$ver1" = "$ver2" ]; then
        return 1  # versions are equal
    fi
    
    local highest=$(printf "%s\n%s" "$ver1" "$ver2" | sort -V | tail -1)
    
    if [ "$highest" = "$ver1" ]; then
        return 0  # ver1 is greater
    else
        return 1  # ver2 is greater or equal
    fi
}

# Check if image exists locally and if there's an update available
check_image() {
    print_info "Checking for Dillinger image..."
    
    if ! docker image inspect "$IMAGE_NAME:$IMAGE_TAG" &> /dev/null; then
        print_warning "Image not found locally"
        print_info "Pulling $IMAGE_NAME:$IMAGE_TAG..."
        
        if docker pull "$IMAGE_NAME:$IMAGE_TAG"; then
            print_success "Image pulled successfully"
        else
            print_error "Failed to pull image"
            exit 1
        fi
    else
        print_success "Image exists locally"
        
        # Check for updates
        print_info "Checking for updates..."
        
        local current_version=$(get_local_version)
        local remote_version=$(get_remote_version)
        
        if [ -n "$current_version" ]; then
            print_info "Current version: $current_version"
        else
            print_info "Current version: unknown (using :latest tag)"
            current_version="v0.0.0"
        fi
        
        if [ -n "$remote_version" ]; then
            print_info "Latest version:  $remote_version"
            
            # Compare versions
            if version_greater "$remote_version" "$current_version"; then
                echo ""
                print_warning "A new version of Dillinger Core is available!"
                echo ""
                read -p "Do you want to download version $remote_version? [y/N] " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    print_info "Pulling latest image..."
                    if docker pull "$IMAGE_NAME:$IMAGE_TAG"; then
                        print_success "Image updated to $remote_version"
                    else
                        print_error "Failed to pull update"
                        print_info "Continuing with current version..."
                    fi
                else
                    print_info "Skipping update, using current version"
                fi
            else
                print_success "You are running the latest version"
            fi
        else
            print_warning "Could not check for updates (registry unavailable)"
            echo ""
            read -p "Pull latest image anyway? [y/N] " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                print_info "Pulling latest image..."
                docker pull "$IMAGE_NAME:$IMAGE_TAG"
            fi
        fi
    fi
}

# Check if container already exists
check_existing_container() {
    if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        print_warning "Container '$CONTAINER_NAME' already exists"
        
        if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
            print_info "Container is already running"
            echo ""
            print_success "Dillinger is accessible at: http://localhost:$PORT"
            echo ""
            echo "Container management:"
            echo "  docker logs $CONTAINER_NAME       # View logs"
            echo "  docker restart $CONTAINER_NAME    # Restart"
            echo "  docker stop $CONTAINER_NAME       # Stop"
            exit 0
        fi
        
        print_info "Starting existing container..."
        if docker start "$CONTAINER_NAME" &> /dev/null; then
            print_success "Container started"
            show_success_message
            exit 0
        else
            print_warning "Failed to start existing container"
            read -p "Remove and recreate container? [y/N] " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                docker rm -f "$CONTAINER_NAME" &> /dev/null
                print_success "Old container removed"
            else
                exit 1
            fi
        fi
    fi
}

# Start the container
start_container() {
    print_info "Starting Dillinger..."
    
    if docker run -d \
        --name "$CONTAINER_NAME" \
        -p "$PORT:3010" \
        -v /var/run/docker.sock:/var/run/docker.sock \
        -v "$VOLUME_NAME:/data" \
        --restart unless-stopped \
        "$IMAGE_NAME:$IMAGE_TAG" &> /dev/null; then
        
        print_success "Container started successfully"
    else
        print_error "Failed to start container"
        echo ""
        echo "Check the error above. Common issues:"
        echo "  - Port $PORT already in use"
        echo "  - Docker socket permission denied"
        echo "  - Insufficient system resources"
        exit 1
    fi
}

# Show success message
show_success_message() {
    print_header "Dillinger Started Successfully!"
    
    echo -e "${GREEN}🎮 Dillinger is now running!${NC}"
    echo ""
    echo "Access the web interface:"
    echo -e "  ${BLUE}http://localhost:$PORT${NC}"
    echo ""
    
    # Try to get host IP for network access info
    if command -v hostname &> /dev/null; then
        HOST_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
        if [ -n "$HOST_IP" ]; then
            echo "Or from another device on your network:"
            echo -e "  ${BLUE}http://$HOST_IP:$PORT${NC}"
            echo ""
        fi
    fi
    
    echo "First-time setup:"
    echo "  1. Open the web interface"
    echo "  2. Go to 'Platforms' to download game runners (Wine, VICE, etc.)"
    echo "  3. Add games from 'Games' or 'Online Sources'"
    echo "  4. Start gaming!"
    echo ""
    echo "Container management:"
    echo "  docker logs $CONTAINER_NAME       # View logs"
    echo "  docker logs -f $CONTAINER_NAME    # Follow logs"
    echo "  docker restart $CONTAINER_NAME    # Restart"
    echo "  docker stop $CONTAINER_NAME       # Stop"
    echo "  docker start $CONTAINER_NAME      # Start again"
    echo ""
    echo "Data location:"
    VOLUME_PATH=$(docker volume inspect "$VOLUME_NAME" --format '{{ .Mountpoint }}' 2>/dev/null || echo "managed by Docker")
    echo "  $VOLUME_PATH"
    echo ""
    echo -e "${YELLOW}Need help? Visit: https://github.com/Thrane20/dillinger${NC}"
    echo ""
}

# Main execution
main() {
    print_header "Dillinger Setup Script"
    
    check_docker
    check_docker_running
    check_docker_permissions
    check_volume
    check_image
    check_existing_container
    start_container
    show_success_message
}

# Run main function
main
