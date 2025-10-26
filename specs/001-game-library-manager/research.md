# Research: Game Library Manager

**Feature**: 001-game-library-manager  
**Created**: 2025-10-26  
**Purpose**: Resolve technical unknowns and establish implementation approach

## Storage Architecture Decision

**Unknown**: How to store game library data without database dependencies?

**Decision**: JSON files with GUID linking in Docker volume

**Rationale**: 
- Human-readable data storage requirement explicitly stated by user
- No database platform installation or management overhead
- Docker volume provides persistence and backup simplicity
- GUID linking maintains referential integrity without complex schemas
- Flat directory structure with indexes optimizes performance for 1000+ games
- Aligns with containerization philosophy and simplicity-first principle

**Alternatives Considered**:
- SQLite: Rejected due to binary format (not human-readable)
- TypeORM with PostgreSQL: Rejected per user requirements (no DB platform)
- Document databases (MongoDB): Rejected due to platform installation requirements

**Implementation**: 
```text
/data/
├── games/
│   ├── uuid-1.json
│   ├── uuid-2.json  
│   └── index.json (search optimization)
├── platforms/
│   ├── linux-native.json
│   ├── wine-windows.json
│   └── index.json
├── sessions/
│   ├── active-session-uuid.json
│   └── index.json
└── collections/
    ├── user-collection-uuid.json
    └── index.json
```

## Display Streaming Technology

**Unknown**: How to stream game display from Docker containers to desktop?

**Decision**: Games on Whales/Wolf for streaming to desktop (X11/Wayland)

**Rationale**:
- Games on Whales provides proven game streaming over X11/Wayland
- Wolf offers high-performance streaming capabilities
- Desktop-native display eliminates browser performance bottlenecks
- Container isolation prevents game execution from affecting host
- Mature solution with broad game compatibility

**Alternatives Considered**:
- Browser-based VNC streaming: Rejected per requirement (desktop streaming only)
- Direct X11 forwarding: Security and isolation concerns
- Custom WebRTC solution: Overengineering for desktop streaming requirement

**Implementation**: 
- Docker Compose services with Games on Whales/Wolf containers
- X11 socket forwarding from host to game containers
- Desktop window management for game sessions
- Session lifecycle through container orchestration

## Game Metadata Sources

**Unknown**: Where to source game metadata, artwork, and platform information?

**Decision**: IGDB API as primary source with local cache and manual override

**Rationale**:
- Comprehensive database covering modern and retro games across all platforms
- Includes high-quality artwork, screenshots, and detailed metadata
- RESTful API with reasonable rate limits and free tier for hobby projects
- Active community and regular updates

**Implementation Strategy**:
- Cache all fetched metadata locally to minimize API calls and handle offline usage
- Implement graceful fallbacks for API unavailability
- Allow manual metadata editing for missing games or corrections
- Background metadata refresh for library consistency

**Alternatives Considered**:
- MobyGames: Good retro coverage but less friendly API access
- Multiple API aggregation: Complexity outweighs benefits for initial implementation
- Local-only metadata: Too much manual work, reduces user experience

## Container Orchestration Strategy

**Unknown**: How to manage dynamic game execution containers?

**Decision**: Simple Docker container spawning with individual game containers

**Rationale**:
- Simplicity-first principle - avoid complex Compose configurations for games
- Dynamic container lifecycle management per game session
- Resource efficiency - only active games consume resources
- Easier debugging and log management
- Single Docker image approach per user preference

**Game Container Strategy**:
- Single Docker image containing all emulators and runtimes
- Dynamic container spawning per game session with unique names
- Games on Whales/Wolf integration for display streaming
- Automatic cleanup of stopped containers to prevent resource leaks
- Direct docker commands instead of Compose for game execution

**Alternatives Considered**:
- Docker Compose for all games: Resource overhead and complexity
- Kubernetes: Massive overengineering for hobby project
- Multi-image strategy: Rejected per user preference for single image

## Wine/Proton Integration

**Unknown**: How to run Windows games reliably in containerized environment?

**Decision**: Pre-built Wine containers with Proton compatibility database

**Rationale**:
- Avoids complex Wine compilation and dependency management
- Proton provides Steam-grade game compatibility with extensive testing
- Community-maintained lutris/wine Docker images with regular updates
- Consistent Windows environment across different host systems

**Implementation Approach**:
- Base Wine container with common Windows libraries and dependencies
- Per-game Wine prefixes for application isolation
- Proton compatibility database lookup for automatic configuration
- Graceful fallback to vanilla Wine for unsupported titles
- DXVK/VKD3D integration for DirectX compatibility

**Game-Specific Configuration**:
- Store Wine prefix configurations in database for repeat launches
- Allow manual Wine settings override for problematic games
- Automatic detection of Windows game requirements (DirectX version, etc.)

## Package Management and Validation Strategy

**Unknown**: How to structure the TypeScript monorepo without TypeORM/Zod?

**Decision**: pnpm workspaces with TypeScript interfaces and custom validators

**Rationale**:
- pnpm provides superior disk efficiency with symlinked node_modules
- TypeScript interfaces provide compile-time type safety
- Custom validation functions replace Zod dependency per user requirements
- Native workspace support for monorepo management
- Eliminates schema dependencies while maintaining type safety

