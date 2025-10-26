# Tasks: Game Library Manager

**Input**: Design documents from `/specs/001-game-library-manager/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are NOT explicitly requested in the feature specification, so they are omitted per speckit.tasks guidelines.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

Based on plan.md structure: pnpm workspace monorepo with `packages/{shared,backend,frontend}`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and monorepo structure

- [X] T001 Create monorepo structure: packages/{shared,backend,frontend}, docker/{backend,game-runners}
- [X] T002 Initialize root package.json with pnpm workspace configuration and scripts
- [X] T003 [P] Create pnpm-workspace.yaml configuration file
- [X] T004 [P] Configure ESLint and Prettier for TypeScript across all packages
- [X] T005 Initialize packages/shared/package.json with TypeScript configuration
- [X] T006 Initialize packages/backend/package.json with Express.js dependencies
- [X] T007 Initialize packages/frontend/package.json with Next.js dependencies
- [X] T008 [P] Create packages/shared/tsconfig.json for shared types compilation
- [X] T009 [P] Create packages/backend/tsconfig.json extending shared configuration
- [X] T010 [P] Create packages/frontend/tsconfig.json for Next.js

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T011 Create shared TypeScript interfaces in packages/shared/src/types/game.ts
- [X] T012 Create shared TypeScript interfaces in packages/shared/src/types/api.ts
- [X] T013 Create custom validation utilities in packages/shared/src/utils/validation.ts
- [X] T014 Create shared package index file packages/shared/src/index.ts with exports
- [X] T015 Build shared package: packages/shared/dist/ with compiled types
- [X] T016 Create JSON storage service in packages/backend/src/services/storage.ts
- [X] T017 Create Express.js server with basic middleware in packages/backend/src/index.ts
- [X] T018 Create health check endpoint /api/health in packages/backend/src/index.ts
- [X] T019 [P] Create Docker development environment docker-compose.dev.yml
- [X] T020 [P] Create backend Dockerfile docker/backend/Dockerfile.dev
- [X] T021 [P] Create frontend Dockerfile docker/frontend/Dockerfile.dev
- [X] T022 Create Next.js app layout in packages/frontend/app/layout.tsx
- [X] T023 Create basic homepage in packages/frontend/app/page.tsx
- [X] T024 Create data directory structure script packages/backend/src/scripts/init-data.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Add Game to Library (Priority: P1) 🎯 MVP

**Goal**: Users can add games by providing file paths and selecting platforms, with automatic metadata detection

**Independent Test**: User can add a game file, see it appear in their library with basic metadata, even if other features aren't working

### Implementation for User Story 1

- [ ] T025 [P] [US1] Create Game entity model in packages/backend/src/models/game.ts
- [ ] T026 [P] [US1] Create Platform entity model in packages/backend/src/models/platform.ts
- [ ] T027 [P] [US1] Create file validation service in packages/backend/src/services/file-validator.ts
- [ ] T028 [US1] Create game service with CRUD operations in packages/backend/src/services/game-service.ts
- [ ] T029 [US1] Create platform service with default platforms in packages/backend/src/services/platform-service.ts
- [ ] T030 [US1] Implement games controller with POST /api/games in packages/backend/src/controllers/games-controller.ts
- [ ] T031 [US1] Implement platforms controller with GET /api/platforms in packages/backend/src/controllers/platforms-controller.ts
- [ ] T032 [US1] Add games and platforms routes to Express app in packages/backend/src/index.ts
- [ ] T033 [US1] Create basic metadata scraper service in packages/backend/src/services/metadata-service.ts
- [ ] T034 [P] [US1] Create add game form component in packages/frontend/components/add-game-form.tsx
- [ ] T035 [P] [US1] Create platform selector component in packages/frontend/components/platform-selector.tsx
- [ ] T036 [US1] Create add game page in packages/frontend/app/add-game/page.tsx
- [ ] T037 [US1] Create API client for games in packages/frontend/lib/api/games.ts
- [ ] T038 [US1] Create API client for platforms in packages/frontend/lib/api/platforms.ts
- [ ] T039 [US1] Integrate form submission with backend API in add game page
- [ ] T040 [US1] Add navigation link to add game page in layout

**Checkpoint**: At this point, User Story 1 should be fully functional - users can add games to their library

---

## Phase 4: User Story 2 - Launch Game Session (Priority: P1)

**Goal**: Users can click a game in their library and launch it with desktop streaming via Games on Whales/Wolf

**Independent Test**: User can click a game in their library and have it launch in a container with display streaming to desktop

### Implementation for User Story 2

- [ ] T041 [P] [US2] Create GameSession entity model in packages/backend/src/models/game-session.ts
- [ ] T042 [P] [US2] Create Docker container management service in packages/backend/src/services/docker-service.ts
- [ ] T043 [US2] Create game session service with lifecycle management in packages/backend/src/services/session-service.ts
- [ ] T044 [US2] Create streaming service for Games on Whales/Wolf integration in packages/backend/src/services/streaming-service.ts
- [ ] T045 [US2] Implement sessions controller with POST /api/games/{id}/launch in packages/backend/src/controllers/sessions-controller.ts
- [ ] T046 [US2] Implement sessions controller with GET /api/sessions in packages/backend/src/controllers/sessions-controller.ts
- [ ] T047 [US2] Implement sessions controller with DELETE /api/sessions/{id} in packages/backend/src/controllers/sessions-controller.ts
- [ ] T048 [US2] Add sessions routes to Express app in packages/backend/src/index.ts
- [ ] T049 [US2] Update games controller with GET /api/games/{id} endpoint for game details
- [ ] T050 [P] [US2] Create game card component with launch button in packages/frontend/components/game-card.tsx
- [ ] T051 [P] [US2] Create session status component in packages/frontend/components/session-status.tsx
- [ ] T052 [US2] Create basic game library grid in packages/frontend/components/game-library.tsx
- [ ] T053 [US2] Create API client for sessions in packages/frontend/lib/api/sessions.ts
- [ ] T054 [US2] Update homepage to display game library instead of welcome message
- [ ] T055 [US2] Add launch functionality to game cards with session management
- [ ] T056 [US2] Create sessions page in packages/frontend/app/sessions/page.tsx
- [ ] T057 [US2] Add navigation link to sessions page in layout

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - add games + launch games

---

## Phase 5: User Story 3 - Browse and Organize Library (Priority: P2)

**Goal**: Users can view their game collection with rich metadata, artwork, search, filters, and collections

**Independent Test**: User can browse a library of multiple games, see artwork and metadata, and find specific games using search/filters

### Implementation for User Story 3

- [ ] T058 [P] [US3] Create Collection entity model in packages/backend/src/models/collection.ts
- [ ] T059 [P] [US3] Create search and filtering utilities in packages/backend/src/utils/search.ts
- [ ] T060 [US3] Create collection service with CRUD operations in packages/backend/src/services/collection-service.ts
- [ ] T061 [US3] Update game service with search and filtering capabilities
- [ ] T062 [US3] Implement collections controller with full CRUD in packages/backend/src/controllers/collections-controller.ts
- [ ] T063 [US3] Update games controller with search and filtering parameters
- [ ] T064 [US3] Add collections routes to Express app in packages/backend/src/index.ts
- [ ] T065 [US3] Enhance metadata service with IGDB API integration for artwork
- [ ] T066 [P] [US3] Create search bar component in packages/frontend/components/search-bar.tsx
- [ ] T067 [P] [US3] Create filter controls component in packages/frontend/components/filter-controls.tsx
- [ ] T068 [P] [US3] Create collection card component in packages/frontend/components/collection-card.tsx
- [ ] T069 [P] [US3] Create collection form component in packages/frontend/components/collection-form.tsx
- [ ] T070 [US3] Enhance game library component with search and filtering
- [ ] T071 [US3] Create collections page in packages/frontend/app/collections/page.tsx
- [ ] T072 [US3] Create collection details page in packages/frontend/app/collections/[id]/page.tsx
- [ ] T073 [US3] Create API client for collections in packages/frontend/lib/api/collections.ts
- [ ] T074 [US3] Add collections navigation link in layout
- [ ] T075 [US3] Integrate search and filtering into homepage game library
- [ ] T076 [US3] Add collection management to game cards (add to collection)

**Checkpoint**: All core features now work - add games, launch games, organize and browse library

---

## Phase 6: User Story 4 - Cross-Platform Game Management (Priority: P3)

**Goal**: Users can manage multiple platform versions of the same game title with platform indicators

**Independent Test**: User can add multiple versions of the same game and see them grouped or tagged as related

### Implementation for User Story 4

- [ ] T077 [P] [US4] Create game relationship utilities in packages/backend/src/utils/game-relations.ts
- [ ] T078 [US4] Update game service with cross-platform game detection and linking
- [ ] T079 [US4] Update metadata service with cross-platform game identification
- [ ] T080 [US4] Enhance games controller with related games endpoint GET /api/games/{id}/related
- [ ] T081 [P] [US4] Create platform indicator component in packages/frontend/components/platform-indicator.tsx
- [ ] T082 [P] [US4] Create related games component in packages/frontend/components/related-games.tsx
- [ ] T083 [US4] Create game details page in packages/frontend/app/games/[id]/page.tsx
- [ ] T084 [US4] Update game library to show platform indicators and group related games
- [ ] T085 [US4] Add navigation to game details from game cards
- [ ] T086 [US4] Update search to find all platform variants when searching by title

**Checkpoint**: All user stories should now be independently functional with full cross-platform support

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T087 [P] Add comprehensive error handling and logging across all controllers
- [ ] T088 [P] Implement request validation middleware using shared validation utilities
- [ ] T089 [P] Add loading states and error boundaries to frontend components
- [ ] T090 [P] Optimize JSON storage with background index rebuilding
- [ ] T091 [P] Add container cleanup and resource management to session service
- [ ] T092 [P] Enhance metadata caching with expiration and refresh logic
- [ ] T093 [P] Add responsive design improvements for mobile devices
- [ ] T094 [P] Implement graceful shutdown handling for Docker containers
- [ ] T095 [P] Add performance monitoring and health checks for container operations
- [ ] T096 Run quickstart.md validation to ensure development environment works correctly

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phases 3-6)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P1 → P2 → P3)
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1) - Add Game**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1) - Launch Game**: Can start after Foundational (Phase 2) - Integrates with US1 games but independently testable
- **User Story 3 (P2) - Browse/Organize**: Can start after Foundational (Phase 2) - Uses US1 games but independently testable
- **User Story 4 (P3) - Cross-Platform**: Can start after Foundational (Phase 2) - Uses US1/US3 but independently testable

### Within Each User Story

- Models before services (shared data structures)
- Services before controllers (business logic before API)
- Controllers before routes (implementation before integration)
- Backend API before frontend components (data layer before UI)
- Components before pages (reusable UI before page assembly)
- Core implementation before navigation integration

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- Models within a story marked [P] can run in parallel (different entities)
- Components within a story marked [P] can run in parallel (different UI components)
- Different user stories can be worked on in parallel by different team members
- All Polish tasks marked [P] can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all models for User Story 1 together:
Task: "Create Game entity model in packages/backend/src/models/game.ts"
Task: "Create Platform entity model in packages/backend/src/models/platform.ts"

# Launch all frontend components for User Story 1 together:
Task: "Create add game form component in packages/frontend/components/add-game-form.tsx"
Task: "Create platform selector component in packages/frontend/components/platform-selector.tsx"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only - Both P1)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Add Game to Library)
4. Complete Phase 4: User Story 2 (Launch Game Session)
5. **STOP and VALIDATE**: Test that users can add games and launch them
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (Basic game management)
3. Add User Story 2 → Test independently → Deploy/Demo (MVP with game launching!)
4. Add User Story 3 → Test independently → Deploy/Demo (Full library management)
5. Add User Story 4 → Test independently → Deploy/Demo (Advanced cross-platform features)
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Add games)
   - Developer B: User Story 2 (Launch games) 
   - Developer C: User Story 3 (Browse/organize)
   - Developer D: User Story 4 (Cross-platform)
3. Stories complete and integrate independently

---

## Success Criteria Mapping

Each user story maps to specific success criteria from spec.md:

- **User Story 1**: SC-001 (5min game addition), SC-005 (90% metadata retrieval), SC-010 (large library handling)
- **User Story 2**: SC-002 (30s launch time), SC-004 (30fps streaming), SC-007 (clean container lifecycle)
- **User Story 3**: SC-003 (1000+ game performance), SC-008 (browser responsiveness)
- **User Story 4**: SC-012 (multi-platform management from functional requirements)

---

## Notes

- [P] tasks = different files, no dependencies, can run in parallel
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- JSON storage architecture eliminates database setup complexity
- Docker container management is core to game execution functionality
- Games on Whales/Wolf integration provides desktop streaming capability
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All file paths use the monorepo structure from plan.md