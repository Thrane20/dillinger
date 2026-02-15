# Volume Manager — Task List

> Based on [plan-volumeManager.md](plan-volumeManager.md)  
> Refer to [/AGENTS.md](/AGENTS.md) for project structure, conventions, and common commands.

---

## Phase 1: Define First-Class Volume Conventions

- [ ] **1.1** Add `FirstClassVolume` type and `FIRST_CLASS_VOLUMES` constant to [packages/shared/src/types/volume.ts](../../packages/shared/src/types/volume.ts)
  - Define four categories: `core`, `roms`, `cache`, `installed`
  - Each entry: Docker volume name (or pattern), expected mount path, icon, description
  - Export `parseFirstClassVolume(volumeName: string)` helper → returns `{ category, suffix? } | null`

- [ ] **1.2** Create [packages/dillinger-core/lib/services/volume-manager.ts](../../packages/dillinger-core/lib/services/volume-manager.ts)
  - Implement `detectFirstClassVolumes()` — reads `/proc/mounts`, matches `dillinger_*` naming convention
  - Return status per category: detected/missing, mount path, Docker volume name, storage type
  - Flag warnings for missing first-class volumes

- [ ] **1.3** Run `pnpm run build:shared` to verify shared types compile

---

## Phase 2: Update Volume Metadata System

- [ ] **2.1** Simplify [packages/dillinger-core/lib/services/volume-defaults.ts](../../packages/dillinger-core/lib/services/volume-defaults.ts)
  - Remove `defaults` map (installers/downloads/installed/roms)
  - Keep `volumeMetadata` (storage type per volume)
  - Rename to `volume-metadata-service.ts` or fold into `volume-manager.ts`
  - Update all imports across the codebase

- [ ] **2.2** Update [packages/dillinger-core/app/api/volumes/metadata/route.ts](../../packages/dillinger-core/app/api/volumes/metadata/route.ts)
  - Remove `defaults` field from `VolumeMetadataStore`
  - Remove `setAsDefault` / `clearDefault` logic from PUT handler
  - PUT accepts only `storageType` and `friendlyName`

- [ ] **2.3** Deprecate [packages/dillinger-core/app/api/volumes/defaults/route.ts](../../packages/dillinger-core/app/api/volumes/defaults/route.ts)
  - Either remove entirely or make it return computed values from `detectFirstClassVolumes()`

- [ ] **2.4** Update [packages/dillinger-core/app/api/volumes/detected/route.ts](../../packages/dillinger-core/app/api/volumes/detected/route.ts)
  - Add `firstClassCategory` field to `DetectedVolume` (`'core' | 'roms' | 'cache' | 'installed' | null`)
  - Remove `isDefaultFor` field
  - Add `firstClassStatus` to response — object showing which categories are present/missing

- [ ] **2.5** Verify: `pnpm build` passes with metadata changes

---

## Phase 3: Settings → Volumes Section

- [ ] **3.1** Add `{ id: 'volumes', label: 'Volumes', icon: '💾' }` to `SETTINGS_SECTIONS` in [packages/dillinger-core/app/settings/page.tsx](../../packages/dillinger-core/app/settings/page.tsx) (near top of array, line ~37)

- [ ] **3.2** Build `<VolumesSettings />` component (either inline in settings page or extracted to [packages/dillinger-core/app/components/VolumesSettings.tsx](../../packages/dillinger-core/app/components/VolumesSettings.tsx))
  - First-Class status panel: table/card for `core`, `roms`, `cache`, `installed_*` with green/red/yellow indicators
  - For `installed_*`: show all detected `dillinger_installed_*` as expandable rows
  - Per-volume click → edit `storageType` + friendly name (reuse `VolumeSettingsModal`)
  - Help text with `-v` Docker flag instructions

- [ ] **3.3** Update [packages/dillinger-core/app/components/VolumeSettingsModal.tsx](../../packages/dillinger-core/app/components/VolumeSettingsModal.tsx)
  - Remove "Default Assignments" section (lines ~176-222)
  - Remove `selectedDefaults`, `DEFAULT_LABELS` state
  - Keep "Storage Type" section (lines ~150-175)
  - Keep "Display Name" section
  - Update save handler — stop sending `setAsDefault` / `clearDefault`

