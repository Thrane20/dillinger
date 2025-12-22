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
VOLUME_NAME="dillinger_data"

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

# Check if image exists locally
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
        
        # Ask if user wants to update
        read -p "Update to latest version? [y/N] " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_info "Pulling latest image..."
            docker pull "$IMAGE_NAME:$IMAGE_TAG"
            print_success "Image updated"
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
