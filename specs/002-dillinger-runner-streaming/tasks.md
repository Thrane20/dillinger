# Implementation Tasks: Dillinger Runner Streaming

**Feature**: 002-dillinger-runner-streaming  
**Branch**: `002-dillinger-runner-streaming`  
**Created**: 2025-10-29

## Overview

Implementation tasks for containerized game streaming system with separate dillinger-core (management) and dillinger-runner (execution) applications. Organized by user story priority to enable independent implementation and testing.

## Task Summary

- **Total Tasks**: 47
- **User Story 1 (P1)**: 18 tasks - Windows game streaming foundation
- **User Story 2 (P2)**: 8 tasks - Native Linux game support  
- **User Story 3 (P2)**: 7 tasks - Resource management and monitoring
- **Setup/Infrastructure**: 14 tasks

## Dependencies & Execution Order

### Story Dependencies
1. **Setup & Foundational** → Required for all user stories
2. **User Story 1 (P1)** → Independent (MVP candidate)
3. **User Story 2 (P2)** → Independent, can be developed in parallel with US1
4. **User Story 3 (P2)** → Can start after foundational, benefits from US1 completion

### Parallel Execution Opportunities
- US2 and US3 can be developed simultaneously after foundational tasks
- Within each story: Frontend and backend components can be developed in parallel
- Package development can proceed independently of app development

## Implementation Strategy

**MVP Scope**: User Story 1 only - provides core Windows game streaming capability
**Incremental Delivery**: Each user story delivers independently testable value
**Parallel Development**: Frontend and backend teams can work simultaneously using contracts

---

## Phase 1: Setup & Infrastructure

**Goal**: Establish multi-app workspace and foundational infrastructure

- [ ] T001 Restructure repository to apps/ + packages/ workspace layout per plan.md
- [ ] T002 [P] Create apps/dillinger-core/ directory structure and move existing packages
- [ ] T003 [P] Create apps/dillinger-runner/ directory structure per plan.md
- [ ] T004 [P] Create packages/runner-types/ with base TypeScript configuration
- [ ] T005 [P] Create packages/validation/ with shared validation utilities
- [ ] T006 Update root package.json with workspace configuration and scripts
- [ ] T007 [P] Create apps/dillinger-core/package.json with existing dependencies
- [ ] T008 [P] Create apps/dillinger-runner/package.json with container dependencies
- [ ] T009 [P] Create packages/runner-types/package.json with type definitions
- [ ] T010 [P] Create packages/validation/package.json with validation dependencies
- [ ] T011 Update pnpm-workspace.yaml to include apps/ and packages/ structure
- [ ] T012 [P] Create docker-compose.dev.yml extension for dillinger-runner service
- [ ] T013 [P] Create .env.example with API key and configuration variables
- [ ] T014 Verify workspace setup with `pnpm install` and build scripts

---

## Phase 2: Foundational Components

**Goal**: Core shared types and validation required by all user stories

- [ ] T015 [P] Implement GameLaunchRequest interface in packages/runner-types/src/api.ts
- [ ] T016 [P] Implement RunnerSession interface in packages/runner-types/src/session.ts
- [ ] T017 [P] Implement LaunchConfiguration interface in packages/runner-types/src/container.ts
- [ ] T018 [P] Implement ResourceLimits and DisplayConfiguration types in packages/runner-types/src/container.ts
- [ ] T019 [P] Create validation schemas in packages/validation/src/runner-schemas.ts
- [ ] T020 [P] Implement API key authentication middleware in packages/validation/src/auth.ts
- [ ] T021 Export all types from packages/runner-types/src/index.ts
- [ ] T022 Export all validation utilities from packages/validation/src/index.ts

---

## Phase 3: User Story 1 - Windows Game Streaming (P1)

**Goal**: Launch Windows games via Wine/Proton with display streaming
**Independent Test**: User can click Windows game in library and see it launch successfully

