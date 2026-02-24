# Tasks: Wine Game UX & MakeItRun Overhaul

Tracks implementation progress for [plan-installerUpgrades.md](plan-installerUpgrades.md).

---

## Phase 1: Game State Machine & Status Banner

### 1.1 — Define canonical game states
- [x] Add `WineGamePhase` type to `packages/shared/src/types/game.ts`
- [x] Create `deriveWinePhase(game, platformConfig)` utility in `packages/shared/src/utils/`
- [x] Export `deriveWinePhase` from shared package barrel
- [x] Unit tests for `deriveWinePhase` — all phase transitions (`needs_install`, `installing`, `install_failed`, `post_install`, `needs_configuration`, `ready`, `running`)

### 1.2 — Status banner component
- [x] Create `WineStatusBanner.tsx` in `packages/dillinger-core/app/components/`
- [x] Implement color-coded banner for each `WineGamePhase`
- [x] Add explainer text below each state message
- [x] Add Launch button on `ready` phase
- [x] Add session link on `running` phase
- [x] Add link to monitor on `installing` phase
- [x] Wire `WineStatusBanner` into `GameForm.tsx` (render above sidebar + content for Wine games)

### 1.3 — Sidebar section locking
- [x] Update `WINE_SECTIONS` array in `GameForm.tsx` with new order (Basic Info → Installation → Rendering → MakeItRun Config → Performance → Game Information)
- [x] Add `disabled` property to each section, computed from `WineGamePhase`
- [x] Render locked sections with `opacity-40 pointer-events-none` and 🔒 icon
- [x] Add tooltip on locked sections: "Install the game first to access these settings."
- [x] Change Installation label to "✅ Installed" when `status === 'installed'`

---

## Phase 2: Full-Page Installation Wizard

### 2.1 — Create install wizard route
- [x] Create `packages/dillinger-core/app/games/[id]/install/page.tsx`
- [x] Build page layout with stepper UI shell
- [x] Add navigation from edit page "Install" button → `/games/{id}/install`

### 2.2 — Wizard component & steps
- [x] Create `WineInstallWizard.tsx` component in `packages/dillinger-core/app/components/`
- [x] **Step 1 — Compatibility Intelligence**: Wire to Compatibility Intelligence service (see Phase 3)
- [x] **Step 2 — Choose Installation Method**: Radio cards for Lutris / Standard / Manual
- [x] Step 2: Show Lutris installers with badges when available
- [x] Step 2: Pre-select Lutris installer from Compatibility Intelligence results
- [x] Step 2: Add method explainer text
- [x] **Step 3 — Select Installer File**: File picker with GOG cache auto-detection
- [x] Step 3: Show file size and detected type
- [x] Step 3: Add file selection explainer text
- [x] **Step 4 — Wine Configuration**: Wine version selector, architecture, UMU Game ID
- [x] Step 4: Auto-populate UMU Game ID from Compatibility Intelligence
- [x] Step 4: Default architecture from Lutris/protonfixes
- [x] Step 4: Add Wine config explainer text
- [x] **Step 5 — Install Directory**: Volume quick-select + custom path
- [x] Step 5: Add directory explainer text
- [x] **Step 6 — Review & Install**: Summary card, debug mode toggle
- [x] Step 6: Trigger `POST /api/games/{id}/install` on confirm
- [x] **Step 7 — Installation Monitor**: Inline log streaming (reuse `WineInstallationMonitorModal` logic)
- [x] Step 7: Progress indicators and activity detection
- [x] Step 7: Auto-advance to Step 8 on completion
- [x] **Step 8 — Post-Install Configuration**: Auto-scan for `.exe` files
- [x] Step 8: Smart executable recommendations (filter non-game .exe, group by directory)
- [x] Step 8: Highlight Lutris-detected `game.exe` and protonfixes `replace_command` targets
- [x] Step 8: Shortcut finder and browse install folder tools
- [x] Step 8: Add exe picker explainer text
- [x] Step 8: "Done" button → navigate back to `/games/{id}/edit`

### 2.3 — Deprecate InstallGameDialog
- [x] Add `@deprecated` JSDoc to `InstallGameDialog.tsx`
- [x] Redirect Wine game installs from dialog to new wizard route
- [x] Verify non-Wine platforms still use the dialog correctly

### 2.4 — Reinstall flow
- [x] Render Installation section as read-only summary when `status === 'installed'`
- [x] Add prominent "Reinstall" button (destructive styling)
- [x] Implement confirmation dialog on Reinstall click
- [x] Navigate to `/games/{id}/install` with prefix cleared on confirm
- [x] Keep launch command field editable regardless of install state

---

## Phase 3: Compatibility Intelligence

### 3.1 — Add umu-protonfixes submodule
- [x] `git submodule add https://github.com/Open-Wine-Components/umu-protonfixes.git third_party/umu-protonfixes`
- [x] Update `.gitmodules` with the new submodule entry
- [x] Verify submodule clones correctly (`git submodule update --init`)

### 3.2 — Python AST indexer
- [x] Create `scripts/index-protonfixes.py`
- [x] Walk all `gamefixes-{store}/` directories
- [x] Detect symlinks and record cross-references (e.g., `gog:umu-1209025141` → `steam:1151640`)
- [x] Parse `.py` files with Python `ast` module
- [x] Extract `util.protontricks()` calls → `winetricks[]`
- [x] Extract `util.winedll_override()` calls → `dll_overrides{}`
- [x] Extract `util.set_environment()` calls → `env_vars{}`
- [x] Extract `util.del_environment()` calls → `del_env_vars[]`
- [x] Extract `util.replace_command()` calls → `command_replacements[]`
- [x] Extract `util.regedit_add()` calls → `registry[]`
- [x] Extract flag functions (`disable_nvapi`, `disable_esync`, `disable_fsync`, `install_eac_runtime`, `install_battleye_runtime`) → `flags[]`
- [x] Extract `util.set_dxvk_option()` calls → `dxvk_options{}`
- [x] Flag `has_complex_logic: true` for scripts with conditionals/loops/file I/O
- [x] Parse `umu-database.csv` for title/store/UMU_ID mappings
- [x] Output `packages/dillinger-core/assets/generated/protonfixes-index.json`
- [x] Create `packages/dillinger-core/assets/generated/` directory (add to `.gitignore` or commit generated file)
- [x] Test indexer against real submodule data — verify output structure

### 3.3 — TypeScript fallback parser
- [x] Create `packages/dillinger-core/lib/services/protonfixes-parser.ts`
- [x] Implement `loadIndex()` — load `protonfixes-index.json`
- [x] Implement regex fallback for stale/missing index (parse `.py` files directly)
- [x] Implement `lookupByGogId(gogId)` — via cross-references + umu_database
- [x] Implement `lookupBySteamAppId(appId)` — direct fix lookup
- [x] Implement `lookupByTitle(title)` — fuzzy search across umu_database titles
- [x] Implement `lookupBySlug(slug)` — check `gamefixes-umu/` entries
- [x] Unit tests for all lookup functions (mock index data)
- [x] Unit tests for regex parser (sample `.py` snippets)

