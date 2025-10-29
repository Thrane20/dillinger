# Feature Specification: Dillinger Runner Streaming

**Feature Branch**: `002-dillinger-runner-streaming`  
**Created**: 2025-10-29  
**Status**: Draft  
**Input**: User description: "i want a new feature to be able to run a game using foundational streaming capability as a new native docker container called thrane20/dillinger-runner. this docker image will contain all the necessary tools and apps to run games from, just like how GOW and Wolf work. over time, this will include things such as gamescope binaries, headtracker etc. but just now, it needs to look to the docker volume dillinger_library to be able to launch games managed by the dillinger app itself. to start, this will include windows games running through either wine or proton. and then the x11 or wayland server in the docker container to be connected to the host on runtime."

## Clarifications

### Session 2025-10-29

Research needed based on GOW and Wolf submodules:
- Q: Wine/Proton runtime configuration in containerized environment
- Q: X11/Wayland display forwarding from container to host
- Q: Game launch orchestration between dillinger and dillinger-runner containers
- Q: Resource management and GPU passthrough for containerized gaming
- Q: Integration patterns from Games on Whales and Wolf architectures
- Q: Package Management Structure → A: Restructure into apps/ (dillinger-core, dillinger-runner) + packages/ (shared libs) workspace
- Q: Docker Build Dependencies → A: Independent builds with shared packages/ imported during build
- Q: pnpm Workspace Commands → A: App-specific scripts (build:core, build:runner, dev:core, dev:runner) plus combined scripts
- Q: Container Communication Security → A: Shared API key configured via environment variables
- Q: Development Environment Setup → A: Combined approach with individual flexibility

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Launch Windows Game via Streaming (Priority: P1)

User wants to launch a Windows game from their Dillinger library and have it run in a containerized environment with display streaming back to their browser/client.

**Why this priority**: Core foundation for streaming game execution - the primary value proposition of the dillinger-runner container.

**Independent Test**: User can click a Windows game in their Dillinger library and see it launch and stream successfully, even if other features aren't working.

**Acceptance Scenarios**:

1. **Given** user has a Windows game in their Dillinger library, **When** they click "Play" on the game, **Then** dillinger-runner container starts and streams the game display
2. **Given** a game is running in dillinger-runner, **When** user provides input (mouse/keyboard), **Then** input is forwarded to the containerized game
3. **Given** a game finishes or crashes, **When** the game process ends, **Then** dillinger-runner container cleanly shuts down and reports status back to main Dillinger app

**Data Requirements**:
- Game metadata must include launch parameters for Wine/Proton
- Container runtime configuration (GPU access, volume mounts)
- Display forwarding configuration (X11/Wayland)

### User Story 2 - Native Linux Game Execution (Priority: P2)

User wants to launch native Linux games through the dillinger-runner container for consistent execution environment.

**Why this priority**: Extends the streaming capability to native games, providing unified execution environment.

**Independent Test**: User can launch a native Linux game and see it stream properly.

**Acceptance Scenarios**:

1. **Given** user has a native Linux game, **When** they launch it via dillinger-runner, **Then** game runs natively without Wine/Proton layer
2. **Given** a Linux game requires specific libraries, **When** launched, **Then** dillinger-runner provides the necessary runtime environment

### User Story 3 - Container Resource Management (Priority: P2)

System administrator wants to configure resource limits and GPU access for game containers.

**Why this priority**: Essential for production deployment and multi-user scenarios.

**Independent Test**: Administrator can set memory/CPU limits and verify they're enforced during game execution.

**Acceptance Scenarios**:

1. **Given** administrator sets resource limits, **When** games are launched, **Then** containers respect CPU/memory constraints
2. **Given** system has GPU, **When** games requiring GPU are launched, **Then** GPU access is properly passed through to container

## Functional Requirements

### Game Execution Engine
- **REQ-1**: Launch Windows games via Wine/Proton in containerized environment
- **REQ-2**: Execute native Linux games with proper library dependencies
- **REQ-3**: Manage game process lifecycle (start, monitor, terminate)
- **REQ-4**: Handle game crashes and cleanup gracefully

### Display Streaming
- **REQ-5**: Forward X11 display from container to host system
- **REQ-6**: Support Wayland display protocol forwarding
- **REQ-7**: Stream game video output to web browser (future: WebRTC/similar)
- **REQ-8**: Handle multiple concurrent game sessions

### Container Integration
- **REQ-9**: Access dillinger_library volume for game files and metadata
- **REQ-10**: Communicate with main Dillinger application for launch requests
- **REQ-11**: Report game status and performance metrics back to Dillinger
- **REQ-12**: Support GPU passthrough for hardware-accelerated games

### Resource Management
- **REQ-13**: Configurable CPU and memory limits per game container
- **REQ-14**: Automatic cleanup of terminated game containers
- **REQ-15**: Monitoring and logging of container resource usage

## Non-Functional Requirements

### Performance
- Game launch time should be under 30 seconds for most titles
- Display latency should be minimal for local streaming
- Container overhead should not significantly impact game performance

### Scalability
- Support multiple concurrent game sessions on capable hardware
- Efficient resource sharing between containers
- Horizontal scaling for multi-user scenarios

### Reliability
- Game crashes should not affect the host system or other containers
- Automatic recovery from container failures
- Proper cleanup of resources on game termination

### Security
- Isolation between game containers and host system
- Secure handling of game files and user data
- Prevention of privilege escalation from game processes
- API key authentication for dillinger-core to dillinger-runner communication
- Environment variable-based key management with rotation capability

## Technical Context

### Project Structure
- **apps/dillinger-core**: Existing web application (backend, frontend, shared packages)
- **apps/dillinger-runner**: New containerized game execution environment
- **packages/**: Shared libraries and types between both applications
- **pnpm workspace**: Manages dependencies and build coordination across applications
- Independent Docker builds for each application with separate deployment capabilities

### Build & Development Commands
- App-specific scripts: `build:core`, `build:runner`, `dev:core`, `dev:runner`, `docker:core`, `docker:runner`
- Combined scripts: `build:all`, `dev:all`, `docker:all` for full-stack development
- Individual app control enables focused development and independent CI/CD pipelines

### Development Environment
- Primary workflow: `pnpm dev:all` for combined full-stack development
- Component-focused: `pnpm dev:core` or `pnpm dev:runner` for individual app development
- Docker testing: Independent container builds and testing per application
- Shared packages automatically synchronized across workspace during development

### Container Runtime
- Base on Wine/Proton container images for Windows game support
- Include essential gaming libraries (Mesa, Vulkan, etc.)
- X11/Wayland server setup for display forwarding
- Audio system configuration (PulseAudio/PipeWire)

### Integration Points
- Independent Docker builds: apps/dillinger-core and apps/dillinger-runner build separately
- Shared packages/ imported during Docker build phase (not runtime dependency)
- Docker Compose orchestration between dillinger-core and dillinger-runner services
- Shared volume access to dillinger_library
- API endpoints for container management
- Event-driven communication for game state changes

### Dependencies
- Docker runtime with GPU support (NVIDIA Container Runtime)
- Host X11/Wayland server for display forwarding
- Wine/Proton for Windows game compatibility
- Mesa/Vulkan drivers for graphics acceleration

## Success Metrics

- **Functional**: 90% of tested Windows games launch successfully via Wine/Proton
- **Performance**: Game launch time under 30 seconds for 95% of titles
- **Reliability**: Less than 5% container failure rate during normal operation
- **User Experience**: Seamless integration with existing Dillinger library interface