### Backend Infrastructure
- [ ] T023 [P] [US1] Create apps/dillinger-runner/src/api/server.ts with Express setup
- [ ] T024 [P] [US1] Implement health check endpoint in apps/dillinger-runner/src/api/health.ts
- [ ] T025 [US1] Implement launch endpoint in apps/dillinger-runner/src/api/launch.ts
- [ ] T026 [P] [US1] Create session management service in apps/dillinger-runner/src/services/session-manager.ts
- [ ] T027 [P] [US1] Implement Wine/Proton service in apps/dillinger-runner/src/services/wine-manager.ts
- [ ] T028 [P] [US1] Create display forwarding service in apps/dillinger-runner/src/services/display-manager.ts
- [ ] T029 [P] [US1] Implement game process manager in apps/dillinger-runner/src/services/game-launcher.ts

### Container Setup
- [ ] T030 [US1] Create apps/dillinger-runner/Dockerfile with Ubuntu 25.04 base and Wine setup
- [ ] T031 [P] [US1] Create container entrypoint script in apps/dillinger-runner/src/scripts/entrypoint.sh
- [ ] T032 [P] [US1] Create game launch script in apps/dillinger-runner/src/scripts/launch-game.sh
- [ ] T033 [P] [US1] Create display setup script in apps/dillinger-runner/src/scripts/setup-display.sh
- [ ] T034 [US1] Configure Docker build process and Wine prefix initialization

### Core Integration
- [ ] T035 [P] [US1] Add runner orchestration API in apps/dillinger-core/backend/src/api/runner.ts
- [ ] T036 [P] [US1] Implement runner service in apps/dillinger-core/backend/src/services/runner-orchestrator.ts
- [ ] T037 [P] [US1] Create GameLauncher component in apps/dillinger-core/frontend/app/components/GameLauncher.tsx
- [ ] T038 [US1] Integrate game launch UI with existing game library interface

### Session Management
- [ ] T039 [P] [US1] Implement session state tracking in apps/dillinger-runner/src/services/session-manager.ts
- [ ] T040 [P] [US1] Add session cleanup and termination handlers in apps/dillinger-runner/src/services/cleanup.ts

**US1 Acceptance Test**: Launch Windows game (e.g., Notepad via Wine), verify container starts, display forwards to host, and game responds to input

---

## Phase 4: User Story 2 - Native Linux Games (P2)

**Goal**: Execute native Linux games through consistent containerized environment
**Independent Test**: User can launch native Linux game and see it stream properly

### Linux Runtime Support
- [ ] T041 [P] [US2] Extend game launcher service for native Linux execution in apps/dillinger-runner/src/services/game-launcher.ts
- [ ] T042 [P] [US2] Add Linux library dependency management in apps/dillinger-runner/src/services/linux-runtime.ts
- [ ] T043 [P] [US2] Update launch script to handle Linux vs Windows platform detection in apps/dillinger-runner/src/scripts/launch-game.sh
- [ ] T044 [US2] Extend Dockerfile with essential Linux gaming libraries (Mesa, Vulkan, etc.)

### Core Integration Extensions
- [ ] T045 [P] [US2] Update GameLauncher component to support Linux games in apps/dillinger-core/frontend/app/components/GameLauncher.tsx
- [ ] T046 [P] [US2] Extend runner orchestrator for Linux game launching in apps/dillinger-core/backend/src/services/runner-orchestrator.ts
- [ ] T047 [US2] Add platform-specific configuration in launch endpoint in apps/dillinger-runner/src/api/launch.ts
- [ ] T048 [P] [US2] Update validation schemas for Linux platform support in packages/validation/src/runner-schemas.ts

**US2 Acceptance Test**: Launch native Linux game (e.g., Tux Racer), verify execution without Wine layer and proper library access

---

## Phase 5: User Story 3 - Resource Management (P2)

**Goal**: Configure and monitor container resource limits and GPU access
**Independent Test**: Set resource limits and verify enforcement during game execution

