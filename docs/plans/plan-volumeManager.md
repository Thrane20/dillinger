Plan: First-Class Docker Volume Manager
TL;DR
Replace the current ad-hoc volume detection system with a convention-based "first-class volumes" model. Four volume categories are recognized by naming convention: dillinger_core (app data at data), dillinger_roms (ROMs at roms), dillinger_cache (replaces dillinger_installers, at /cache), and dillinger_installed_* (Wine prefixes at /installed/<suffix>/). The volume manager moves from the left sidebar to Settings → Volumes; the System Information panel moves from the right sidebar to the left. FileExplorer only shows dillinger_* volumes. Default assignment tagging is removed; storage type tagging is retained.

Steps

Phase 1: Define First-Class Volume Conventions
Add a new shared type FirstClassVolume in volume.ts defining the four categories:

core → Docker volume dillinger_core, container mount data, purpose: app configs/saves/sessions
roms → Docker volume dillinger_roms, container mount roms, purpose: ROM storage root
cache → Docker volume dillinger_cache, container mount /cache, purpose: installers, downloads, temp files
installed → Docker volumes matching dillinger_installed_*, container mounts /installed/<suffix>/, purpose: Wine game prefixes
Export a FIRST_CLASS_VOLUMES constant with name patterns, expected mount paths, and display metadata (icon, description). Also export a helper parseFirstClassVolume(volumeName: string) that returns the category + suffix (if wildcard) or null for non-dillinger volumes.

Add a utility function detectFirstClassVolumes() in a new service packages/dillinger-core/lib/services/volume-manager.ts that:

Reads mounts (or queries this.mounts from Docker inspect)
Identifies all dillinger_* mounts by matching the naming convention
Returns status for each: detected/missing, mount path, Docker volume name, storage type from metadata
Flags warnings for missing first-class volumes (e.g., dillinger_roms not mounted)
Phase 2: Update Volume Metadata System
Simplify volume-defaults.ts: Remove the defaults map (installers/downloads/installed/roms) since purpose is now determined by naming convention, not tagging. Keep volumeMetadata (storage type). Rename the file to volume-metadata-service.ts or fold into the new volume-manager.ts.

Update route.ts: Remove the defaults field from VolumeMetadataStore. The PUT endpoint should only accept storageType and friendlyName changes; remove setAsDefault/clearDefault logic.

Update or deprecate route.ts: This entire endpoint becomes unnecessary since defaults are convention-based. Either remove it or make it return computed values from first-class volume detection.

Update /api/volumes/detected in route.ts: Add a firstClassCategory field to each DetectedVolume (e.g., 'core', 'roms', 'cache', 'installed', or null for non-dillinger volumes). Remove isDefaultFor field. Add a new top-level response field firstClassStatus showing which are present/missing.

