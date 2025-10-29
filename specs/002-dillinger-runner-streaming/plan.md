# Implementation Plan: Dillinger Runner Streaming

**Branch**: `002-dillinger-runner-streaming` | **Date**: 2025-10-29 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-dillinger-runner-streaming/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Create a containerized game streaming system with separate `dillinger-core` (management) and `dillinger-runner` (execution) applications. The runner enables Windows games via Wine/Proton and native Linux games with X11/Wayland display forwarding. Uses apps/ + packages/ pnpm workspace structure with independent Docker builds and API key authentication between containers.

## Technical Context

**Language/Version**: Docker multi-stage builds, Bash scripting, C++ (for Wolf components), Ubuntu 25.04 base, TypeScript 5.x with Node.js 18+  
**Primary Dependencies**: Wine/Proton, GStreamer 1.26.2, Wayland/X11, PulseAudio, Mesa/Vulkan drivers, Express.js, Next.js 14+  
**Storage**: Docker volume `dillinger_library` (shared), container-local game state, JSON files with GUID linking  
**Testing**: Container integration tests, game launch validation, display forwarding verification, TypeScript testing frameworks  
**Target Platform**: Linux host with Docker runtime, GPU passthrough support (NVIDIA Container Runtime)
**Project Type**: Multi-app workspace - apps/dillinger-core (web) + apps/dillinger-runner (container)  
**Performance Goals**: <30s game launch time, minimal display latency for local streaming, GPU acceleration support  
**Constraints**: Container isolation, configurable resource limits, automatic cleanup on termination, API key authentication  
**Scale/Scope**: Multi-user concurrent sessions, horizontal scaling support, independent CI/CD pipelines

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Initial Check (Pre-Phase 0)**: ✅ PASSED
- **Simplicity First**: ✅ Solves concrete user problem (containerized game streaming). Starting with proven GOW/Wolf patterns, adding complexity incrementally.
- **User-Centered Design**: ✅ User stories are independently testable (launch game, see stream, provide input). Each delivers standalone value.
- **Quality Over Speed**: ✅ Clear acceptance criteria defined. Performance requirements documented (<30s launch, minimal latency).
- **Development Standards**: ✅ Following spec-driven workflow. Dependencies justified by research and gaming requirements.

**Post-Phase 1 Re-evaluation**: ✅ PASSED
- **Simplicity First**: ✅ apps/ + packages/ structure maintains simplicity with clear separation. Container approach isolates complexity.
- **User-Centered Design**: ✅ Data model and API directly support user scenarios. Clear state transitions and error handling.
- **Quality Over Speed**: ✅ Comprehensive validation rules defined. Performance metrics specified. Resource limits prevent system impact.
- **Development Standards**: ✅ Full spec-driven approach completed: research → design → contracts → quickstart. Agent context updated.

## Project Structure

### Documentation (this feature)

```text
specs/002-dillinger-runner-streaming/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command) ✅ COMPLETE
├── data-model.md        # Phase 1 output (/speckit.plan command) ✅ COMPLETE
├── quickstart.md        # Phase 1 output (/speckit.plan command) ✅ COMPLETE
├── contracts/           # Phase 1 output (/speckit.plan command) ✅ COMPLETE
│   └── openapi.yaml     # API specification for runner services
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Multi-app workspace structure (clarified in spec)
apps/
├── dillinger-core/      # Existing web application (renamed from current structure)
│   ├── backend/
│   │   └── src/
│   │       ├── api/
│   │       │   └── runner.ts           # New: Runner orchestration endpoints
│   │       └── services/
│   │           └── runner-orchestrator.ts # New: Container management service
│   ├── frontend/
│   │   └── app/
│   │       └── components/
│   │           └── GameLauncher.tsx     # New: Game launch UI component
│   └── shared/
└── dillinger-runner/    # New: Containerized game execution environment
    ├── package.json
    ├── Dockerfile
    ├── docker-compose.runner.yml
    └── src/
        ├── api/
        │   └── server.ts              # API server for launch commands
        ├── services/
        │   ├── game-launcher.ts       # Game process management
        │   ├── display-manager.ts     # X11/Wayland forwarding
        │   └── resource-monitor.ts    # Resource usage tracking
        └── scripts/
            ├── entrypoint.sh          # Container startup script
            ├── launch-game.sh         # Game execution script
            └── setup-display.sh       # Display forwarding setup

packages/                # Shared libraries between apps
├── runner-types/        # New: Shared TypeScript types for runner communication
│   └── src/
│       ├── api.ts
│       ├── session.ts
│       └── container.ts
├── shared/              # Existing: Common utilities
└── validation/          # New: Shared validation logic

tests/
├── integration/
│   └── runner-integration.test.ts    # End-to-end game launch tests
└── container/
    └── runner-container.test.sh      # Docker container validation
```

**Structure Decision**: Multi-app workspace with apps/dillinger-core (management) and apps/dillinger-runner (execution) as independent applications sharing packages/. This enables independent Docker builds, deployment, and CI/CD while maintaining shared code through the pnpm workspace.

## Complexity Tracking

> **Constitution compliance requires justification for added complexity**

| Complexity Element | Why Needed | Simpler Alternative Rejected Because |
|-------------------|------------|-------------------------------------|
| Separate Docker applications | Games require isolation from main app, different runtime environment (Wine/GPU access) | Running games in main container would break isolation, create security risks, and require privileged access |
| Multi-app workspace structure | Independent deployment and scaling of core vs runner, different technology stacks | Single app would mix web UI concerns with containerized game execution, harder to maintain and deploy |
| Wine/Proton integration | Windows games are primary use case, users expect compatibility with existing libraries | Linux-only approach would exclude majority of PC gaming library |
| API-based communication | Container orchestration requires service-to-service communication with proper error handling | Direct container access would break encapsulation and make error recovery impossible |
| Session state management | Games can crash/hang, users need visibility and recovery capabilities | Fire-and-forget approach provides poor user experience and no error recovery |

**Justification Summary**: The complexity is inherent to containerized game execution with proper separation of concerns. Each element addresses concrete user needs while maintaining security, scalability, and maintainability.