### Resource Monitoring
- [ ] T049 [P] [US3] Implement resource monitoring service in apps/dillinger-runner/src/services/resource-monitor.ts
- [ ] T050 [P] [US3] Create metrics collection and reporting in apps/dillinger-runner/src/services/metrics-collector.ts
- [ ] T051 [P] [US3] Add resource usage endpoints in apps/dillinger-runner/src/api/monitoring.ts

### Resource Enforcement
- [ ] T052 [P] [US3] Implement resource limit validation in packages/validation/src/resource-validation.ts
- [ ] T053 [P] [US3] Add GPU passthrough configuration in apps/dillinger-runner/src/services/gpu-manager.ts
- [ ] T054 [US3] Extend Docker configuration for resource limits and GPU access
- [ ] T055 [P] [US3] Add resource monitoring UI in apps/dillinger-core/frontend/app/components/ResourceMonitor.tsx

**US3 Acceptance Test**: Set CPU/memory limits, launch game, verify limits enforced and GPU access works when configured

---

## Phase 6: Polish & Cross-Cutting Concerns

**Goal**: Production readiness and operational excellence

### Testing & Validation
- [ ] T056 [P] Create integration test suite in tests/integration/runner-integration.test.ts
- [ ] T057 [P] Create container validation tests in tests/container/runner-container.test.sh
- [ ] T058 [P] Add end-to-end game launch tests with real games

### Documentation & Deployment
- [ ] T059 [P] Update quickstart.md with new workspace structure and build commands
- [ ] T060 [P] Create production Docker Compose configuration
- [ ] T061 [P] Add CI/CD pipeline configuration for independent app builds

### Performance & Reliability
- [ ] T062 [P] Implement container cleanup automation and resource recovery
- [ ] T063 [P] Add comprehensive logging and error handling across all services
- [ ] T064 [P] Optimize container startup time and resource usage

---

## Parallel Development Examples

### User Story 1 Development
```bash
# Team A: Frontend components
pnpm --filter dillinger-core dev
# Work on: T037 (GameLauncher), T038 (integration)

# Team B: Backend services  
pnpm --filter dillinger-runner dev
# Work on: T023-T029 (API and services)

# Team C: Container infrastructure
docker build apps/dillinger-runner/
# Work on: T030-T034 (Docker setup)
```

### Cross-Story Development
```bash
# Platform team: Shared packages (all stories)
pnpm --filter runner-types build
pnpm --filter validation build
# Work on: T015-T022 (foundational types)

# Feature teams: Independent story implementation
# US1 and US2 can proceed simultaneously after foundational
```

## Validation Checklist

Each user story must pass independent testing:

### User Story 1 Validation
- [ ] Windows game launches via Wine/Proton
- [ ] Display forwards properly to host
- [ ] Input (mouse/keyboard) works in game
- [ ] Container cleanup on game termination
- [ ] Session state tracked and reported

### User Story 2 Validation  
- [ ] Native Linux game launches without Wine
- [ ] Required libraries accessible
- [ ] Performance comparable to host execution
- [ ] Same session management as Windows games

### User Story 3 Validation
- [ ] Resource limits configurable and enforced
- [ ] GPU passthrough functional when enabled
- [ ] Monitoring data accurate and timely
- [ ] System stability under resource constraints

## Build Commands

```bash
# Individual apps
pnpm build:core      # Build dillinger-core
pnpm build:runner    # Build dillinger-runner
pnpm dev:core        # Develop dillinger-core
pnpm dev:runner      # Develop dillinger-runner

# Docker operations
pnpm docker:core     # Build core Docker image
pnpm docker:runner   # Build runner Docker image
pnpm docker:all      # Build all images

# Full workspace
pnpm build:all       # Build everything
pnpm dev:all         # Run full development stack
```

---

**Next Steps**: Begin with Phase 1 setup tasks, then proceed with User Story 1 as MVP. User Stories 2 and 3 can be developed in parallel after foundational components are complete.