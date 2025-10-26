# Feature Specification: Game Library Manager

**Feature Branch**: `001-game-library-manager`  
**Created**: 2025-10-26  
**Status**: Draft  
**Input**: User description: "Dillinger is the overall name for a linux based server (running in docker), and a website that is used to manage games. it can run linux games, launch wine/proton based games etc. and run a whole suite of different retro emulators. each game can scrape data from the web, including box art etc. and the user can link to rom files and exes and installers to manage their library. dillinger is OS agnostic, and can see the game "Diablo" as running on PC, linux, or an Amiga. The engine of Dillinger is that the web view runs off the nodejs/typesript backend, the backend exposes APIs via express - and the backend can then link into the linux ecosystem via process calls. but remember, the backend is entirely contained in docker. no installs necessary. this will be further extended by other docker images that hold and run the various emulators etc. and gamescope etc. so that the end user doesn't have to download a thing. the game will run in docker, and present a X11 pipe or a wayland link."

## Clarifications

### Session 2025-10-26

- Q: JSON File Organization Structure → A: Directory-based structure with individual JSON files per entity (games/uuid.json)
- Q: Games on Whales/Wolf Integration Method → A: Docker Compose integration with Wolf/GoW containers as services
- Q: JSON Schema Validation Strategy → A: Runtime validation with TypeScript interfaces and custom validators
- Q: Docker Volume Structure for JSON Data → A: Flat entity directories with indexes (/data/games/, /data/platforms/ + index.json files)
- Q: Metadata Scraping Fallback Strategy → A: Manual entry with template

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Add Game to Library (Priority: P1)

User wants to add a game to their library by providing the path to a game file (ROM, executable, or installer) and have the system automatically identify the game and fetch metadata.

**Why this priority**: Core foundation - without the ability to add games, no other functionality is possible.

**Independent Test**: User can add a game file, see it appear in their library with basic metadata, even if other features aren't working.

**Acceptance Scenarios**:

1. **Given** user has a Linux game executable, **When** they provide the file path and select "Linux Native" platform, **Then** game appears in library with detected metadata
2. **Given** user has a Windows game executable, **When** they provide the file path and select "Windows (Wine)" platform, **Then** game is added and marked as Wine-compatible
3. **Given** user has a ROM file, **When** they provide the file path and select appropriate emulator platform, **Then** ROM is added with platform-specific metadata

---

### User Story 2 - Launch Game Session (Priority: P1)

User selects a game from their library and launches it, with the game running in a containerized environment and streaming the display back to their web browser.

**Why this priority**: Primary value delivery - users need to actually play games for the system to be useful.

**Independent Test**: User can click a game in their library and have it launch in a new browser window/tab showing the running game.

**Acceptance Scenarios**:

1. **Given** user has a Linux game in their library, **When** they click "Launch", **Then** game starts in a container and streams display to desktop
2. **Given** user has a Windows game via Wine, **When** they click "Launch", **Then** Wine environment starts and game launches with display streaming
3. **Given** user has a retro console ROM, **When** they click "Launch", **Then** appropriate emulator starts with the ROM loaded

---

### User Story 3 - Browse and Organize Library (Priority: P2)

User wants to view their game collection in an organized way, with rich metadata, artwork, and the ability to search, filter, and categorize games.

**Why this priority**: Enhances usability once basic functionality works - helps users manage larger libraries.

**Independent Test**: User can browse a library of multiple games, see artwork and metadata, and find specific games using search/filters.

**Acceptance Scenarios**:

1. **Given** user has multiple games in their library, **When** they view the library page, **Then** games display in a grid with cover art and basic info
2. **Given** user wants to find a specific game, **When** they type in the search box, **Then** library filters to matching games in real-time
3. **Given** user wants to organize games, **When** they create collections and add games to them, **Then** games can be viewed by collection

---

### User Story 4 - Cross-Platform Game Management (Priority: P3)

User can manage the same game title across multiple platforms (e.g., Diablo on PC, Linux, and Amiga) and see them as related but distinct entries.

**Why this priority**: Advanced feature that provides unique value but isn't essential for core functionality.

**Independent Test**: User can add multiple versions of the same game and see them grouped or tagged as related.

**Acceptance Scenarios**:

1. **Given** user has Diablo for PC and Amiga, **When** they add both versions, **Then** system recognizes them as the same game on different platforms
2. **Given** user views game details, **When** multiple platform versions exist, **Then** user can see and switch between platform variants
3. **Given** user searches for "Diablo", **When** multiple platform versions exist, **Then** search shows all variants with platform indicators

---

### Edge Cases

- What happens when game file is missing or corrupted?
- How does system handle unsupported file formats?
- What if metadata scraping fails or returns no results?
- How does system handle container startup failures?
- What happens when display streaming connection is lost?
- How does system manage multiple concurrent game sessions?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to add games by providing file paths to executables, ROMs, or installers
- **FR-002**: System MUST automatically detect game platform based on file type and user selection
- **FR-003**: System MUST scrape game metadata including title, description, genre, developer, and artwork from web sources
- **FR-004**: System MUST launch games in isolated Docker containers using Docker Compose orchestration with Games on Whales or Wolf containers as managed services
- **FR-005**: System MUST stream game display to the linux desktop over X11 or wayland - using Games on Whales/Wolf
- **FR-006**: System MUST support native Linux game execution
- **FR-007**: System MUST support Windows game execution via Wine/Proton compatibility layer
- **FR-008**: System MUST support retro console emulation for various platforms
- **FR-009**: System MUST provide web-based game library management interface
- **FR-010**: System MUST allow users to organize games into collections and apply tags
- **FR-011**: System MUST provide search and filtering capabilities across game metadata
- **FR-012**: System MUST manage multiple platform versions of the same game title
- **FR-013**: System MUST handle game session lifecycle (start, monitor, stop, cleanup)
- **FR-014**: System MUST persist game library and metadata in flat entity directories with indexes (/data/games/uuid.json, /data/platforms/uuid.json, /data/sessions/uuid.json, /data/collections/uuid.json + index.json files) linked by GUIDs under Docker volume for human readability and performance
- **FR-015**: System MUST validate file paths and handle missing or inaccessible files gracefully using runtime validation with TypeScript interfaces and custom validators for JSON data integrity, with manual entry template fallback when automatic metadata scraping fails

### Key Entities *(include if feature involves data)*

- **Game**: Represents individual games with metadata, file paths, platform association, and user data
- **Platform**: Defines execution environments (Linux Native, Wine, Emulators) with container configurations
- **Game Session**: Tracks active game instances with container IDs, display ports, and session state
- **Collection**: User-defined groupings of games for organization and categorization
- **Metadata**: External game information including artwork, descriptions, and platform-specific data

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can add a game to their library and have it appear with metadata within 5 minutes
- **SC-002**: Games launch from library to playable state within 30 seconds
- **SC-003**: System maintains responsive performance with libraries containing 1000+ games
- **SC-004**: Game display streaming provides playable performance with 30+ FPS and minimal input lag
- **SC-005**: 90% of added games successfully retrieve metadata and artwork automatically
- **SC-006**: System supports concurrent game sessions for multiple users without performance degradation
- **SC-007**: Container-based game execution starts and stops cleanly without resource leaks
- **SC-008**: Web interface remains responsive and functional across major browsers (Chrome, Firefox, Safari)
- **SC-009**: System recovers gracefully from container failures and network interruptions
- **SC-010**: File system integration handles large game libraries (10GB+ total) without blocking operations
