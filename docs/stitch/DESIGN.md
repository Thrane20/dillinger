# Dillinger Stitch Design Guide

This directory contains Stitch exports for Dillinger's primary UI surfaces. Use this file as the routing guide before applying a Stitch design to the Next.js app.

The exports are visual references, not implementation source. Preserve the app's existing routing, data fetching, state, and API behavior; translate the visual language into the app's existing React, Tailwind, and component patterns.

## Source Map

| App Surface | Stitch Reference | Use For |
| --- | --- | --- |
| Dashboard | `stitch_retro_workbench_launcher(1)/` | Home/dashboard layouts, status widgets, recently played, discovery modules, console/status side panels, quick actions. |
| Library / Platform Library | `stitch_retro_workbench_launcher/` | Main library browsing, platform-scoped game grids, filtering, sorting, platform sidebar state, game cards, hover actions. |
| Settings | `stitch_retro_workbench_launcher(2)/` | Preferences, emulator/runner settings, graphics/audio/input tabs, toggles, sliders, select controls, logs, hardware-style configuration panels. |
| Game Detail | `stitch_retro_workbench_launcher(3)/` | Individual game pages, launch/mount panels, metadata, controls map, requirements, ratings, related games/modules. |

Each reference folder contains:

- `screen.png` - primary visual reference.
- `DESIGN.md` - Stitch-generated design tokens and style rationale.
- `code.html` - exported HTML structure and class hints.

## Shared Visual System

All views share the same "Retro-Modern Workbench" design system:

- Dark CRT workbench foundation with dense, utility-first layouts.
- Sharp zero-radius panels, heavy 2px borders, no soft card styling.
- Window metaphor: every major section behaves like a desktop window with a 32px title bar.
- Electric blue for active windows, primary text, selected navigation, and key borders.
- Cyber green for system-ok states, launch/readiness actions, terminal output, and selection bars.
- Neon orange for warnings, discoveries, section emphasis, and secondary highlights.
- Monospace body/data text with expressive heavy display headings.
- Subtle scanline overlay and restrained phosphor glow for active or focused states.

## Global Layout Rules

Use a fixed workbench shell for desktop views:

- 48px top bar for brand, primary navigation, search/command input, and system icons.
- 200px left sidebar for platform navigation and secondary system links.
- Main content starts after the sidebar and top bar.
- Content is arranged as snapped windows on a grid with 16px gutters.
- Use multiples of 4px for spacing.
- On mobile, collapse navigation into a bottom dock and stack windows vertically.

Do not introduce rounded marketing cards, soft shadows, pastel surfaces, or decorative gradients. Depth comes from borders, title bars, active-window glow, and contrast.

## View Guidance

### Dashboard

Reference: `stitch_retro_workbench_launcher(1)/`

Use this for overview screens. The dashboard should feel like a live system monitor rather than a marketing home page.

Core motifs:

- Full-width `SYSTEM_STATUS.GADGET` window at the top.
- Bento-style window grid below.
- Recently played game strip with compact cover tiles.
- Discovery/news modules with orange headers.
- Right-side console/status log and quick action gadgets.
- Progress bars, terminal logs, and small command buttons.

### Library / Platform Library

Reference: `stitch_retro_workbench_launcher/`

Use this for game browsing and platform-specific library pages. This is the canonical reference for high-density game grids.

Core motifs:

- Active platform highlighted in the left sidebar.
- Filter window above the grid with sort, year range, genre/class filters, and cache refresh.
- Active library window titled like a mounted volume, e.g. `VOLUME: AMIGA_TITLES`.
- Game cards use tall cover art, title, year, publisher, and hover overlay actions.
- Keep the grid dense and mechanical; avoid oversized card chrome.

If a general all-platform library is needed, use this reference but make platform selection broader: an "All Platforms" sidebar state, platform chips, or a platform column/badge on each game card.

### Settings

Reference: `stitch_retro_workbench_launcher(2)/`

Use this for settings, preferences, runner configuration, emulator options, streaming settings, and system diagnostics.

Core motifs:

- Main `SYSTEM PREFERENCES` window with tab strip.
- Group controls into hardware-like sections: graphics, audio, input, emulation.
- Use switches, sliders, segmented meters, and select controls with recessed dark fields.
- Reserve green for active/enabled/saved states.
- Use a console log window for low-level status feedback.
- Secondary action panels may sit beside or below the main preferences window.

### Game Detail

Reference: `stitch_retro_workbench_launcher(3)/`

Use this for individual game pages and launch flows.

Core motifs:

- Breadcrumb path across the top of the content area.
- Primary active window titled like an execution context, e.g. `EXECUTING: GAME_TITLE`.
- Large media/screenshot region on the left.
- Launch/mount panel, control map, requirements, and rating stacked on the right.
- Operational overview section below media with description and metadata.
- Related games/modules appear as lower library cards.
- Footer status should communicate connection/session/resource state.

## Implementation Notes

When applying these designs to the app:

- Prefer existing application components and data contracts.
- Extract reusable shell pieces: top bar, sidebar, window frame, window title bar, console log, game card, status meter.
- Use real app labels where possible, but keep the terminal/workbench tone for short UI labels.
- Keep accessibility intact: visible focus states, semantic controls, readable contrast, and sensible tab order.
- Use image assets from app data where available; Stitch image URLs are visual placeholders only.
- Treat `code.html` as structure guidance, not production-ready code.