### 3.4 — Compatibility Intelligence service
- [x] Create `packages/dillinger-core/lib/services/compatibility-service.ts`
- [x] Define `CompatibilityReport`, `CompatibilitySource`, `MergedFixes` interfaces
- [x] Implement UMU Database API lookup (`GET umu.openwinecomponents.org/umu_api.php?codename={gogId}&store=gog`)
- [x] Implement local protonfixes index lookup (via `protonfixes-parser.ts`)
- [x] Integrate existing Lutris API lookup (reuse `lutris-service.ts`)
- [x] Implement ProtonDB API lookup (`GET protondb.com/api/v1/reports/summaries/{steamAppId}.json`)
- [x] Implement PCGamingWiki Cargo API lookup (DirectX version, DRM/anti-cheat)
- [x] Implement fix merging logic (de-duplicate winetricks, merge DLL overrides, union env vars)
- [x] Implement parallel execution (UMU DB first → then protonfixes + Lutris + ProtonDB + PCGW in parallel)
- [x] Implement caching at `/data/storage/cache/compat/{slug}.json` with 7-day TTL
- [x] Implement cache busting on submodule update
- [x] Unit tests with mocked API responses — verify merged output correctness
- [ ] Integration test — end-to-end lookup for a known game (e.g., Horizon Zero Dawn)

### 3.5 — Global auto-lookup setting
- [x] Add "Auto-check compatibility databases" checkbox to settings UI (`packages/dillinger-core/app/settings/`)
- [x] Store setting in global Dillinger settings JSON
- [x] Default value: ON
- [x] Add explainer text for the setting
- [x] Read setting in wizard Step 1 to control auto-fire vs manual button

### 3.6 — Compatibility Intelligence API route
- [x] Create `packages/dillinger-core/app/api/compatibility/[gameId]/route.ts`
- [x] Implement `GET` handler — read game metadata, call `compatibilityService.lookup()`, return `CompatibilityReport`
- [x] Implement `POST` handler — bust cache and re-run
- [x] Error handling for missing games, API failures, timeouts

### 3.7 — Compatibility Intelligence UI (Wizard Step 1)
- [x] Build "Compatibility Intelligence" step layout in `WineInstallWizard.tsx`
- [x] UMU Protonfixes card — status, UMU Game ID, winetricks, DLLs, env vars, complex logic warning
- [x] Lutris card — installer count, badges, pre-select best match
- [x] ProtonDB card — tier badge (color-coded), confidence, reports count, external link
- [x] PCGamingWiki card — DirectX version, DRM/anti-cheat warnings, external link
- [x] Skeleton loading state for each card
- [x] Merged Fixes Summary panel at bottom
- [x] Per-fix checkboxes (include/exclude individual recommendations)
- [x] "Apply All Recommendations" default vs "Customize" toggle
- [x] Manual "Check Compatibility" button (shown when auto-lookup is disabled)
- [x] "Skip" button to proceed without fixes
- [x] Pass selected fixes forward to subsequent wizard steps

### 3.8 — Protonfixes index pnpm scripts
- [x] Add `"index:protonfixes": "python3 scripts/index-protonfixes.py"` to root `package.json`
- [x] Add `"update:protonfixes": "bash scripts/update-protonfixes.sh"` to root `package.json`
- [x] Wire `index:protonfixes` into `prebuild` script
- [x] Add indexer step to `docker/dillinger-core/Dockerfile` (ensure Python3 available)

### 3.9 — Submodule refresh script
- [x] Create `scripts/update-protonfixes.sh` (git pull + re-index)
- [x] Make script executable (`chmod +x`)
- [x] Test full refresh cycle: update submodule → regenerate index → verify JSON

---

## Phase 4: Section Reordering & Screenshots

### 4.1 — Move screenshots into Game Information
- [x] Move screenshot carousel code from `GameForm.tsx` L1473–1582 into the Game Information section (L2708+)
- [x] Place after description/genre/developer fields
- [x] Reduce carousel container size (`max-w-2xl`, `max-h-64`)

### 4.2 — Reorder edit page sections
- [x] Verify final section order for Wine games: Status Banner → Basic Info → Installation → Rendering → MakeItRun Config → Performance → Game Information
- [x] Update section `ref` and `id` attributes to match new order
- [x] Update `IntersectionObserver` section tracking
- [ ] Visual regression check — verify no layout breakage for non-Wine platforms

---

## Phase 5: Wine Advanced → MakeItRun Config Overhaul

### 5.1 — Remove deprecated presets
- [x] Delete `applyOldGogVideoCompatibilityPreset` function from `GameForm.tsx` (L865–882)
- [x] Delete `applyDirectDrawCompatibilityPreset` function from `GameForm.tsx` (L883–907)
- [x] Delete associated UI buttons from Wine Advanced section (L2128–2165)
- [x] Verify no other code references these functions

### 5.2 — New MakeItRun Config section
- [x] Rename sidebar entry from "Wine Advanced" to "MakeItRun Config" with 🔧 icon
- [x] **A. Protonfixes & UMU Configuration**
  - [x] Move UMU Game ID field from `WineVersionSelector` into MakeItRun Config (make prominent)
  - [x] Add "Auto-detect" button → calls `GET /api/compatibility/{gameId}`
  - [x] Add protonfixes badge showing extracted fix details from index
  - [x] Add `has_complex_logic` info banner
  - [x] Add protonfixes explainer text
  - [x] Add link to protonfixes GitHub
- [x] **B. Lutris Configuration**
  - [x] Read-only summary of applied Lutris script config
  - [x] "Re-apply Lutris Config" button
  - [x] "Change Lutris Installer" link
  - [x] Add Lutris explainer text
- [x] **C. Winetricks**
  - [x] Keep existing dynamic list UI
  - [x] Add verb search/autocomplete
  - [x] Pre-populate from Compatibility Intelligence accepted fixes
  - [x] Add winetricks explainer text
- [x] **D. DLL Overrides**
  - [x] Keep existing `WINEDLLOVERRIDES` text input
  - [x] Add common DLL override chips (ddraw, d3d9, quartz, etc.) as quick-add helpers
  - [x] Pre-populate from Compatibility Intelligence
  - [x] Add DLL overrides explainer text
- [x] **E. Environment Variables** (new)
  - [x] Key-value editor with add/remove rows
  - [x] Pre-populate from protonfixes `set_environment` entries
  - [x] Add env vars explainer text
- [x] **F. Registry Settings**
  - [x] Keep existing dynamic editor
  - [x] Pre-populate from protonfixes `regedit_add` entries
- [x] **G. Export/Import MakeItRun Config**
  - [x] "Export as TOML" button → save to `/data/storage/makeitrun/{slug}.toml`
  - [x] "Import TOML" button → file upload or paste
  - [x] "Share" button (disabled, tooltip: "Coming soon — share on DillingerGaming")

---

## Phase 6: New Performance Section

### 6.1 — Extract Gamescope + MangoHUD
- [x] Create `WinePerformanceSection.tsx` component
- [x] Move Gamescope UI from `GameForm.tsx` L2420–2705 into new component
- [x] Move MangoHUD toggle from `GameForm.tsx` L2679–2704 into new component
- [x] Add Performance explainer text
- [x] Gate section on `WineGamePhase` (locked until installed)
- [x] Add ⚡ icon to sidebar entry
- [x] Verify all Gamescope sub-fields work correctly in new location (output res, internal res, refresh rate, upscaler, fullscreen, FPS limit)

---

## Phase 7: MakeItRun TOML Format & Storage

### 7.1 — Define TOML schema
- [x] Create `packages/dillinger-core/assets/schema/makeitrun-v1.0.toml` reference template
- [x] Include all sections: sources, install, protonfixes, winetricks, dll_overrides, registry, environment, rendering, performance, launch, flags, notes

