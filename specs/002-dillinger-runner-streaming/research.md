# Research: Dillinger Runner Streaming

**Feature**: 002-dillinger-runner-streaming  
**Date**: 2025-10-29  
**Status**: Complete

## Research Tasks

Based on Technical Context analysis and GOW/Wolf submodule examination, the following areas required research:

1. Wine/Proton runtime configuration in containerized environment
2. X11/Wayland display forwarding from container to host
3. Game launch orchestration between dillinger and dillinger-runner containers
4. Resource management and GPU passthrough for containerized gaming
5. Integration patterns from Games on Whales and Wolf architectures

## Findings

### 1. Wine/Proton Runtime Configuration

**Decision**: Use Wine-staging with Proton layer for Windows game compatibility

**Rationale**: 
- Wine-staging provides better compatibility with modern Windows games
- Proton (Valve's Wine fork) adds additional compatibility layers and DXVK/VKD3D
- Both can be containerized effectively with proper prefix management

**Implementation Notes**:
- Base container on Ubuntu 25.04 (matches GOW architecture)
- Install Wine-staging and dependencies via apt
- Configure WINEPREFIX per game session for isolation
- Include DXVK for DirectX→Vulkan translation
- Set up PulseAudio for audio forwarding

**Alternatives Considered**:
- Native Wine: Less compatibility with modern games
- Lutris in container: Too complex, includes unnecessary GUI components
- Bottles: Overkill for automated launching

### 2. X11/Wayland Display Forwarding

**Decision**: Implement dual support starting with X11, add Wayland later

**Rationale**:
- X11 is simpler to implement and widely supported
- Most existing game compatibility tools expect X11
- Wayland support can be added incrementally
- GOW uses X11 forwarding successfully

**Implementation Notes**:
- Use `DISPLAY` environment variable forwarding for X11
- Mount `/tmp/.X11-unix` socket from host
- Configure XAUTHORITY for authentication
- For Wayland: use Weston compositor in container (Wolf approach)
- Virtual display creation with Xvfb as fallback

**Alternatives Considered**:
- VNC: Higher latency, additional encoding overhead
- Wayland-only: Limited game compatibility
- Direct framebuffer: Complex, requires kernel access

### 3. Container Orchestration

**Decision**: Extend existing Docker Compose with runner service definition

**Rationale**:
- Leverages existing Dillinger Docker infrastructure
- Allows proper service dependencies and networking
- Enables volume sharing between main app and runner
- Supports scaling for multiple concurrent sessions

**Implementation Notes**:
- Add runner service to `docker-compose.dev.yml`
- Use Docker networks for inter-container communication
- Implement HTTP API for game launch requests
- Use container labels for session management
- Automatic cleanup via Docker restart policies

**Alternatives Considered**:
- Kubernetes: Overkill for single-host deployment
- Docker Swarm: Unnecessary complexity for current scope
- Manual docker run: Harder to manage dependencies

### 4. GPU Passthrough and Resource Management

**Decision**: Use NVIDIA Container Runtime with configurable resource limits

**Rationale**:
- NVIDIA Container Runtime provides GPU access without privileged containers
- Docker supports CPU/memory limits natively
- GOW/Wolf demonstrate this approach works effectively
- Maintains security isolation

**Implementation Notes**:
- Require `nvidia-container-runtime` on host
- Use `--gpus all` or specific GPU selection
- Set memory/CPU limits via Docker Compose
- Monitor resource usage via Docker stats API
- Implement graceful degradation for non-GPU systems

**Alternatives Considered**:
- Privileged containers: Security risk
- Intel GPU passthrough: Limited gaming performance
- Software rendering: Poor performance for modern games

### 5. GOW/Wolf Integration Patterns

**Decision**: Adopt GOW's containerization patterns with simplified Wolf orchestration

**Rationale**:
- GOW provides proven game container base images
- Wolf's complexity is beyond current requirements
- Can extract key patterns without full implementation
- Enables gradual feature adoption

**Key Patterns Extracted**:
- Multi-stage Dockerfiles with specific purposes (base, runtime, app)
- User management with gosu for proper permissions
- Overlay filesystem for configuration injection
- Environment variable configuration patterns
- Entrypoint scripts for runtime setup

**Implementation Notes**:
- Adapt GOW's base image patterns for Dillinger use case
- Simplify Wolf's session management for single-game launches
- Use GOW's PulseAudio container patterns for audio
- Adopt environment-based configuration over config files

**Alternatives Considered**:
- Full Wolf integration: Too complex for initial implementation
- Custom implementation: Would miss proven patterns
- Direct GOW usage: Images too specialized for emulation

## Architecture Decisions Summary

| Component | Technology Choice | Rationale |
|-----------|------------------|-----------|
| Base Container | Ubuntu 25.04 | Matches GOW, good package availability |
| Windows Gaming | Wine-staging + Proton | Best compatibility and performance |
| Display | X11 (primary), Wayland (future) | Simplicity and compatibility |
| Audio | PulseAudio forwarding | Standard Linux gaming setup |
| GPU Access | NVIDIA Container Runtime | Secure GPU passthrough |
| Orchestration | Docker Compose extension | Leverages existing infrastructure |
| Resource Limits | Docker native limits | Built-in, well-tested approach |

## Integration Points

### Main Dillinger App Changes Required:
1. **Backend API endpoints** for runner container management
2. **Frontend components** for game launch UI with streaming status
3. **Shared types** for runner communication protocol
4. **Service layer** for container lifecycle management

### New Container Components:
1. **Dockerfile** with Wine/Proton runtime
2. **Entrypoint scripts** for game launching and display setup
3. **API server** for receiving launch commands from main app
4. **Resource monitoring** and cleanup utilities

## Next Steps for Phase 1

1. Create `data-model.md` defining game launch metadata and container state
2. Generate API contracts for runner communication protocol
3. Design quickstart documentation for development setup
4. Update agent context with new technology stack