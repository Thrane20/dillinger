# dillinger Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-10-26

## Active Technologies
- TypeScript 5.x with Node.js 18+ + Express.js, Next.js 14+, TailwindCSS, pnpm workspaces (001-game-library-manager)
- JSON files with GUID linking in Docker volume (human-readable) (001-game-library-manager)
- Docker multi-stage builds, Bash scripting, C++ (for Wolf components), Ubuntu 25.04 base + Wine/Proton, GStreamer 1.26.2, Wayland/X11, PulseAudio, Mesa/Vulkan drivers (002-dillinger-runner-streaming)
- Docker volume `dillinger_library` (shared with main Dillinger app), container-local game state (002-dillinger-runner-streaming)
- Docker multi-stage builds, Bash scripting, C++ (for Wolf components), Ubuntu 25.04 base, TypeScript 5.x with Node.js 18+ + Wine/Proton, GStreamer 1.26.2, Wayland/X11, PulseAudio, Mesa/Vulkan drivers, Express.js, Next.js 14+ (002-dillinger-runner-streaming)
- Docker volume `dillinger_library` (shared), container-local game state, JSON files with GUID linking (002-dillinger-runner-streaming)

- TypeScript 5.x with Node.js 18+ + Express.js, Next.js 14+, TailwindCSS, TypeORM, pnpm workspaces (001-game-library-manager)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.x with Node.js 18+: Follow standard conventions

## Recent Changes
- 002-dillinger-runner-streaming: Added Docker multi-stage builds, Bash scripting, C++ (for Wolf components), Ubuntu 25.04 base, TypeScript 5.x with Node.js 18+ + Wine/Proton, GStreamer 1.26.2, Wayland/X11, PulseAudio, Mesa/Vulkan drivers, Express.js, Next.js 14+
- 002-dillinger-runner-streaming: Added Docker multi-stage builds, Bash scripting, C++ (for Wolf components), Ubuntu 25.04 base + Wine/Proton, GStreamer 1.26.2, Wayland/X11, PulseAudio, Mesa/Vulkan drivers
- 001-game-library-manager: Added TypeScript 5.x with Node.js 18+ + Express.js, Next.js 14+, TailwindCSS, pnpm workspaces


<!-- MANUAL ADDITIONS START -->
- Streaming sidecar: Wolf built from source, no legacy compositor stack, no config.toml in Dillinger mode. REST API on port 9999.
- UI work must follow the Stitch plans in `docs/stitch/`. Start with `docs/stitch/DESIGN.md` as the routing guide, then use the matching surface reference: dashboard -> `stitch_retro_workbench_launcher(1)/`, library -> `stitch_retro_workbench_launcher/`, settings -> `stitch_retro_workbench_launcher(2)/`, game detail -> `stitch_retro_workbench_launcher(3)/`.
- Treat Stitch exports as visual references only. Preserve existing routes, data fetching, state, APIs, and component patterns; translate the designs into the app's existing React and Tailwind implementation.
- Preserve the shared Retro-Modern Workbench system for UI changes: dark CRT workbench shell, zero-radius panels, 2px borders, 32px window title bars, electric blue active states, cyber green ok/launch states, neon orange highlight/warning states, dense utility-first layouts, and no soft marketing-card styling.
<!-- MANUAL ADDITIONS END -->