### 7.2 — TOML parser/writer service
- [x] Install `smol-toml` package (`pnpm add smol-toml --filter @dillinger/core`)
- [x] Create `packages/dillinger-core/lib/services/makeitrun-service.ts`
- [x] Implement `loadConfig(slug)` — read TOML from `/data/storage/makeitrun/{slug}.toml`
- [x] Implement `saveConfig(slug, config)` — write TOML
- [x] Implement `deleteConfig(slug)`
- [x] Implement `listConfigs()` — list all stored configs
- [x] Implement `generateFromGame(game, platformConfig)` — extract current settings to MakeItRunConfig
- [x] Implement `generateFromCompatReport(report)` — create config from Compatibility Intelligence results
- [x] Implement `applyToGame(game, config)` — merge TOML config into `GamePlatformConfig.settings`
- [x] Implement `importFromLutris(analysis)` — convert `LutrisScriptAnalysis` to partial MakeItRunConfig
- [x] Implement `importFromProtonfixes(entry)` — convert protonfixes index entry to partial config
- [x] Implement `mergeConfigs(base, overlay)` — union winetricks, merge DLLs, etc.
- [x] Implement `validateConfig(config)` — schema validation
- [x] Unit tests: load, save, generate, apply, validate, merge
- [x] TOML round-trip tests (parse → serialize → parse → verify equality)

### 7.3 — TypeScript types
- [x] Create `packages/shared/src/types/makeitrun.ts`
- [x] Define `MakeItRunConfig` interface (matching TOML schema)
- [x] Define `MakeItRunConfigSummary` interface (for listings)
- [x] Define `MakeItRunImportSource` type
- [x] Define `ProtonfixEntry` interface (matching protonfixes index entries)
- [x] Define `CompatibilityReport` and `CompatibilitySource` interfaces
- [x] Export all types from shared package barrel

### 7.4 — Storage directory
- [x] Add `makeitrun` to `JSONStorageService` init directories (alongside `games`, `platforms`, etc.)
- [x] Add `cache/compat` directory for Compatibility Intelligence cache
- [x] Verify directory creation on Dillinger startup

---

## Phase 8: MakeItRun API (Local + Community Spec)

### 8.1 — Local CRUD API routes
- [x] Create `packages/dillinger-core/app/api/makeitrun/route.ts` — GET (list), POST (create/import)
- [x] Create `packages/dillinger-core/app/api/makeitrun/[slug]/route.ts` — GET, PUT, DELETE
- [x] Create `packages/dillinger-core/app/api/makeitrun/[slug]/apply/route.ts` — POST (apply to game)
- [x] Create `packages/dillinger-core/app/api/makeitrun/[slug]/export/route.ts` — GET (download TOML)
- [x] Create `packages/dillinger-core/app/api/makeitrun/generate/[gameId]/route.ts` — POST (generate from game)
- [x] Error handling: 404 for missing configs, validation errors, etc.
- [x] Test all endpoints manually

### 8.2 — Community sharing API spec
- [x] Create `docs/plans/spec-makeitrun-community-api.md`
- [x] Document all REST endpoints (`/v1/makeitrun/search`, `/{slug}`, `/{slug}/{configId}`, `/popular`, `/recent`, `/user/{userId}`, `/stats`)
- [x] Document request/response shapes
- [x] Define medal system (Platinum / Gold / Silver / Bronze / Borked)
- [x] Document OAuth2 authentication flow
- [x] Document sync flow (share → download → import → rate)
- [ ] Note: implementation deferred to future phase

---

## Phase 9: Refactor GameForm.tsx

### 9.1 — Extract Wine sections into separate components
- [x] Create `WineStatusBanner.tsx` (if not already done in Phase 1)
- [x] Create `WineInstallSection.tsx` — installation config + read-only installed state
- [x] Create `WineRenderingSection.tsx` — DXVK, VKD3D, renderer, virtual desktop, xrandr
- [x] Create `WineMakeItRunSection.tsx` — protonfixes, Lutris config, winetricks, DLLs, env vars, registry, export/import
- [x] Create `WinePerformanceSection.tsx` (if not already done in Phase 6)
- [x] Create `GameInfoSection.tsx` — description, metadata, screenshots, images, scraper
- [x] Define shared props interface (`formData`, `setFormData`, `activeInstallation`, `phase`)
- [x] Wire all extracted components back into `GameForm.tsx` as a layout shell
- [x] Verify `GameForm.tsx` is under ~1000 lines

### 9.2 — Phase-gated rendering
- [x] Each section component checks `phase` prop
- [x] Locked sections render a placeholder with lock message
- [x] Section components handle their own explainer text
- [x] Automated render verification for lock/unlock states across phases
- [ ] Visual verification — all sections render correctly in each phase

---

## Phase 10: No-Regression Launch Verification

### 10.1 — Preserve all existing env vars
- [x] Audit `docker-service.ts` `launchGame()` Wine section (~L1700+)
- [x] Create checklist of all env vars currently pushed to container
- [x] Verify no env vars are removed or renamed by any changes
- [x] Manual test: launch a working Wine game before and after changes — compare `docker inspect` env vars

### 10.2 — MakeItRun applies through existing paths
- [x] Verify `POST /api/makeitrun/{slug}/apply` writes to `GamePlatformConfig.settings` (same fields `launchGame()` reads)
- [x] Verify no changes needed to `launchGame()` or `wine-entrypoint.sh`
- [x] Integration test: apply MakeItRun config → launch game → verify all expected env vars present

### 10.3 — New env vars (additive only)
- [x] Verify protonfixes `environment` entries go into `settings.launch.environment`
- [x] Verify `docker-service.ts` passes `settings.launch.environment` to container
- [x] Verify `wine-entrypoint.sh` handles arbitrary env vars without issue

### 10.4 — Automated test coverage
- [x] `deriveWinePhase()` unit tests (all transitions)
- [x] `makeitrun-service` unit tests (load, save, generate, apply, validate, merge)
- [x] TOML round-trip tests
- [x] `protonfixes-parser` unit tests (regex extraction)
- [x] `compatibility-service` unit tests (mock API responses)
- [x] Integration test: game JSON → apply MakeItRun → verify `GamePlatformConfig.settings`
- [x] Regression test: mock launch with pre-existing config → verify all env vars present

---

## Phase 11: UX Polish & Explainers

### 11.1 — Wizard explainer text
- [x] Wine Version selector explainer
- [x] UMU Game ID explainer
- [x] Architecture selector explainer
- [x] DXVK toggle explainer
- [x] VKD3D-Proton toggle explainer
- [x] DLL Overrides explainer
- [x] Winetricks explainer
- [x] Gamescope explainer
- [x] MangoHUD explainer
- [x] Post-install exe picker explainer
- [x] Compatibility Intelligence explainer
- [x] ProtonDB tier badge explainer

### 11.2 — Transition animations
- [x] Sidebar sections unlock animation (opacity)
- [x] Status banner state change animation (color transition)
- [x] Installation wizard step advance animation (slide)
- [x] Compatibility Intelligence card loading animation (skeleton → content fade)

---

## Final Verification Checklist

- [ ] **V1**: State machine — banner shows correct phase for all states
- [ ] **V2**: Sidebar locking — locked sections dimmed + not interactive
- [ ] **V3**: Wizard — full flow from Install → Compatibility Intelligence → install → post-install → edit page
- [ ] **V4**: Compatibility Intelligence — verified for a known game (e.g., Horizon Zero Dawn / GOG 1209025141)
- [ ] **V5**: Auto-lookup toggle — disable in settings → wizard shows manual button
- [ ] **V6**: Reinstall — confirmation dialog → wizard with cleared prefix
- [ ] **V7**: MakeItRun TOML — export/import round-trip, `[sources]` populated from compat data
- [x] **V8**: No regression — launch a working Wine game, `docker inspect` env vars unchanged
- [x] **V9**: Protonfixes index — `pnpm index:protonfixes` generates valid JSON
- [ ] **V10**: Section removal — Old GOG / DirectDraw preset buttons gone
- [ ] **V11**: Screenshots position — carousel in Game Information section
- [x] **V12**: `pnpm test && pnpm lint` passes

