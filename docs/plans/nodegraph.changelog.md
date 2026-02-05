# Node Graph Implementation Changelog

## 2026-02-05
- Initialized changelog.
- Added streaming graph shared types and default store.
- Added streaming graph storage service and API endpoint.
- Added streaming graph path to streaming settings and API validation.
- Added streaming graph JSON schema definition.
- Added preset CRUD API routes.
- Added graph validation service with device checks and validation API.
- Added per-game streaming graph preset selection field.
- Added streaming graph presets and validation status UI in settings.
- Added per-game streaming graph preset selection UI.
- Wired streaming graph preset selection into runner launch environment.
- Blocked streaming launch when graph validation is blocking.
- Surfaced streaming graph validation errors on launch failures.
- Added CTA from launch error to streaming settings.
- Scaffolded streaming graph editor modal with preset CRUD and JSON editor.
- Added canvas/JSON tabs with React Flow canvas, node selection, and attributes dialog.
- Restructured graph editor layout, inline attribute editor with auto-persist, and right-click add-node modal.
- Added collapsible node docs panel and constrained attribute editor width.
- Added default node inputs/outputs and sensible attribute defaults; rendered labeled handle anchors.
- Added editor-side node defaults to backfill ports/attributes and made handles visibly clickable.
- Added connection validation to enforce compatible port media types.
- Updated default Moonlight preset to a minimal launch→runner→compositor→encoders→sunshine flow.
- Added node deletion via right-click with guard for required nodes.
- Added reset action to restore default streaming graph presets (moved into editor).
- Disabled editor/canvas when no preset is selected to avoid confusion.