Phase 3: New Settings → Volumes Page Section
Add { id: 'volumes', label: 'Volumes', icon: '💾' } to the SETTINGS_SECTIONS array in page.tsx:37 — insert it near the top (after IGDB or as first item since it's infrastructure-level).

Build the Volumes settings section in that same file (or extract as a <VolumesSettings /> component imported into it). The UI should have:

First-Class Volumes status panel: A table/card layout showing each expected volume category (core, roms, cache, installed_*), its expected Docker volume name, expected mount path, and detected status (green check / red X / yellow warning). For installed_*, show all detected dillinger_installed_* volumes as expandable rows.
Per-volume settings: Clicking a detected volume opens an inline editor (or retains VolumeSettingsModal) for setting storageType (SSD/HDD/Archive) and friendly name. No default assignment toggles.
Help text: Instructions for adding missing volumes (the -v Docker flag pattern, referencing start-dillinger.sh).
Update VolumeSettingsModal.tsx: Remove the "Default Assignments" section (lines ~176-222) and related state (selectedDefaults, DEFAULT_LABELS). Keep the "Storage Type" section (lines ~150-175) and "Display Name" section. Update the save handler to stop sending setAsDefault/clearDefault.

Phase 4: Move Sidebar Components
Remove the volume manager from LeftSidebar.tsx: Delete the "Storage Volumes" section (lines ~94-168), the VolumeSettingsModal usage, and the "Add Storage Volume" dialog. Keep the Filters and Collections placeholders if desired, or leave the sidebar for the System Information panel.

Move the System Information section from RightSidebar.tsx:83-193 into the LeftSidebar. Extract it as a <SystemInfo /> component (or keep inline). This includes the health fetch, version display, library stats grid, and environment passthrough status indicators.

Update layout.tsx:89-101: Adjust column widths if needed now that the left sidebar has different content. The right sidebar keeps DownloadMonitor and LogPanel.

Phase 5: FileExplorer — Only Show dillinger_* Volumes
Update FileExplorer.tsx:66-84 volume loading: Instead of fetching from GET /api/volumes (configured volumes), fetch from GET /api/volumes/detected and filter to only show volumes whose Docker volume name starts with dillinger_ (i.e., only first-class volumes). Map each to its mount path shortcut.

Remove the "Host Roots" section from FileExplorer's sidebar — no more showing / as a browsable root. Only first-class dillinger_* volumes appear as sidebar shortcuts.

Update the initial path logic: When opening FileExplorer for ROM selection, default to roms. For installer selection, default to /cache. For install location (Wine prefix target), default to the first detected /installed/<suffix> path (or /installed if only one exists).

Phase 6: Docker Service — Simplify Volume Resolution
Simplify resolveRomMount() in docker-service.ts:180: Since ROM paths always start with roms, and we know the Docker volume is dillinger_roms, the entire method can be simplified to:

Assert path starts with roms
Return { bind: 'dillinger_roms:/roms:ro', containerPath: romPath } — the path IS the container path already
Keep a fallback for non-roms paths (backward compat) using getVolumeMountForPath
Update Wine prefix mount resolution (lines ~1463-1540 in docker-service.ts): When installation.installPath starts with /installed/, look up the matching dillinger_installed_* volume and mount the whole volume at /installed/<suffix>. Adjust WINEPREFIX accordingly.

Update the hardcoded binds array (line ~1486-1487): Replace dillinger_root:/data:rw and dillinger_installers:/installers:rw with dillinger_core:/data:rw and dillinger_cache:/cache:rw. Mount all detected dillinger_installed_* volumes at their respective /installed/<suffix> paths.

Update resolveHostPath() in docker-service.ts:3404: Since this.mounts is now reliably populated (from the container ID fix), paths under roms, /cache, /installed/* resolve correctly through the existing mountinfo logic. No major changes needed, just verify.

Phase 7: GameForm Integration
Update getRomsBrowsePath() in GameForm.tsx:1001-1010: Replace the volume-defaults lookup with a hardcoded return of roms. Remove the volumeDefaults state fetch from GET /api/volumes/defaults if no longer used elsewhere in the form.

Update installer path handling in InstallGameDialog.tsx: Change the default installer browse path from the installers volume default to /cache. Change the default install location from the installed volume default to the first detected /installed/<suffix> path.

Ensure all saved filePath values remain as container-relative paths (RAIDONBB.D64, /cache/installer.exe, /installed/fast/game-slug/drive_c/...). No regression from the current fix.

Phase 8: Production Scripts
Update start-dillinger.sh:

Rename VOLUME_NAME="dillinger_root" to VOLUME_NAME="dillinger_core"
Add docker volume create dillinger_roms and docker volume create dillinger_cache
Add mounts: -v dillinger_roms:/roms:rw, -v dillinger_cache:/cache:rw
Add optional dillinger_installed_* auto-discovery: list Docker volumes matching the prefix and mount each at /installed/<suffix>
Document the naming convention in the script header
Update Dockerfile and entrypoint.sh: Ensure directories roms, /cache, /installed exist and have correct permissions. Keep DILLINGER_ROOT=/data.

Update .devcontainer/devcontainer.json: Rename dillinger_installers → dillinger_cache at /cache. Rename the bind mount source comment for clarity. Add a dillinger_installed_dev volume at /installed/dev for testing Wine installs.

Phase 9: Cleanup
Remove volume-defaults.json read/write logic from all consumers. The getDefaultVolume('roms') calls in docker-service.ts are no longer needed — the convention IS the default.

Remove or simplify the configured volumes JSON storage system (volumes entities, GET/POST /api/volumes). First-class volumes are detected, not configured. If we still need per-volume metadata (friendly name, storage type), keep volume-metadata.json only.

Update any remaining references: search for dillinger_root (→ dillinger_core), dillinger_installers (→ dillinger_cache), installers (→ /cache) across all files.

Verification

Launch a VICE C64 game with ROM at RAIDONBB.D64 — container should receive dillinger_roms:/roms:ro bind and command path RAIDONBB.D64
Launch a Wine game installed at /installed/fast/some-game/ — container should receive dillinger_installed_fast:/installed/fast:rw
Open FileExplorer for ROM selection — only dillinger_roms, dillinger_cache, dillinger_installed_* appear in the sidebar; no / root
Settings → Volumes shows all four categories with green/red status
System Information renders in the left sidebar; right sidebar retains downloads + logs
pnpm lint and pnpm build pass
Production: start-dillinger.sh creates and mounts all first-class volumes
Decisions

Keep DILLINGER_ROOT=/data internally — no breaking path changes, only volume naming convention changes
dillinger_installed_* uses wildcard detection, each mounted at /installed/<suffix>/ — gives flexibility for multiple drives (SSD vs archive)
dillinger_cache replaces dillinger_installers — single cache volume for all temp/download artifacts
Volumes settings added as a scroll-to section in existing settings page (consistent with current pattern)
Default assignment tagging removed entirely — convention over configuration