---

## Implementation Notes

### 2026-02-17 — Phase 1 started/completed (partial)
- Added shared `WineGamePhase` and new utility `deriveWinePhase` in `packages/shared/src/utils/wine-phase.ts`.
- Exported the utility via shared barrels (`packages/shared/src/utils/index.ts`).
- Added `WineStatusBanner` component with state-specific copy, monitor action, launch action, and session link.
- Integrated `WineStatusBanner` into `GameForm` (Wine-only), including a quick launch POST to `/api/launch/{id}`.
- Updated Wine sidebar sections with install-state locking, disabled affordances (🔒), tooltip text, and dynamic install label (`✅ Installed`).
- Added `performance` section anchor wiring in `GameForm` sidebar navigation for the upcoming Performance extraction phase.
- Validation: `pnpm --filter @dillinger/core lint` completes with existing baseline warnings only (no new lint errors introduced).
- Remaining in Phase 1: add runnable unit tests for `deriveWinePhase`.

### 2026-02-17 — Phase 2 started (route + shell)
- Added new install route page at `packages/dillinger-core/app/games/[id]/install/page.tsx`.
- Added initial `WineInstallWizard` shell component with 8-step visual scaffold at `packages/dillinger-core/app/components/WineInstallWizard.tsx`.
- Kept existing install button behavior unchanged for now to avoid regression while wizard functionality is implemented.
- Validation: `pnpm --filter @dillinger/core lint` still completes with existing baseline warnings only.

### 2026-02-17 — Phase 1.1 tests completed
- Added runnable shared-package tests in `packages/shared/src/utils/wine-phase.test.ts` covering all required phase outcomes.
- Added dedicated test compiler config `packages/shared/tsconfig.test.json`.
- Updated `@dillinger/shared` test script to compile tests into `dist-test` and execute via Node test runner.
- Validation: `pnpm --filter @dillinger/shared test` passes (8/8 tests).

### 2026-02-17 — Phase 2 navigation wired
- Added an `Open Wizard` entry point in `GameForm` install configuration panel linking to `/games/{id}/install`.
- Kept existing install dialog actions in place as a fallback to prevent regression while wizard internals are still being implemented.
- Validation: `pnpm --filter @dillinger/core lint` still passes with baseline warnings only.

### 2026-02-17 — Phase 2.2 framework progress
- Upgraded `WineInstallWizard` from static shell to an interactive multi-step scaffold with Back/Next controls.
- Added active-step styling and step-content renderer with placeholders for pending integrations.
- Implemented Step 2 method selection cards (Lutris / Standard / Manual) with default selection and explanatory copy.
- Validation: `pnpm --filter @dillinger/core lint` continues to pass with existing baseline warnings only.

### 2026-02-17 — Phase 2.2 Step 1 wired (initial compatibility integration)
- Added new API route `packages/dillinger-core/app/api/compatibility/[gameId]/route.ts` with `GET` + `POST` handlers.
- Route now resolves game data, infers GOG ID (metadata/slug heuristic), and performs Lutris lookup via existing `lutris-service`.
- Wizard Step 1 now auto-fetches compatibility data on load, shows per-source cards, supports manual re-check, and preselects Lutris install method when found.
- Current scope intentionally includes full Lutris integration first; Protonfixes/ProtonDB/PCGamingWiki source cards are present with explicit "not wired yet" status until Phase 3 service/index work lands.

### 2026-02-17 — Phase 2.2 Step 2 Lutris badges/preselection
- Extended compatibility API report to include normalized Lutris installer summaries (`arch`, `winetricksCount`, `dllOverrideCount`) and `suggestedLutrisInstallerId`.
- Updated Step 2 method cards so `Lutris Installer` is disabled when no compatible installer candidates are found.
- Added installer chooser cards under Step 2 when Lutris is selected, including badges and explicit selected state.
- Preselection now uses Compatibility Intelligence suggestion and is stored in wizard state for subsequent steps.

### 2026-02-17 — Phase 2.2 Step 3 installer picker wired
- Added Step 3 implementation in `WineInstallWizard.tsx` with auto-loaded GOG cache installer list via existing `/api/gog/cache/{gameId}/files` endpoint.
- Added installer metadata display in the step UI (size formatting + detected installer type badge for EXE/MSI/BIN patterns).
- Added manual fallback browse flow using existing `FileExplorer` component (`selectMode="file"`, default path `/cache`).
- Added selected-installer summary state and guarded Next button behavior on Step 3 until a file is selected.

### 2026-02-17 — Phase 2.2 Step 4 wine configuration wired
- Added Step 4 UI to `WineInstallWizard.tsx` with wine version selector, architecture choice cards, and UMU Game ID input.
- Integrated `/api/wine-versions` to populate installed/default versions and determine whether selected version supports UMU.
- Extended compatibility report with `suggestedUmuGameId` and used it for UMU field auto-population.
- Wired default architecture from compatibility recommendations (which are currently seeded from Lutris/script hints when available).

### 2026-02-17 — Phase 2.2 Step 5 install directory wired
- Added Step 5 UI to `WineInstallWizard.tsx` with quick-select buttons for detected `/installed` mounts and editable install path field.
- Added custom path fallback via existing `FileExplorer` in directory-select mode.
- Added new endpoint `app/api/filesystem/space/route.ts` to query `df` usage and show estimated available/total space for selected install target.
- Added step gating so Next remains disabled on Step 5 until an install path is set.

### 2026-02-17 — Phase 2.2 Step 6 review/install wired
- Added Step 6 summary card with method, installer, target path, Wine settings, and optional selected Lutris installer.
- Added debug mode toggle and real install trigger via `POST /api/games/{id}/install`.
- Added install start feedback/error handling and container name surfacing when returned by API.
- Added automatic transition to Step 7 after install start; Step 7 currently remains a placeholder until inline log streaming is wired.

### 2026-02-17 — Phase 2.2 Step 7 inline monitor wired
- Replaced Step 7 placeholder with inline polling monitor in `WineInstallWizard.tsx`.
- Reused existing APIs (`/api/games/{id}/container-logs?type=install` and `/api/games/{id}/install/status`) to stream logs and status.
- Added runner/activity indicators, error handling, and cancel-install action (`DELETE /api/games/{id}/install`).
- Added automatic transition from Step 7 to Step 8 when install status reports completion.

### 2026-02-17 — Phase 2.2 Step 8 post-install executable picker wired
- Replaced Step 8 placeholder with a real executable picker in `WineInstallWizard.tsx`, auto-loading candidates from install status.
- Added smart recommendations: grouped candidates by directory, flagged likely non-game executables, and highlighted compatibility-suggested targets.
- Added `ShortcutSelectorDialog` integration and manual install-folder browsing via `FileExplorer` for fallback selection.
- Added `Done` action that persists selected executable to `PUT /api/games/{id}/platforms/windows-wine` (`filePath` + `settings.launch.command`) and returns to `/games/{id}/edit`.

### 2026-02-17 — Phase 2.3 dialog deprecation + Wine redirect wired
- Added `@deprecated` JSDoc to `InstallGameDialog.tsx` and documented that Wine installs should use `/games/{id}/install`.
- Updated `GameForm.tsx` Wine install/reinstall actions to navigate directly to the full-page wizard route.
- Added a safety redirect in `InstallGameDialog` so any Wine invocation auto-routes to the wizard while preserving non-Wine dialog behavior.