- [ ] **3.4** Visual QA: navigate to Settings → Volumes, confirm layout renders correctly

---

## Phase 4: Move Sidebar Components

- [ ] **4.1** Remove volume manager from [packages/dillinger-core/app/components/LeftSidebar.tsx](../../packages/dillinger-core/app/components/LeftSidebar.tsx)
  - Delete "Storage Volumes" section (lines ~94-168)
  - Delete `VolumeSettingsModal` import and usage
  - Delete "Add Storage Volume" dialog
  - Keep Filters / Collections placeholders (or clear for System Info)

- [ ] **4.2** Extract `<SystemInfo />` component from [packages/dillinger-core/app/components/RightSidebar.tsx](../../packages/dillinger-core/app/components/RightSidebar.tsx) (lines ~83-193)
  - Includes: health fetch, version, storage, uptime, library stats grid, environment passthrough indicators
  - Place at [packages/dillinger-core/app/components/SystemInfo.tsx](../../packages/dillinger-core/app/components/SystemInfo.tsx)

- [ ] **4.3** Add `<SystemInfo />` to `LeftSidebar.tsx` (top of sidebar)

- [ ] **4.4** Remove the System Information section from `RightSidebar.tsx` (right sidebar retains `DownloadMonitor` + `LogPanel`)

- [ ] **4.5** Adjust column widths in [packages/dillinger-core/app/layout.tsx](../../packages/dillinger-core/app/layout.tsx) (lines ~89-101) if needed for new sidebar content balance

- [ ] **4.6** Visual QA: main page — System Info on left, Downloads + Logs on right

---

## Phase 5: FileExplorer — dillinger_* Volumes Only

- [ ] **5.1** Update volume loading in [packages/dillinger-core/app/components/FileExplorer.tsx](../../packages/dillinger-core/app/components/FileExplorer.tsx) (lines ~66-84)
  - Fetch from `GET /api/volumes/detected` instead of `GET /api/volumes`
  - Filter to only volumes where Docker volume name starts with `dillinger_`
  - Map each to its mount path shortcut

- [ ] **5.2** Remove "Host Roots" section from FileExplorer sidebar — no `/` root visible

- [ ] **5.3** Update initial path defaults:
  - ROM selection → `/roms`
  - Installer selection → `/cache`
  - Install location (Wine prefix) → first detected `/installed/<suffix>`

- [ ] **5.4** QA: open FileExplorer from GameForm ROM picker — only dillinger volumes appear, no `/` root

---

## Phase 6: Docker Service — Simplify Volume Resolution

- [ ] **6.1** Simplify `resolveRomMount()` in [packages/dillinger-core/lib/services/docker-service.ts](../../packages/dillinger-core/lib/services/docker-service.ts) (~line 180)
  - If path starts with `/roms/` → return `{ bind: 'dillinger_roms:/roms:ro', containerPath: romPath }`
  - Keep fallback for non-`/roms` paths (backward compat)
  - Remove `getDefaultVolume('roms')` call

- [ ] **6.2** Update Wine prefix mount resolution (~lines 1463-1540)
  - When `installPath` starts with `/installed/` → extract suffix, mount `dillinger_installed_<suffix>:/installed/<suffix>:rw`
  - Set `WINEPREFIX` relative to `/installed/<suffix>/`

- [ ] **6.3** Update hardcoded binds array (~lines 1486-1487)
  - `dillinger_root:/data:rw` → `dillinger_core:/data:rw`
  - `dillinger_installers:/installers:rw` → `dillinger_cache:/cache:rw`
  - Auto-mount all detected `dillinger_installed_*` volumes

- [ ] **6.4** Verify `resolveHostPath()` (~line 3404) still works with populated `this.mounts` for `/roms`, `/cache`, `/installed/*`

- [ ] **6.5** QA: launch a VICE C64 game → container gets `dillinger_roms:/roms:ro` and correct `/roms/c64/RAIDONBB.D64` path