**Workspace Structure**:
```
packages/
├── shared/           # TypeScript interfaces, validators, utilities  
├── backend/          # Express.js API server
└── frontend/         # Next.js web application
```

**Validation Strategy**:
- TypeScript interfaces for all data structures
- Custom validation functions for JSON file operations
- Runtime type checking without external schema libraries
- File system validation for game paths and metadata

**Implementation Pattern**:
```typescript
interface Game {
  id: string;
  title: string;
  filePath: string;
  platformId: string;
  metadata?: GameMetadata;
}

function validateGame(data: unknown): Game {
  if (typeof data !== 'object' || !data) throw new Error('Invalid game data');
  // Custom validation logic
  return data as Game;
}
```

## Emulator Integration Strategy

**Unknown**: How to support multiple retro gaming platforms?

**Decision**: RetroArch as primary emulator with platform-specific containers

**Rationale**:
- RetroArch provides unified interface for multiple emulator cores
- Extensive platform support (NES, SNES, Genesis, PlayStation, etc.)
- Consistent configuration and input handling across platforms
- Active development and community support
- Docker containers available for most popular cores

**Platform Support Priority**:
1. **Phase 1**: Nintendo (NES, SNES, Game Boy)
2. **Phase 2**: Sega (Genesis/Mega Drive, Game Gear)
3. **Phase 3**: Sony (PlayStation 1, PSP)
4. **Phase 4**: Additional platforms based on user demand

**Implementation**:
- Separate Docker containers for each emulator core
- Automatic ROM format detection and platform matching
- RetroArch configuration management through backend API
- Save state and configuration persistence across sessions

## Development Workflow and Tooling

**Decision**: Feature-branch development with automated quality gates

**Tooling Stack**:
- **Linting**: ESLint with TypeScript rules, Prettier for formatting
- **Testing**: Jest for unit tests, Supertest for API integration, Playwright for E2E
- **Type Checking**: TypeScript strict mode across all packages
- **Git Hooks**: Husky for pre-commit linting and type checking
- **CI/CD**: GitHub Actions for automated testing and Docker image building

**Development Environment**:
- Docker Compose for consistent development setup
- Hot reloading for both frontend and backend development
- Shared ESLint and Prettier configurations across packages
- VS Code workspace configuration with recommended extensions

**Quality Gates**:
- All commits must pass TypeScript compilation
- Unit test coverage minimum 80% for business logic
- E2E tests for critical user flows (add game, launch game)
- API contract validation using OpenAPI schema

## Security and Isolation Considerations

**Container Security**:
- No privileged containers for game execution
- Read-only root filesystems where possible
- Restricted network access for game containers
- Automatic container cleanup after sessions end
- Resource limits to prevent DoS attacks

**API Security**:
- Input validation using Zod schemas on all endpoints
- File path sanitization to prevent directory traversal
- Rate limiting for metadata API calls and game launches
- CORS configuration for frontend-only access

**File System Security**:
- Game library access restricted to mounted volumes only
- No write access to system directories from containers
- Sandboxed execution environments for all games
- Validation of game file permissions before launch

---

## Implementation Timeline

### Phase 1: Foundation (Week 1-2)
- Set up pnpm workspace with shared, backend, frontend packages
- Configure TypeScript build system and shared type definitions
- Implement basic Express.js server with TypeORM and SQLite
- Create Next.js frontend with TailwindCSS styling
- Set up Docker development environment with hot reloading

### Phase 2: Core API (Week 3-4)
- Implement Game entity CRUD operations with file validation
- Create Platform management system for execution environments
- Add Collection and tagging functionality for organization
- Implement search and filtering capabilities across metadata
- Add comprehensive input validation and error handling

### Phase 3: Frontend Implementation (Week 5-6)
- Build responsive game library grid with TailwindCSS
- Create detailed game views with metadata display and editing
- Implement collection management and organization interface
- Add search, filtering, and sorting capabilities
- Build game addition workflow with file selection and validation

### Phase 4: Game Execution (Week 7-9)
- Implement Docker container management for game sessions
- Set up X11VNC display streaming with noVNC web client
- Create native Linux game execution support
- Add Wine/Proton Windows game compatibility
- Implement session lifecycle management and cleanup

### Phase 5: Metadata Integration (Week 10)
- Integrate IGDB API for automatic game metadata retrieval
- Implement artwork download and local caching system
- Add manual metadata editing capabilities for missing games
- Create metadata validation and fallback systems

### Phase 6: Platform Extension (Week 11-12)
- Add RetroArch emulator integration for retro gaming
- Implement platform-specific emulator containers
- Create emulator configuration management system
- Add support for additional console platforms based on priority

**Total Estimated Timeline**: 12 weeks for full implementation

---

## Risk Mitigation

### Technical Risks
- **Container Performance**: Mitigate with resource monitoring and optimization
- **Display Latency**: Test early with target games, optimize VNC settings
- **Wine Compatibility**: Use Proton database, implement fallback mechanisms
- **Metadata API Limits**: Implement caching and graceful degradation

### Development Risks
- **Scope Creep**: Stick to defined user stories, defer nice-to-have features
- **Complex Architecture**: Start simple, add complexity incrementally
- **Testing Complexity**: Focus on critical paths, automate regression tests

### Deployment Risks
- **Docker Dependencies**: Document all requirements, provide setup scripts
- **File System Access**: Test with various game library configurations
- **Browser Compatibility**: Test across major browsers early and often