### 2026-02-17 — Phase 2.4 reinstall flow/read-only install summary wired
- Updated `GameForm.tsx` reinstall flow to require explicit user confirmation before resetting install metadata.
- Fixed reinstall reset path to use `PUT /api/games/{id}/platforms/windows-wine`, clearing install fields on the platform config before redirecting.
- Updated installed-state Installation panel to a read-only summary presentation with destructive-styled `Reinstall` action.
- Kept `Launch Command` editable for installed games and preserved shortcut/browse helpers for executable selection.

### 2026-02-17 — Phase 3 foundation (submodule + indexer + scripts) wired
- Added `third_party/umu-protonfixes` submodule and initialized it recursively (including nested `umu-database`).
- Implemented `scripts/index-protonfixes.py` AST indexer with extraction for winetricks, DLL overrides, env vars, command replacements, registry, flags, and DXVK options.
- Added symlink cross-reference detection and CSV mapping enrichment from `umu-database.csv`.
- Added generated output location `packages/dillinger-core/assets/generated/protonfixes-index.json` and tracked generated-folder policy via `.gitkeep` + `.gitignore`.
- Added root scripts: `index:protonfixes`, `update:protonfixes`, and `prebuild` hook; validated end-to-end index generation and refresh workflow.

### 2026-02-17 — Phase 3.8 Docker build hook completed
- Updated `docker/dillinger-core/Dockerfile` builder stage to copy `scripts/` and `third_party/umu-protonfixes/`.
- Added explicit `RUN pnpm run index:protonfixes` in Docker build so compatibility index generation occurs during image builds.

### 2026-02-17 — Phase 3.3 parser service (initial) completed
- Added `packages/dillinger-core/lib/services/protonfixes-parser.ts` with index loading and stale-index detection.
- Implemented fallback regex parsing for protonfix scripts when the generated index is stale or missing.
- Implemented `lookupByGogId`, `lookupBySteamAppId`, `lookupByTitle`, and `lookupBySlug` with cross-reference handling.
- Deferred unit tests to a follow-up pass (no existing dillinger-core unit test harness present yet).

### 2026-02-17 — Phase 3.4/3.6 compatibility service + API wiring
- Added `packages/dillinger-core/lib/services/compatibility-service.ts` to orchestrate UMU, protonfixes, Lutris, ProtonDB, and PCGamingWiki lookups.
- Implemented merged-fixes composition and confidence scoring, with 7-day cache at `/data/storage/cache/compat/{slug}.json`.
- Added cache busting behavior tied to protonfixes commit metadata changes and explicit `POST` bust-cache calls.
- Updated `app/api/compatibility/[gameId]/route.ts` to use the new service for both `GET` and `POST` while preserving wizard-facing response shape.

### 2026-02-17 — Phase 3.3 tests completed + 3.4 unit coverage added
- Added `packages/dillinger-core/tests/services/protonfixes-parser.test.ts` covering indexed lookup (`lookupBySteamAppId`, `lookupByGogId`, `lookupByTitle`) and stale-index regex fallback extraction.
- Added `packages/dillinger-core/tests/services/compatibility-service.test.ts` covering merged fixes and cache behavior (`reuse` vs `bustCache`).
- Added `packages/dillinger-core/tsconfig.test.json` and `@dillinger/core` test script (`pnpm --filter @dillinger/core test`) to compile and run Node tests for these services.

### 2026-02-17 — Phase 3.4 mocked external API unit test completed
- Extended `packages/dillinger-core/tests/services/compatibility-service.test.ts` with mocked `global.fetch` + `axios.get` coverage for UMU, Lutris, ProtonDB, and PCGamingWiki branches.
- Verified merged output expectations from mocked responses (tier/confidence/total, arch recommendation, suggested executable, winetricks, DLL overrides, DXVK/VKD3D recommendations).
- Validation: `pnpm --filter @dillinger/core test` passes (6/6).

### 2026-02-17 — Phase 3.5 global auto-lookup setting completed
- Added `downloads.autoCheckCompatibilityDatabases` to persisted settings in `lib/services/settings.ts` with default `true`.
- Updated `app/api/settings/downloads/route.ts` to accept and persist `autoCheckCompatibilityDatabases` updates.
- Added checkbox + explainer text in `app/settings/page.tsx` Download Settings and wired load/save behavior.
- Updated `WineInstallWizard` Step 1 to read the global setting and:
  - auto-run compatibility lookup when enabled,
  - show manual `Check Compatibility` flow when disabled.
- Validation: `pnpm --filter @dillinger/core test` passes (6/6), touched files diagnostics are clean.

### 2026-02-17 — Phase 3.7 Compatibility Intelligence Step 1 UI completed
- Reworked `WineInstallWizard` Step 1 into source-specific cards (UMU+Protonfixes, Lutris, ProtonDB, PCGamingWiki) with status/details and external links.
- Added per-card skeleton loading placeholders and preserved manual `Check Compatibility` flow when global auto-check is disabled.
- Added Merged Fixes Summary with recommendation count, `Apply All Recommendations` vs `Customize` mode, and per-fix include/exclude checkboxes.
- Added explicit `Skip` flow to proceed without fixes and wired `Apply & Continue` to advance into Step 2.
- Passed selected recommendation state forward into later steps (method/arch/UMU/executable prefill) and surfaced recommendation mode/count in Step 6 review summary.
- Validation: `pnpm --filter @dillinger/core test` passes (6/6); lint runs with existing project baseline warnings.

### 2026-02-17 — Phases 4/5/7/8 implementation batch (in progress)
- Updated `GameForm.tsx` Wine navigation by renaming the section from `wine-advanced` to `makeitrun-config` and removing legacy compatibility preset actions.
- Moved screenshot carousel rendering into the Game Information section and constrained its display footprint.
- Added MakeItRun shared types in `packages/shared/src/types/makeitrun.ts` and exported them via shared barrel.
- Added MakeItRun service `lib/services/makeitrun-service.ts` with TOML load/save/list/delete, generation, merge, import helpers, validation, and apply-to-game mapping.
- Added local MakeItRun API routes for CRUD/apply/export/generate under `app/api/makeitrun/*`.
- Added schema template `assets/schema/makeitrun-v1.0.toml` and ensured scaffold/storage directory creation for `storage/makeitrun` and `storage/cache/compat`.
- Added community API design doc `docs/plans/spec-makeitrun-community-api.md` (draft, implementation deferred).

### 2026-02-17 — Phase 5.2/6 MakeItRun UI + Performance extraction follow-up
- Added MakeItRun compatibility action block in `GameForm.tsx` with UMU auto-detect, extracted-fix summary, complex-logic warning, and protonfixes external link.
- Added Lutris read-only summary + quick re-apply action and installer-change link in MakeItRun Config.
- Added DLL quick-add chips and environment key/value editor (add/remove/update) in MakeItRun Config.
- Added MakeItRun TOML export/import controls and disabled Share action with "coming soon" tooltip behavior.
- Extracted Gamescope + MangoHUD UI into new `app/components/WinePerformanceSection.tsx` and wired the section from `GameForm.tsx`.

### 2026-02-17 — Phase 5.2 cleanup (UMU ownership + winetricks UX)
- Removed UMU Game ID editing from `WineVersionSelector.tsx`; UMU is now configured from MakeItRun section only.
- Added winetricks verb search/autocomplete helpers in `GameForm.tsx` (datalist + quick-add chips + dedupe behavior).
- Added explicit Lutris explainer copy in MakeItRun configuration.