---

## Phase 7: GameForm Integration

- [ ] **7.1** Update `getRomsBrowsePath()` in [packages/dillinger-core/app/components/GameForm.tsx](../../packages/dillinger-core/app/components/GameForm.tsx) (~line 1001)
  - Replace volume-defaults lookup with hardcoded `/roms`
  - Remove `volumeDefaults` state + `GET /api/volumes/defaults` fetch if unused elsewhere

- [ ] **7.2** Update [packages/dillinger-core/app/components/InstallGameDialog.tsx](../../packages/dillinger-core/app/components/InstallGameDialog.tsx)
  - Installer browse default → `/cache`
  - Install location default → first `/installed/<suffix>` path
  - Auto-populate `installPath` as `/installed/<suffix>/<gameId>`

- [ ] **7.3** Verify saved `filePath` values remain container-relative paths (e.g., `/roms/c64/RAIDONBB.D64`, `/cache/installer.exe`)

---

## Phase 8: Production Scripts

- [ ] **8.1** Update [start-dillinger.sh](../../start-dillinger.sh)
  - Rename `VOLUME_NAME="dillinger_root"` → `"dillinger_core"`
  - Add `docker volume create dillinger_roms` and `docker volume create dillinger_cache`
  - Add mounts: `-v dillinger_roms:/roms:rw`, `-v dillinger_cache:/cache:rw`
  - Add `dillinger_installed_*` auto-discovery loop: `docker volume ls --filter name=dillinger_installed_ -q` → mount each at `/installed/<suffix>`
  - Document naming convention in script header comments

- [ ] **8.2** Update [docker/dillinger-core/Dockerfile](../../docker/dillinger-core/Dockerfile) and [docker/dillinger-core/entrypoint.sh](../../docker/dillinger-core/entrypoint.sh)
  - Create directories `/roms`, `/cache`, `/installed` with correct permissions
  - Keep `DILLINGER_ROOT=/data`

- [ ] **8.3** Update [.devcontainer/devcontainer.json](../../.devcontainer/devcontainer.json)
  - `dillinger_installers` → `dillinger_cache` at `/cache`
  - Add `dillinger_installed_dev` at `/installed/dev` for testing Wine installs
  - Optionally rename bind mount source for `dillinger_root` → `dillinger_core` (cosmetic)

---

## Phase 9: Cleanup & Codebase Sweep

- [ ] **9.1** Remove `volume-defaults.json` read/write logic from all consumers
  - Remove `getDefaultVolume()` calls in docker-service.ts
  - Remove `GET /api/volumes/defaults` fetches from frontend components

- [ ] **9.2** Simplify configured volumes storage (`/data/storage/volumes/` entities, `GET/POST /api/volumes`)
  - First-class volumes are detected, not configured
  - Keep `volume-metadata.json` for per-volume friendly name + storage type

- [ ] **9.3** Codebase-wide string replacement sweep:
  - `dillinger_root` → `dillinger_core` (all files)
  - `dillinger_installers` → `dillinger_cache` (all files)
  - `/installers` mount path → `/cache` (all files)

- [ ] **9.4** Update [AGENTS.md](../../AGENTS.md) Docker Volumes section:
  - Replace `dillinger_root` and `dillinger_library` entries with new first-class volumes
  - Document `dillinger_core`, `dillinger_roms`, `dillinger_cache`, `dillinger_installed_*`

- [ ] **9.5** Final: `pnpm lint && pnpm build` passes clean

---

## Verification Checklist

- [ ] Launch VICE C64 game with ROM at `/roms/c64/RAIDONBB.D64` → correct bind + path
- [ ] Launch Wine game at `/installed/fast/some-game/` → correct volume mount
- [ ] FileExplorer shows only `dillinger_*` volumes, no `/` root
- [ ] Settings → Volumes displays four categories with correct status indicators
- [ ] System Information renders in left sidebar
- [ ] Right sidebar retains DownloadMonitor + LogPanel only
- [ ] Production `start-dillinger.sh` creates/mounts all first-class volumes
- [ ] `pnpm lint && pnpm build` clean