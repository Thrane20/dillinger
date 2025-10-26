# Implementation Plan: Game Library Manager

**Branch**: `001-game-library-manager` | **Date**: 2025-10-26 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-game-library-manager/spec.md`

## Summary

Dillinger is a comprehensive game library management platform that enables users to organize, launch, and play games across multiple platforms through a unified web interface. The system supports native Linux games, Windows games via Wine/Proton, and retro games through emulators, all running in containerized environments with X11/Wayland display streaming. The core architecture uses a TypeScript monorepo with pnpm workspaces, Express.js backend API, Next.js frontend, and Docker containers for game execution isolation.

## Technical Context

**Language/Version**: TypeScript 5.x with Node.js 18+  
**Primary Dependencies**: Express.js, Next.js 14+, TailwindCSS, pnpm workspaces  
**Storage**: JSON files with GUID linking in Docker volume (human-readable)  
**Testing**: Jest for unit tests, Supertest for API integration, Playwright for E2E  
**Target Platform**: Linux server with Docker containers, web browser clients, and Games on Whales/Wolf for game streaming to desktop  
**Project Type**: Web application with backend API and frontend interface to launch games via container orchestration  
**Performance Goals**: 30s game launch, 5min game addition, 30fps streaming  
**Constraints**: Containerized execution only, no local game installations, JSON-only storage (no database platforms)  
**Scale/Scope**: Hobby project, single user initially, 1000+ game library support, multiple concurrent sessions

## Constitution Check (Post-Design Re-evaluation)

*GATE: Re-check after Phase 1 design completion*

- **Simplicity First**: ✅ PASS - Technical design maintains simplicity through:
  - TypeScript monorepo eliminates type drift without complex build systems
  - pnpm workspaces provide dependency management without unnecessary tooling
  - JSON file storage avoids database setup requirements
  - REST API design over more complex GraphQL or RPC patterns

- **User-Centered Design**: ✅ PASS - Architecture supports independent user value delivery:
  - API contracts defined to support each user story independently
  - Frontend can display library without game execution working
  - Game launch functionality isolated from metadata and organization features
  - Each platform type (native, wine, emulator) can be implemented and tested separately

- **Quality Over Speed**: ✅ PASS - Design includes quality safeguards:
  - Shared TypeScript interfaces prevent API contract drift between frontend/backend
  - TypeScript strict mode across all packages catches errors at compile time
  - OpenAPI specification provides clear API documentation and validation
  - JSON schema validation ensures data integrity with proper relationships and constraints
  - Docker isolation prevents game execution from affecting host system

- **Development Standards**: ✅ PASS - Complete spec-driven workflow implemented:
  - Full specification → detailed plan → implementation contracts established
  - All dependencies documented with rationale in research.md
  - Performance requirements quantified (30s launch, 5min add, 30fps streaming)
  - Quickstart guide provides complete development setup and validation procedures

**Final Assessment**: All constitutional gates satisfied through technical design. Architecture supports principles while delivering user value. Ready for implementation phase.

---

## Phase 0: Research & Architecture Resolution ✅ COMPLETE

**Status**: All technical unknowns resolved and decisions documented

**Key Decisions Made**:
- Database: JSON files only
- Display Streaming: Games on Whales / Wolf streaming to the desktop. Not through web browsers.
- Metadata: IGDB API with local caching and manual overrides. More options will come later, so be extensible.
- Containers: A separate docker run spins up all required apps and exes. Don't use compose - keep it simple. one docker image only with everything in it.
- Package Management: pnpm workspaces for TypeScript monorepo
- Wine Integration: Ability to download wine / proton runtimes as required. Do not lean on other launchers (lutris etc.) - this is a fully separate project.

**Artifacts**: `research.md` with complete decision rationale and implementation timeline

---

## Phase 1: Design & Contracts ✅ COMPLETE

**Status**: Complete architecture design with implementation contracts

**Architecture Finalized**:
- pnpm workspace monorepo: `packages/{shared,backend,frontend}`
- Shared TypeScript package with custom validation for type safety
- Express.js backend with JSON files and a custom JSON adapter
- Next.js frontend with TailwindCSS styling
- Docker containers for game execution - leveraging Games on Whales / Wolf for streaming to the desktop.

**Artifacts Generated**:
- `data-model.md`: Complete database schema with entities, relationships, and validation rules
- `contracts/openapi.yaml`: Full REST API specification with all endpoints and schemas
- `quickstart.md`: Development setup guide with validation procedures
- Updated agent context with complete technology stack

**API Contract Summary**:
- **Games**: CRUD operations, launch sessions, metadata integration
- **Platforms**: Configuration management for execution environments  
- **Sessions**: Lifecycle management and desktop streaming details
- **Collections**: Organization and categorization functionality
- **Metadata**: External data source integration and search

**Database Design Summary**:
- **5 Core Entities**: Game, Platform, GameSession, Collection, MetadataCache
- **Performance Optimized**: Index files for search, filtering, and relationships
- **Extensible Schema**: Migration strategy for future features (users, achievements, etc.)
- **Data Integrity**: Validation rules and constraints aligned with API schemas

---

## Ready for Phase 2: Implementation

### ✅ Phase 0 Complete: All research resolved, technology stack decided
### ✅ Phase 1 Complete: Architecture designed, API contracts specified, development environment documented
### 🎯 **READY FOR IMPLEMENTATION**

**Implementation Roadmap**:
1. **Foundation Setup** (Week 1): pnpm workspace, shared types, basic Express server, Next.js app
2. **Core API** (Week 2-3): Game/Platform CRUD, JSON storage integration, validation middleware
3. **Frontend Core** (Week 4-5): Game library UI, responsive design, API integration
4. **Game Execution** (Week 6-8): Docker container management, Games on Whales/Wolf streaming, platform runners
5. **Metadata Integration** (Week 9-10): IGDB API integration, artwork caching
6. **Platform Extension** (Week 11-12): Emulator support, Wine/Proton integration

**Next Steps**:
- Execute `/speckit.tasks` to generate detailed implementation tasks
- Begin foundation setup following quickstart.md procedures
- Start with shared package TypeScript types and basic API server

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
packages/
├── shared/              # Shared TypeScript types and utilities
│   ├── src/
│   │   ├── types/       # API contracts and data models
│   │   ├── utils/       # Custom validation and common utility functions
│   │   └── index.ts     # Exports
│   └── package.json
├── backend/             # Express.js API server
│   ├── src/
│   │   ├── models/      # JSON entity models and validation
│   │   ├── services/    # Business logic services
│   │   ├── controllers/ # Express route controllers
│   │   ├── middleware/  # Custom middleware
│   │   └── utils/       # Backend-specific utilities
│   └── tests/
│       ├── unit/        # Unit tests
│       └── integration/ # API integration tests
└── frontend/            # Next.js web application
    ├── src/
    │   ├── app/         # Next.js app router pages
    │   ├── components/  # React components
    │   ├── hooks/       # Custom React hooks
    │   ├── lib/         # Client-side utilities
    │   └── styles/      # TailwindCSS styles
    └── tests/
        └── e2e/         # Playwright E2E tests

docker/
├── backend/             # Backend container configuration
├── game-runners/        # Game execution containers
│   ├── linux-native/   # Native Linux game runner
│   ├── wine/            # Wine/Proton runner
│   └── emulators/       # Emulator containers
└── docker-compose.yml

pnpm-workspace.yaml      # Workspace configuration
package.json             # Root package.json with workspace scripts
```

**Structure Decision**: Selected Option 2 (Web application) with pnpm workspace monorepo structure. This provides TypeScript type sharing between frontend and backend while maintaining clear separation of concerns. The shared package prevents API contract drift and enables consistent validation across the full stack.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