### 2026-02-17 — Phase 7.1 schema template completion
- Expanded `assets/schema/makeitrun-v1.0.toml` to include all target sections and representative fields: protonfixes, winetricks, dll overrides, registry, environment, rendering DXVK options, performance tuning, launch, and root flags.

### 2026-02-17 — Phase 7.2/7.3 compatibility generation + shared types
- Added `generateFromCompatReport(report)` in `lib/services/makeitrun-service.ts` and refactored `generateFromCompatibility(game, report)` to compose from that report-derived config.
- Added shared `ProtonfixEntry`, `CompatibilitySource`, and `CompatibilityReport` interfaces in `packages/shared/src/types/makeitrun.ts`.

### 2026-02-17 — Phase 7.4 startup verification
- Verified `storage/makeitrun` and `storage/cache/compat` creation is enforced during startup via both `JSONStorageService.ensureDirectories()` and bootstrap initialization paths.

### 2026-02-17 — Phase 7.2 test coverage completion
- Added `tests/services/makeitrun-service.test.ts` covering load/save, compatibility generation, merge behavior, apply-to-game mapping, and TOML round-trip parse/serialize validation.
- Refined `makeitrun-service` runtime path resolution to avoid unnecessary storage service coupling in unit tests.

### 2026-02-17 — Phase 10.4 integration/regression tests completed
- Extended `tests/services/makeitrun-service.test.ts` with integration-style game JSON apply-flow verification for `GamePlatformConfig.settings` mapping.
- Added regression coverage to verify pre-existing `settings.launch.environment` values are preserved while MakeItRun overlay values are merged.

### 2026-02-17 — Phase 8.1/10.2/10.3 manual verification pass
- Manually exercised local MakeItRun API endpoints against a live dev server (`GET/POST /api/makeitrun`, `GET/PUT/DELETE /api/makeitrun/{slug}`, `GET /export`, `POST /generate/{gameId}`, `POST /apply`) with expected success/404 behavior.
- Verified applied MakeItRun config persisted into game JSON under `platforms[].settings` fields consumed by launch flow (`wine`, `launch`, and merged launch environment).
- Confirmed env propagation path: `makeitrun-service.applyToGame()` merges compatibility/protonfix env into `settings.launch.environment`, `docker-service.launchGame()` exports `Object.entries(environment)` into container env, and `wine-entrypoint.sh` preserves arbitrary env vars while consuming known Wine/game toggles.

### 2026-02-17 — Phase 10.2 launch-path integration test
- Added `lib/services/launch-env.ts` with `buildLaunchEnvironmentVariables()` and wired `docker-service` to use the shared helper.
- Added integration test `integration: apply MakeItRun then launch path includes merged env vars` in `tests/services/makeitrun-service.test.ts` to assert expected env var propagation from applied MakeItRun config into launch env construction.

### 2026-02-17 — Phase 10.1 launch env audit checklist
- Audited `docker-service.ts` Wine launch env assembly and confirmed the baseline env set remains intact after MakeItRun changes.
- Current launch env checklist (grouped):
  - Core/session: `GAME_ID`, `SESSION_ID`, `SAVES_PATH`, plus all `settings.launch.environment` key/value pairs.
  - Runtime/system: `PUID`, `PGID`, optional `KEEP_ALIVE`, optional `GPU_VENDOR`, optional joystick vars.
  - Wine core: `WINEDEBUG`, `WINEPREFIX`, `GAME_EXECUTABLE`, `GAME_ARGS`, optional `WINE_VERSION_ID`, optional `UMU_GAME_ID`, optional `GAME_SLUG`.
  - Wine compatibility/tweaks: `WINE_DLL_OVERRIDES`, `WINEDLLOVERRIDES`, `WINE_WINETRICKS`, `WINE_REGISTRY_SETTINGS`, optional `WINE_COMPAT_MODE`, optional `WINE_D3D_RENDERER`, optional `WINE_VIRTUAL_DESKTOP`, optional `XRANDR_MODE`.
  - Translation/perf/overlay: optional `INSTALL_DXVK`, `DXVK_VERSION_ID`, `INSTALL_VKD3D`, `VKD3D_VERSION_ID`, `USE_GAMESCOPE`, `GAMESCOPE_*`, `ENABLE_MANGOHUD`.
  - Streaming/display extras: optional `STREAMING_PRESET_ID`, plus display backend env from display configuration.
- Verification result: no previously expected launch env keys were removed/renamed by this MakeItRun implementation batch; helper extraction (`launch-env.ts`) preserves core env construction semantics.

  ### 2026-02-17 — Phase 9.1 partial section extraction (Rendering + Game Info)
  - Added `app/components/WineRenderingSection.tsx` and moved the full Rendering block (renderer, DXVK/VKD3D, virtual desktop, fullscreen/xrandr controls) out of `GameForm.tsx`.
  - Added `app/components/GameInfoSection.tsx` and moved Game Information fields + screenshot carousel out of `GameForm.tsx`.
  - Wired both components back into `GameForm.tsx` via section refs, preserving existing behavior and sidebar navigation anchors.
  - Validation: `pnpm --filter @dillinger/core test` passes (14/14); `pnpm --filter @dillinger/core lint` remains warnings-only baseline.

  ### 2026-02-17 — Phase 9.1 installation section extraction
  - Added `app/components/WineInstallSection.tsx` and moved Wine-specific installation UI out of `GameForm.tsx` (wizard entry, install-state cards, monitor/log/cancel actions, reinstall summary, launch command helpers).
  - Kept ROM/MAME install controls in `GameForm.tsx` for this pass to minimize extraction risk and keep behavior unchanged.
  - Wired `WineInstallSection` through existing handlers/state in `GameForm.tsx` (`handleReinstall`, `handleCancelInstallation`, modal toggles, and section refs).
  - Validation: `pnpm --filter @dillinger/core test` passes (14/14); `pnpm --filter @dillinger/core lint` remains warnings-only baseline.

  ### 2026-02-17 — Phase 9.1 MakeItRun section extraction + shell wiring
  - Added `app/components/WineMakeItRunSection.tsx` and moved the full MakeItRun editor UI from `GameForm.tsx` (UMU/protonfixes, Lutris summary/actions, DLL overrides, winetricks search/edit, env vars, registry, TOML export/import/share controls).
  - Integrated `WineMakeItRunSection`, `WineInstallSection`, `WineRenderingSection`, `WinePerformanceSection`, and `GameInfoSection` into `GameForm.tsx`, leaving the form as a composition shell for Wine sections.
  - Preserved existing handler behavior by passing through existing callbacks/state; no API or route behavior changes were introduced.
  - Validation: `pnpm --filter @dillinger/core test` passes (14/14); `pnpm --filter @dillinger/core lint` remains warnings-only baseline.

  ### 2026-02-17 — Phase 9.1 shared Wine section props
  - Added `app/components/wine-section-types.ts` with shared `WineSectionSharedProps<TFormData>` and `WineInstallationState` definitions.
  - Updated extracted section components (`WineInstallSection`, `WineRenderingSection`, `WineMakeItRunSection`) to consume the shared props contract.

  ### 2026-02-17 — Phase 9 additional extraction pass (media/scrape sections)
  - Added `app/components/DisplayImagesSection.tsx` and moved display image selection UI + image selector modal out of `GameForm.tsx`.
  - Added `app/components/ScrapeDataSection.tsx` and moved scrape CTA block out of `GameForm.tsx`.
  - Added `app/components/RetroMediaSection.tsx` and moved VICE screenshot list + RetroArch saves/states UI out of `GameForm.tsx`.
  - Wired all three components back into `GameForm.tsx` with existing handlers and state.
  - Validation: `pnpm --filter @dillinger/core test` passes (14/14); `pnpm --filter @dillinger/core lint` remains warnings-only baseline.
  - Line-count progress: `GameForm.tsx` reduced from `2438` lines to `2090` lines in this pass.

  ### 2026-02-17 — Phase 9 additional extraction pass (basic info section)
  - Added `app/components/BasicInformationSection.tsx` and moved title/slug/platform-switching/add-platform UI out of `GameForm.tsx`.
  - Wired section ref tracking and existing platform handlers through the new component with no behavior changes.
  - Validation: touched-file diagnostics clean; `pnpm --filter @dillinger/core test` passes (14/14).
  - Lint baseline improved from `196` to `194` warnings by removing stale unused imports from `GameForm.tsx`.
  - Line-count progress: `GameForm.tsx` reduced from `1970` lines to `1804` lines in this pass.

  ### 2026-02-17 — Phase 9 additional extraction pass (actions + dialogs)
  - Added `app/components/GameFormActionButtons.tsx` and moved submit/cancel action row out of `GameForm.tsx`.
  - Added `app/components/GameFormDialogs.tsx` and moved install/shortcut/file explorer/log/monitor dialog rendering out of `GameForm.tsx`.
  - Updated `GameForm.tsx` to consume both new components while preserving existing callbacks and modal behavior.
  - Validation: touched-file diagnostics clean; `pnpm --filter @dillinger/core test` passes (14/14); lint remains warnings-only baseline (`194` warnings).
  - Line-count progress: `GameForm.tsx` reduced from `1804` lines to `1747` lines in this pass.

  ### 2026-02-17 — Phase 9 additional extraction pass (header/sidebar/notice)
  - Added `app/components/GameFormHeader.tsx` and moved page header, refresh-from-scraper action, and success/error alert UI out of `GameForm.tsx`.
  - Added `app/components/GameFormSidebar.tsx` and moved sidebar section navigation rendering out of `GameForm.tsx`.
  - Added `app/components/ScraperDataPreservedNotice.tsx` and moved preserved scraper metadata notice out of `GameForm.tsx`.
  - Updated `GameForm.tsx` to compose these new shell components while preserving existing handlers and state flow.
  - Validation: touched-file diagnostics clean; `pnpm --filter @dillinger/core test` passes (14/14); lint remains warnings-only baseline (`194` warnings).
  - Line-count progress: `GameForm.tsx` reduced from `1747` lines to `1685` lines in this pass.

  ### 2026-02-17 — Phase 9 additional extraction pass (shared helpers)
  - Added `app/components/game-form-utils.ts` and moved pure helpers out of `GameForm.tsx` (`sanitizeStringArray`, `formatRelativeTime`, `normalizeMameSettings`, `getPlatformName`).
  - Updated `BasicInformationSection.tsx` to consume shared `getPlatformName` directly, reducing prop wiring.
  - Removed stale `GameForm.tsx` import from helper extraction and confirmed touched-file diagnostics are clean.
  - Validation: `pnpm --filter @dillinger/core test` passes (14/14); lint warnings reduced from `194` to `193`.
  - Line-count progress: `GameForm.tsx` reduced from `1685` lines to `1612` lines in this pass.

  ### 2026-02-17 — Phase 9 additional extraction pass (types module)
  - Added `app/components/game-form-types.ts` and moved local `GameForm` interfaces/types out of `GameForm.tsx` (`GameFormData`, `GameFormProps`, `SavedGameMetadata`, `Screenshot`, `SaveFile`, `FormSection`, `MakeItRunCompatibilitySummary`).
  - Updated `GameForm.tsx` to import extracted types and tightened `_originalGame` typing in the new module to avoid `any` spillover.
  - Validation: touched-file diagnostics clean; `pnpm --filter @dillinger/core test` passes (14/14).
  - Lint baseline improved from `193` to `192` warnings after type tightening.
  - Line-count progress: `GameForm.tsx` reduced from `1612` lines to `1478` lines in this pass.

  ### 2026-02-17 — Phase 9 additional extraction pass (platform state handlers)
  - Added `app/components/game-form-platform-utils.ts` and moved platform state mutation logic out of `GameForm.tsx` (`switchPlatformState`, `addPlatformState`, `removePlatformState`).
  - Updated `GameForm.tsx` handlers (`switchPlatform`, `handleAddPlatform`, `handleRemovePlatform`) to delegate to extracted utilities while preserving behavior.
  - Fixed typed default settings in the new utility module using `satisfies NonNullable<GameFormData['settings']>` to keep literal union compatibility.
  - Validation: touched-file diagnostics clean; `pnpm --filter @dillinger/core test` passes (14/14); lint remains warnings-only baseline (`192` warnings).
  - Line-count progress: `GameForm.tsx` reduced from `1478` lines to `1382` lines in this pass.

  ### 2026-02-17 — Phase 9 additional extraction pass (selection/file handlers)
  - Added `app/components/game-form-selection-utils.ts` and moved selection/file mutation helpers out of `GameForm.tsx` (`applyShortcutSelection`, `applyFileExplorerSelection`, `applyRomFileSelection`, `ROMS_BROWSE_PATH`).
  - Updated `GameForm.tsx` handlers (`handleSelectShortcut`, `handleFileExplorerSelect`, `handleRomFileSelect`, `getRomsBrowsePath`) to delegate to extracted utility functions.
  - Validation: touched-file diagnostics clean; `pnpm --filter @dillinger/core test` passes (14/14); lint remains warnings-only baseline (`192` warnings).
  - Line-count progress: `GameForm.tsx` reduced from `1382` lines to `1358` lines in this pass.

  ### 2026-02-17 — Phase 10.1 manual launch env regression verification
  - Ran a live Wine launch via `POST /api/launch/gog-close-combat-3-the-russian-front-1981721026` (local mode, `keepAlive=true`) and captured `docker inspect` from session `3a80b35a-aa60-4b08-9d08-e64a12500b86` / container `4c4b9ea1faaf6eaeaee6df94bce89c219a128e62ae98dea9be935e5bb9664265`.
  - Verified expected launch env keys remained present in container config: core/session (`GAME_ID`, `SESSION_ID`, `SAVES_PATH`), runtime (`PUID`, `PGID`, `KEEP_ALIVE`, `GPU_VENDOR`), Wine (`WINEDEBUG`, `WINEPREFIX`, `GAME_EXECUTABLE`, `GAME_ARGS`, `WINEARCH`), and rendering/display (`WINE_D3D_RENDERER`, `WAYLAND_DISPLAY`, `XDG_RUNTIME_DIR`, `QT_QPA_PLATFORM`, `GDK_BACKEND`, `SDL_VIDEODRIVER`, PulseAudio vars).
  - Compared runtime inspect output against the Phase 10.1 launch-env checklist and confirmed no baseline key removals/renames in the current launch path.

  ### 2026-02-17 — Phase 9.2 automated section-render verification
  - Added `tests/services/wine-sections-phase-render.test.ts` to validate phase-gated lock placeholder behavior for `WineRenderingSection`, `WineMakeItRunSection`, and `WinePerformanceSection`.
  - New assertions cover both locked (`needs_install`) and unlocked (`ready`) render states, verifying lock placeholders appear only when expected and unlocked controls are present otherwise.
  - Validation: `pnpm --filter @dillinger/core test` passes (`16/16`), and lint remains warnings-only baseline (`190` warnings, `0` errors).
  - Attempted browser-driven phase walkthrough automation with Playwright against `/games/{id}/edit`, but this workspace does not currently include `@playwright/test`; visual checklist item remains pending manual in-browser confirmation.

  ### 2026-02-17 — Phase 11.1 explainer coverage completion
  - Verified existing explainer copy is already present across Wine install/rendering/performance/MakeItRun flows (Wine version, UMU, architecture, DXVK/VKD3D, DLL overrides, winetricks, gamescope, MangoHUD, post-install executable picker, and compatibility intelligence).
  - Added explicit ProtonDB tier guide copy in `WineInstallWizard` so badge meaning is clear at a glance.
  - Validation: `pnpm --filter @dillinger/core test` passes (`16/16`); lint remains warnings-only baseline (`190` warnings, `0` errors).

  ### 2026-02-17 — Phase 11.2 transition animations
  - Added sidebar unlock animation via opacity transition in `GameFormSidebar` (`transition-all`, `duration-300`) so disabled → enabled state changes are visibly smoother.
  - Added phase status color transition in `WineStatusBanner` (`transition-colors`, `duration-300`) so banner background/border/text shifts are animated between states.
  - Added step advance slide/fade transition in `WineInstallWizard` using lightweight step-direction state and translated opacity transitions for Next/Back step changes.
  - Added Compatibility Intelligence skeleton→content fade in `WineInstallWizard` by delaying card opacity reveal once loading completes.

  ### 2026-02-17 — Final verification progress (V9/V12)
  - Ran `pnpm index:protonfixes`; generator completed successfully and produced valid JSON at `packages/dillinger-core/assets/generated/protonfixes-index.json` with `487` indexed fixes.
  - Ran full workspace verification from repo root: `pnpm test && pnpm lint` passed (warnings-only lint baseline, no lint errors).
  - Attempted route-level phase matrix check against `/games/{id}/edit`; lock placeholders are client-rendered and not present in raw server HTML, so the dedicated manual visual checkbox remains open for in-browser confirmation.

  ### 2026-02-17 — Phase 9 additional extraction pass (constants + section config)
  - Added `app/components/game-form-constants.ts` and moved static form constants out of `GameForm.tsx` (`RETROARCH_PLATFORMS`, `ROM_PLATFORMS`, `COMMON_WINETRICKS_VERBS`).
  - Moved section-definition logic into `getFormSections()` in the same module and updated `GameForm.tsx` to consume it.
  - Validation: touched-file diagnostics clean; `pnpm --filter @dillinger/core test` passes (14/14); lint remains warnings-only baseline (`192` warnings).
  - Line-count progress: `GameForm.tsx` reduced from `1358` lines to `1298` lines in this pass.

  ### 2026-02-17 — Phase 9 additional extraction pass (section navigation hook)
  - Added `app/components/useSectionNavigation.ts` and moved section navigation behavior out of `GameForm.tsx` (scroll-to-section + IntersectionObserver active-section tracking).
  - Updated `GameForm.tsx` to consume the hook and remove inline observer logic.
  - Validation: touched-file diagnostics clean; `pnpm --filter @dillinger/core test` passes (14/14); lint remains warnings-only baseline (`192` warnings).
  - Line-count progress: `GameForm.tsx` reduced from `1298` lines to `1261` lines in this pass.

  ### 2026-02-17 — Phase 9 additional extraction pass (async actions + typing cleanup)
  - Added `app/components/game-form-async-actions.ts` and moved refresh/launch async implementation out of `GameForm.tsx` (`fetchLatestScraperData`, `mergeRefreshedScraperData`, `launchGameLocally`).
  - Updated `GameForm.tsx` handlers (`handleRefreshFromScraper`, `handleQuickLaunch`) to delegate to extracted async helpers.
  - Removed the remaining explicit-`any` in `GameForm` by typing loaded platform arrays with `GamePlatformConfig`.
  - Validation: touched-file diagnostics clean; `pnpm --filter @dillinger/core test` passes (14/14).
  - Lint baseline improved from `192` to `190` warnings (still warnings-only, 0 errors).
  - Line-count progress: `GameForm.tsx` reduced from `1261` lines to `1216` lines in this pass.

  ### 2026-02-17 — Phase 9 additional extraction pass (MakeItRun action APIs)
  - Added `app/components/game-form-makeitrun-actions.ts` and moved MakeItRun API workflows out of `GameForm.tsx` (`fetchCompatibilitySummary`, `applyCompatibilitySummary`, `exportMakeItRunToml`, `importMakeItRunToml`).
  - Updated `GameForm.tsx` handlers (`handleMakeItRunAutoDetect`, `handleExportMakeItRunToml`, `handleImportMakeItRunToml`) to delegate to extracted helpers while preserving UI state handling and messaging.
  - Validation: touched-file diagnostics clean; `pnpm --filter @dillinger/core test` passes (14/14); lint remains warnings-only baseline (`190` warnings).
  - Line-count progress: `GameForm.tsx` reduced from `1216` lines to `1153` lines in this pass.

  ### 2026-02-17 — Phase 9 additional extraction pass (state mutation helpers)
  - Added `app/components/game-form-mutation-utils.ts` and moved local state mutation helpers out of `GameForm.tsx` (`updateMameOverridesState`, `selectImageState`, `applyDllQuickAddState`, `buildSaveDownloadUrl`).
  - Updated `GameForm.tsx` handlers (`updateMameOverrides`, `selectImage`, `applyDllQuickAdd`, `downloadSave`) to delegate to extracted helpers.
  - Validation: touched-file diagnostics clean; `pnpm --filter @dillinger/core test` passes (14/14); lint remains warnings-only baseline (`190` warnings).
  - Line-count progress: `GameForm.tsx` reduced from `1153` lines to `1092` lines in this pass.

  ### 2026-02-17 — Phase 9 additional extraction pass (submit payload/actions)
  - Added `app/components/game-form-submit-utils.ts` and moved submission payload construction + submit request logic out of `GameForm.tsx` (`buildGameSubmitPayload`, `submitGamePayload`).
  - Updated `handleSubmit` in `GameForm.tsx` to delegate to extracted submit utilities while preserving success/error flow and routing behavior.
  - Validation: touched-file diagnostics clean; `pnpm --filter @dillinger/core test` passes (14/14); lint remains warnings-only baseline (`190` warnings).
  - Line-count progress: `GameForm.tsx` reduced from `1092` lines to `1016` lines in this pass.

  ### 2026-02-17 — Phase 9 additional extraction pass (change handler utility)
  - Added `app/components/game-form-change-utils.ts` and moved `handleChange` branching logic out of `GameForm.tsx` (`applyInputChange`).
  - Updated `GameForm.tsx` to delegate input updates through the shared change utility.
  - Validation: touched-file diagnostics clean; `pnpm --filter @dillinger/core test` passes (14/14); lint remains warnings-only baseline (`190` warnings).
  - Line-count progress: `GameForm.tsx` reduced from `1016` lines to `966` lines in this pass.

  ### 2026-02-17 — Phase 9.2 phase-gating follow-up
  - Updated `GameForm.tsx` to pass `winePhase` into `WineRenderingSection`, `WineMakeItRunSection`, and `WinePerformanceSection`.
  - Updated `WineRenderingSection.tsx` to self-gate on `phase` and render a locked placeholder until install-capable phases.
  - Updated `WineMakeItRunSection.tsx` to self-gate on `phase` and render a locked placeholder until install-capable phases.
  - Updated `WinePerformanceSection.tsx` to combine explicit lock state with `phase` lock semantics.
  - Validation: touched-file diagnostics clean; `pnpm --filter @dillinger/core test` passes (14/14); lint remains warnings-only baseline (`190` warnings); `GameForm.tsx` remains under target at `969` lines.
