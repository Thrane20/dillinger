# Plan: Wine Game UX & MakeItRun Overhaul

## TL;DR

Overhaul the Wine game installation and configuration experience in Dillinger to be wizard-driven, state-aware, and intuitive. Replace the current monolithic `GameForm.tsx` settings dump with a clear state machine (Not Installed → Installing → Post-Install → Ready to Run), a full-page installation wizard with automatic **Compatibility Intelligence** lookups (protonfixes, Lutris, ProtonDB, PCGamingWiki), locked/dimmed sidebar sections based on install state, a new "MakeItRun" TOML config format for shareable game compatibility configs, and a community API spec for sharing configs on a future DillingerGaming website. Remove deprecated Old GOG/DirectDraw presets, add a new "Performance" section for Gamescope/MangoHUD, and rename "Wine Advanced" to "MakeItRun Config".

**Key decisions:**
- MakeItRun TOML files stored at `/data/storage/makeitrun/{slug}.toml`
- Full-page wizard for installation (replaces dialog)
- State shown via top banner + sidebar indicators
- Wine Advanced → "MakeItRun Config" (protonfixes, UMU, Lutris, DLLs, winetricks, registry)
- New "Performance" sidebar section for Gamescope + MangoHUD
- Full community API spec designed now, implemented later
- umu-protonfixes as git submodule in `third_party/` with Python AST indexer + TypeScript fallback parser
- Auto-lookup against protonfixes/Lutris/ProtonDB at install wizard entry, with global setting to disable (falls back to manual button)
- No regression to existing Wine launch flow

---

## Steps

### Phase 1: Game State Machine & Status Banner

**1.1 — Define canonical game states**

Add a derived state enum to [packages/shared/src/types/game.ts](packages/shared/src/types/game.ts) alongside the existing `installation.status`:

```
WineGamePhase = 
  | 'needs_install'       // No installation or status === 'not_installed'
  | 'installing'          // status === 'installing', container running
  | 'install_failed'      // status === 'failed'
  | 'post_install'        // status === 'installed' BUT no launch command set
  | 'needs_configuration' // Installed, has launch command, but no MakeItRun config or known issues
  | 'ready'               // Installed, configured, launchable
  | 'running'             // Active session exists
```

Add a pure function `deriveWinePhase(game, platformConfig): WineGamePhase` in [packages/shared/src/utils/](packages/shared/src/utils/) that computes the phase from the game's `installation.status`, `settings.launch.command`, and presence of a MakeItRun config.

**1.2 — Status banner component**

Create `WineStatusBanner.tsx` in [packages/dillinger-core/app/components/](packages/dillinger-core/app/components/):

- Full-width banner at top of the edit page (above sidebar + content)
- Color-coded by phase:
  - `needs_install` → amber, "This game needs to be installed before you can play it. Click Install to begin."
  - `installing` → blue animated, "Installation in progress…" with link to monitor
  - `install_failed` → red, "Installation failed. Review logs and try again."
  - `post_install` → amber, "Installed but not yet configured. Select the executable to launch."
  - `needs_configuration` → yellow, "Installed — consider applying a MakeItRun config for best compatibility."
  - `ready` → green, "Ready to play" with a prominent Launch button
  - `running` → green pulse, "Currently running" with session link
- Small explainer text below each state message (e.g., "Wine games need a Windows prefix to be created first. This process can take several minutes.")

**1.3 — Sidebar section locking**

In [packages/dillinger-core/app/components/GameForm.tsx](packages/dillinger-core/app/components/GameForm.tsx), update the `WINE_SECTIONS` array (currently at [L230–245](packages/dillinger-core/app/components/GameForm.tsx#L230)):

New sidebar order:
```
1. 📋 Basic Information        — always accessible
2. 📦 Installation             — always accessible (changes label to "✅ Installed" after install)
3. 🎨 Rendering                — locked until installed
4. 🔧 MakeItRun Config         — locked until installed (was "Wine Advanced")
5. ⚡ Performance              — locked until installed (Gamescope + MangoHUD, new section)
6. 📖 Game Information         — always accessible (screenshots moved here)
```

Add a `disabled` property to each section object, computed from `WineGamePhase`. Locked sections render with `opacity-40 pointer-events-none` and a 🔒 icon. Clicking a locked section shows a tooltip: "Install the game first to access these settings."

---

### Phase 2: Full-Page Installation Wizard

**2.1 — Create install wizard route**

Create [packages/dillinger-core/app/games/[id]/install/page.tsx](packages/dillinger-core/app/games/%5Bid%5D/install/page.tsx):

- Full-page layout with stepper UI (replaces `InstallGameDialog` modal)
- Navigate here from the "Install" button in the edit page's Installation section
- After install completes, remain on this page with post-install configurators visible

**2.2 — Wizard steps**

The wizard component `WineInstallWizard.tsx` in [packages/dillinger-core/app/components/](packages/dillinger-core/app/components/):

**Step 1: Compatibility Intelligence** *(new — see Phase 3 for details)*
- Auto-fires lookups against UMU database, protonfixes index, Lutris API, ProtonDB
- Shows results in a "Compatibility Report" panel
- User can accept/modify suggested fixes before proceeding
- Skippable (and replaced by a manual "Check Compatibility" button if auto-lookup is disabled in global settings)

**Step 2: Choose Installation Method**
- Radio cards: "Lutris Installer" (recommended when available, pre-populated from Step 1) / "Standard Installer" / "Manual (Advanced)"
- Explainer: _"Lutris installers are community-tested scripts that automate game setup including DLL overrides, winetricks, and registry tweaks. We recommend using a Lutris installer when available."_
- If Lutris installers exist, show them with badges (winetricks count, DLL overrides, arch)
- Pre-select the Lutris installer if Compatibility Intelligence found one

**Step 3: Select Installer File**
- File picker with GOG cache auto-detection (reuse existing logic from [InstallGameDialog.tsx L260–340](packages/dillinger-core/app/components/InstallGameDialog.tsx#L260))
- Explainer: _"Select the Windows installer (.exe, .msi) you downloaded. GOG installers from your cache are shown automatically."_
- Show file size, detected type (GOG setup, Inno Setup, MSI, etc.)

**Step 4: Wine Configuration**
- Wine version selector (reuse `WineVersionSelector` from [WineVersionSelector.tsx](packages/dillinger-core/app/components/WineVersionSelector.tsx))
- Architecture: win32/win64 radio (default from Lutris script or protonfixes if available)
- UMU Game ID field (auto-populated from Compatibility Intelligence lookup)
- Explainer: _"GE-Proton includes community patches (protonfixes) that automatically fix known game issues. The UMU Game ID links your game to these fixes."_

**Step 5: Install Directory**
- Volume quick-select (reuse existing `dillinger_installed_*` volume logic)
- Custom path option
- Estimated space display
- Explainer: _"Each game gets its own Wine prefix (a virtual Windows environment). Choose a Docker volume with enough space."_

**Step 6: Review & Install**
- Summary card showing all selections, including Compatibility Intelligence fixes that will be applied
- Debug mode toggle with explainer: _"Debug mode keeps the container running after installation for troubleshooting."_
- "Install" button triggers `POST /api/games/{id}/install`
- Transitions to install monitor (step 7)

**Step 7: Installation Monitor (inline, not modal)**
- Reuse log streaming logic from [WineInstallationMonitorModal.tsx](packages/dillinger-core/app/components/WineInstallationMonitorModal.tsx) but render inline
- Progress indicators, live logs, activity detection
- On completion, auto-advance to Step 8

**Step 8: Post-Install Configuration**
- Auto-scan for `.exe` files (existing logic from install GET route at [packages/dillinger-core/app/api/games/[id]/install/route.ts](packages/dillinger-core/app/api/games/%5Bid%5D/install/route.ts))
- Present executable list with smart recommendations:
  - Highlight Lutris-detected `game.exe` path
  - Highlight protonfixes `replace_command` target if available
  - Filter out common non-game executables (uninstaller, setup, config, DirectX, vcredist)
  - Group by directory
- "Shortcut finder" and "Browse install folder" tools available
- Explainer: _"Select the main game executable. Look for the game's .exe file — usually NOT inside 'setup' or 'redist' folders. Files like Uninstall.exe or dxsetup.exe are installers, not the game."_
- "Done" button returns to `/games/{id}/edit` with installation section now read-only

**2.3 — Deprecate `InstallGameDialog`**

Keep [InstallGameDialog.tsx](packages/dillinger-core/app/components/InstallGameDialog.tsx) for now but mark as `@deprecated`. All Wine installs route to the new wizard. Non-Wine platforms can continue using the dialog if needed.

**2.4 — Reinstall flow**

On the edit page's Installation section (when `status === 'installed'`):
- Section renders as read-only summary: Wine version, install method, install path, Lutris installer used
- Prominent "Reinstall" button (styled as destructive action)
- Clicking "Reinstall" shows a confirmation dialog, then navigates to `/games/{id}/install` with the prefix cleared
- The launch command field remains editable even while Installation is read-only

---

### Phase 3: Compatibility Intelligence (NEW)

The core new feature — automatic lookup of game fixes from multiple community databases, presented as a unified "Compatibility Report" during installation.

**3.1 — Add umu-protonfixes as git submodule**

```
third_party/umu-protonfixes/   ← git submodule of https://github.com/Open-Wine-Components/umu-protonfixes
```

Alongside existing `third_party/wolf/` and `third_party/gow/`. Add to `.gitmodules`:
```
[submodule "third_party/umu-protonfixes"]
    path = third_party/umu-protonfixes
    url = https://github.com/Open-Wine-Components/umu-protonfixes.git
```

**3.2 — Python AST indexer (build-time tool)**

Create `scripts/index-protonfixes.py` — a standalone Python script that:

1. Walks all `gamefixes-{store}/` directories in `third_party/umu-protonfixes/`
2. For each `.py` file (excluding `__init__.py`, `default.py`):
   - Detects symlinks → records cross-reference (e.g., `gog:umu-1209025141` → `steam:1151640`)
   - Uses Python `ast` module to parse the script's AST
   - Extracts all `util.*()` calls and their arguments:
     - `util.protontricks('verb')` → `winetricks: ["verb"]`
     - `util.winedll_override('dll', util.OverrideOrder.NATIVE)` → `dll_overrides: {"dll": "native"}`
     - `util.set_environment('KEY', 'VAL')` → `env_vars: {"KEY": "VAL"}`
     - `util.del_environment('KEY')` → `del_env_vars: ["KEY"]`
     - `util.replace_command('from', 'to')` → `command_replacements: [{"from": "...", "to": "..."}]`
     - `util.regedit_add(path, name, type, value)` → `registry: [...]`
     - `util.disable_nvapi()` → `flags: ["disable_nvapi"]`
     - `util.disable_esync()` → `flags: ["disable_esync"]`
     - `util.disable_fsync()` → `flags: ["disable_fsync"]`
     - `util.set_dxvk_option(k, v)` → `dxvk_options: {"k": "v"}`
     - `util.install_eac_runtime()` → `flags: ["install_eac"]`
     - `util.install_battleye_runtime()` → `flags: ["install_battleye"]`
   - Flags `has_complex_logic: true` if the script contains conditionals, loops, or file I/O beyond the extractable patterns
3. Parses `umu-database.csv` (or fetches from the UMU database subproject) for title/store/UMU_ID mappings
4. Outputs a single JSON index file:

```json
// packages/dillinger-core/assets/generated/protonfixes-index.json
{
  "generated_at": "2026-02-17T12:00:00Z",
  "commit": "abc123",
  "fixes": {
    "steam:1151640": {
      "title": "Horizon Zero Dawn",
      "stores": ["steam", "gog"],
      "gog_ids": ["1209025141"],
      "winetricks": ["vcrun2019"],
      "dll_overrides": {},
      "env_vars": {},
      "del_env_vars": [],
      "command_replacements": [],
      "registry": [],
      "dxvk_options": {},
      "flags": [],
      "has_complex_logic": false,
      "script_path": "gamefixes-steam/1151640.py",
      "notes": ""
    },
    "steam:65540": {
      "title": "Gothic",
      "stores": ["steam"],
      "winetricks": ["directmusic"],
      "dll_overrides": {"dsound": "builtin", "ddraw": "native,builtin", "dinput": "native,builtin"},
      "env_vars": {"PULSE_LATENCY_MSEC": "90"},
      "has_complex_logic": true,
      "notes": "Also patches Gothic.ini for resolution"
    }
  },
  "cross_references": {
    "gog:1209025141": "steam:1151640"
  },
  "umu_database": {
    "gog:1207658883": {"title": "Age of Wonders", "umu_id": "umu-61500"},
    "gog:1209025141": {"title": "Horizon Zero Dawn", "umu_id": "umu-1151640"}
  }
}
```

**Coverage**: Python AST parsing covers ~95% of fix scripts. The remaining ~5% with complex runtime logic are flagged `has_complex_logic: true` with a note for the user.

**Trigger**: Run via `pnpm run index:protonfixes` (added to root `package.json`). Also runs automatically during `pnpm build`. The generated JSON is committed to the repo (or generated at Docker build time).

**3.3 — TypeScript fallback parser**

Create [packages/dillinger-core/lib/services/protonfixes-parser.ts](packages/dillinger-core/lib/services/protonfixes-parser.ts):

- Loads and queries `protonfixes-index.json` (generated by the Python indexer)
- Fallback: if the index is stale/missing, parses `.py` files directly using regex:
  - `/util\.protontricks\(['"](.*?)['"]\)/g` → winetricks
  - `/util\.winedll_override\(['"](.*?)['"],\s*(?:util\.)?OverrideOrder\.(\w+)\)/g` → DLL overrides
  - `/util\.set_environment\(['"](.*?)['"],\s*['"](.*?)['"]\)/g` → env vars
  - `/util\.replace_command\(['"](.*?)['"],\s*['"](.*?)['"]\)/g` → command replacements
  - `/util\.regedit_add\(['"](.*?)['"],/g` → registry (partial)
- ~85% coverage with regex alone (enough for most games)

Key functions:
- `lookupByGogId(gogId: string): ProtonfixEntry | null` — looks up via `cross_references` and `umu_database`
- `lookupBySteamAppId(appId: string): ProtonfixEntry | null`
- `lookupByTitle(title: string): ProtonfixEntry[]` — fuzzy search across `umu_database` titles
- `lookupBySlug(slug: string): ProtonfixEntry | null` — checks `gamefixes-umu/` entries

**3.4 — Compatibility Intelligence service**

Create [packages/dillinger-core/lib/services/compatibility-service.ts](packages/dillinger-core/lib/services/compatibility-service.ts):

Orchestrates lookups across ALL sources and returns a unified `CompatibilityReport`:

```typescript
interface CompatibilityReport {
  game: { title: string; slug: string; gogId?: string; steamAppId?: string };
  sources: CompatibilitySource[];
  merged: MergedFixes;        // De-duplicated union of all fixes
  protondbTier?: 'native' | 'platinum' | 'gold' | 'silver' | 'bronze' | 'borked';
  protondbConfidence?: string;
  protondbTotal?: number;
  confidence: 'high' | 'medium' | 'low' | 'none';  // Overall confidence based on source coverage
}

interface CompatibilitySource {
  name: 'protonfixes' | 'lutris' | 'protondb' | 'pcgamingwiki';
  found: boolean;
  url?: string;           // Link to source page
  data?: ProtonfixEntry | LutrisInstallerSummary | ProtonDBSummary | PCGWData;
  error?: string;
}

interface MergedFixes {
  umuGameId?: string;
  winetricks: string[];         // Union from protonfixes + Lutris
  dllOverrides: Record<string, string>;  // Merged from all sources
  envVars: Record<string, string>;
  delEnvVars: string[];
  commandReplacements: Array<{ from: string; to: string }>;
  registry: Array<{ path: string; name: string; type: string; value: string }>;
  flags: string[];              // disable_esync, install_eac, etc.
  dxvkOptions: Record<string, string>;
  recommendedDxvk: boolean;     // From Lutris or PCGamingWiki DirectX version
  recommendedVkd3d: boolean;    // If DX12 detected
  recommendedArch: 'win32' | 'win64';
  suggestedExe?: string;        // From Lutris game.exe or protonfixes replace_command
  hasComplexFixes: boolean;     // If protonfixes script has complex logic
  complexFixNotes?: string;
}
```

**Lookup flow** (parallel where possible):

```
Input: game.title, game.slug, gogId (from game metadata)
  │
  ├─ 1. UMU Database API ──────────────────────────────────────┐
  │    GET https://umu.openwinecomponents.org/umu_api.php       │
  │    ?codename={gogId}&store=gog                              │
  │    → umuGameId, steamAppId                                  │
  │                                                             │
  ├─ 2. Protonfixes Index (local) ─────────────────────────────┤
  │    lookupByGogId(gogId) or lookupBySteamAppId(steamAppId)  │
  │    → winetricks, dll_overrides, env_vars, flags, etc.       │
  │                                                             │
  ├─ 3. Lutris API (existing service) ─────────────────────────┤
  │    searchLutrisInstallers(title, gogId)                      │
  │    → installers with winetricks, DLLs, arch, exe            │
  │                                                             │
  ├─ 4. ProtonDB API ─────────────────────────────────────────┤
  │    GET protondb.com/api/v1/reports/summaries/{steamAppId}   │
  │    → tier, confidence, total reports                        │
  │                                                             │
  └─ 5. PCGamingWiki Cargo API (optional) ─────────────────────┘
       ?tables=API&where=Steam_AppID HOLDS "{steamAppId}"
       → DirectX version → recommend DXVK vs VKD3D
       ?tables=Middleware → DRM/anti-cheat warnings
```

Steps 1 is sequential (need steamAppId from UMU DB for steps 2/4/5). Steps 2-5 run in parallel after step 1.

**Caching**: Results cached at `/data/storage/cache/compat/{slug}.json` with a 7-day TTL. Cache busted on submodule update.

**3.5 — Global auto-lookup setting**

Add to [packages/dillinger-core/app/settings/](packages/dillinger-core/app/settings/) a new setting:

- **Auto-check compatibility databases** (checkbox, default: ON)
- Stored in the global Dillinger settings (existing settings JSON at `/data/storage/settings.json` or equivalent)
- Explainer: _"Automatically query community databases (protonfixes, Lutris, ProtonDB) when installing a Wine game. Disable this if you prefer to check manually or have limited internet."_
- When OFF: The wizard's Step 1 (Compatibility Intelligence) shows a manual "Check Compatibility" button instead of auto-firing

**3.6 — Compatibility Intelligence API route**

Create [packages/dillinger-core/app/api/compatibility/[gameId]/route.ts](packages/dillinger-core/app/api/compatibility/%5BgameId%5D/route.ts):

| Method | Purpose |
|--------|---------|
| GET | Run compatibility lookup for a game, return `CompatibilityReport` |
| POST | Re-run lookup (bust cache) |

The GET endpoint:
- Reads the game's metadata (title, slug, GOG ID from game JSON or metadata)
- Calls `compatibilityService.lookup(game)`
- Returns the full `CompatibilityReport`
- Caches the result

**3.7 — Compatibility Intelligence UI (Wizard Step 1)**

Within `WineInstallWizard.tsx`, Step 1 renders:

**Header**: "Compatibility Intelligence"
**Explainer**: _"We're checking community databases for known fixes and configurations for this game. This helps ensure the best experience out of the box."_

**Layout**: Card-based, one card per source:

**Card: UMU Protonfixes** (🔧)
- Status: Found / Not Found
- If found: UMU Game ID, list of winetricks verbs, DLL overrides, env vars
- Badge: "Auto-applied when using GE-Proton" if `umuGameId` is set
- If `has_complex_logic`: warning icon with note: "This game has advanced fixes that run automatically with GE-Proton. Some fixes couldn't be fully extracted."

**Card: Lutris** (🎮)
- Status: X installers found / None found
- If found: List of installers with badges (winetricks count, arch, DLLs)
- Pre-selects the best-matching GOG installer

**Card: ProtonDB** (📊)
- Status: Tier badge (Platinum/Gold/Silver/Bronze/Borked) with color
- Confidence level, number of reports
- Link: "View on ProtonDB →"
- If no Steam App ID: "Not available for GOG-only games without a Steam equivalent"

**Card: PCGamingWiki** (📖)
- Status: Found / Not Found
- If found: DirectX version detected (→ auto-recommend DXVK or VKD3D), DRM/anti-cheat warnings
- Link: "View on PCGamingWiki →"

**Merged Fixes Summary** (bottom of Step 1):
- "Based on community data, we recommend these settings:" 
- Expandable list of all merged fixes grouped by category (winetricks, DLLs, env vars, registry)
- Each fix has a checkbox so the user can include/exclude individual items
- "Apply All Recommendations" button (default) vs "Customize" toggle
- These selections carry forward to all subsequent wizard steps and are written into the MakeItRun TOML on completion

**3.8 — Protonfixes index pnpm scripts**

Add to root [package.json](package.json):
```
"index:protonfixes": "python3 scripts/index-protonfixes.py",
"prebuild": "pnpm index:protonfixes"
```

Add to [docker/dillinger-core/Dockerfile](docker/dillinger-core/Dockerfile) a build step that runs the indexer (Python3 is available in the Node.js base images or can be added as `python3-minimal`).

**3.9 — Update submodule refresh flow**

Create `scripts/update-protonfixes.sh`:
```bash
#!/bin/bash
cd third_party/umu-protonfixes && git pull origin master
cd ../..
python3 scripts/index-protonfixes.py
```

Add to root `package.json`: `"update:protonfixes": "bash scripts/update-protonfixes.sh"`

---

### Phase 4: Section Reordering & Screenshots

**4.1 — Move screenshots into Game Information**

Current position: [GameForm.tsx L1473–1582](packages/dillinger-core/app/components/GameForm.tsx#L1473-L1582) (between Basic Info and Install Config).

Move the screenshot carousel into the "Game Information" section (currently at [L2708+](packages/dillinger-core/app/components/GameForm.tsx#L2708)), placing it after the description/genre/developer fields.

Reduce carousel container size: change from `aspect-video` (16:9 full-width) to a constrained `max-w-2xl` container with `aspect-video` or `max-h-64`.

**4.2 — Reorder edit page sections**

After reordering, the `GameForm.tsx` section rendering order for Wine games becomes:

1. **Status Banner** (new — `WineStatusBanner`)
2. **📋 Basic Information** — title, slug, platform selector, tags, cover image
3. **📦 Installation / ✅ Installed** — install state, launch command, browse tools (read-only when installed, "Reinstall" button)
4. **🎨 Rendering** — DXVK, VKD3D-Proton, Wine renderer, virtual desktop, xrandr (locked until installed)
5. **🔧 MakeItRun Config** — protonfixes, UMU, Lutris config, DLL overrides, winetricks, registry (locked until installed)
6. **⚡ Performance** — Gamescope, MangoHUD (locked until installed, new section)
7. **📖 Game Information** — description, metadata, screenshots carousel, display images, scraper data

---

### Phase 5: Wine Advanced → MakeItRun Config Overhaul

**5.1 — Remove deprecated presets**

Delete from [GameForm.tsx](packages/dillinger-core/app/components/GameForm.tsx):
- `applyOldGogVideoCompatibilityPreset` function ([L865–882](packages/dillinger-core/app/components/GameForm.tsx#L865-L882))
- `applyDirectDrawCompatibilityPreset` function ([L883–907](packages/dillinger-core/app/components/GameForm.tsx#L883-L907))
- Associated UI buttons in the Wine Advanced section ([L2128–2165](packages/dillinger-core/app/components/GameForm.tsx#L2128-L2165))

**5.2 — New MakeItRun Config section contents**

Rename sidebar entry from "Wine Advanced" to "MakeItRun Config" with 🔧 icon.

Section layout:

**A. Protonfixes & UMU Configuration**
- UMU Game ID field (moved from WineVersionSelector, now prominent)
- "Auto-detect" button that queries `GET /api/compatibility/{gameId}` and auto-fills
- Protonfixes badge: shows what the protonfixes script will do (from the index)
- If `has_complex_logic`: info banner explaining that GE-Proton will run the full fix script automatically
- Explainer: _"Protonfixes are community-maintained patches that automatically fix compatibility issues. Setting the correct UMU Game ID links your game to these fixes when using GE-Proton."_
- Link to browse protonfixes on GitHub

**B. Lutris Configuration (if Lutris installer was used)**
- Read-only summary of what the Lutris script configured
- "Re-apply Lutris Config" button to re-run parsed config
- "Change Lutris Installer" link → re-opens installer selection
- Explainer: _"Lutris scripts are curated by the community and include tested configuration for this game."_

**C. Winetricks**
- Keep existing dynamic list UI from [L2199–2268](packages/dillinger-core/app/components/GameForm.tsx#L2199-L2268)
- Add verb search/autocomplete (fetch verb list from winetricks)
- Pre-populated from Compatibility Intelligence if fixes were accepted
- Explainer: _"Winetricks installs Windows components like DirectX, .NET Framework, Visual C++ runtimes. Add verbs your game requires."_

**D. DLL Overrides**
- Keep existing `WINEDLLOVERRIDES` text input from [L2171–2195](packages/dillinger-core/app/components/GameForm.tsx#L2171-L2195)
- Add a helper that shows common DLL override patterns (ddraw, d3d9, quartz, etc.) as clickable chips
- Pre-populated from Compatibility Intelligence
- Explainer: _"DLL overrides control which version of a Windows library Wine uses. 'native' uses the game's bundled DLL, 'builtin' uses Wine's. Format: dllname=native,builtin"_

**E. Environment Variables** (NEW)
- Key-value editor (add/remove rows) for extra env vars
- Pre-populated from protonfixes `set_environment` entries
- Explainer: _"Additional environment variables passed to the Wine container. Used for workarounds like PULSE_LATENCY_MSEC for audio issues."_

**F. Registry Settings**
- Keep existing dynamic editor from [L2277–2413](packages/dillinger-core/app/components/GameForm.tsx#L2277-L2413)
- Pre-populated from protonfixes `regedit_add` entries
- No other changes needed

**G. Export/Import MakeItRun Config**
- "Export as TOML" button → generates TOML and saves to `/data/storage/makeitrun/{slug}.toml`
- "Import TOML" button → file upload or paste
- "Share" button (disabled, tooltip: "Coming soon — share on DillingerGaming")

---

### Phase 6: New Performance Section

**6.1 — Extract Gamescope + MangoHUD**

Move Gamescope UI from [GameForm.tsx L2420–2705](packages/dillinger-core/app/components/GameForm.tsx#L2420-L2705) into a new `WinePerformanceSection.tsx` component.

Contents:
- **Gamescope** toggle + all existing sub-fields (output resolution, internal resolution, refresh rate, upscaler FSR/NIS, fullscreen, FPS limit)
- **MangoHUD** toggle (from [L2679–2704](packages/dillinger-core/app/components/GameForm.tsx#L2679-L2704))
- Explainer: _"Gamescope is a micro-compositor that provides resolution scaling, frame limiting, and HDR support. MangoHUD shows a real-time performance overlay."_

Locked until game is installed (same gating as Rendering section).

---

### Phase 7: MakeItRun TOML Format & Storage

**7.1 — Define TOML schema**

Create [packages/dillinger-core/assets/schema/makeitrun-v1.0.toml](packages/dillinger-core/assets/schema/makeitrun-v1.0.toml) as a reference template:

```toml
# Dillinger MakeItRun Configuration v1
# Game compatibility & installation config
# https://dillinger.gaming/makeitrun (future)

schema_version = "1.0"
slug = "gog-dragons-lair-trilogy-2083200433"
title = "Dragon's Lair Trilogy"
author = ""
created = "2026-02-17T00:00:00Z"
updated = "2026-02-17T00:00:00Z"

[sources]
# Which community sources contributed to this config
protonfixes_id = "steam:1151640"           # UMU protonfixes script used
lutris_installer_id = "dragons-lair-gog"   # Lutris installer used
protondb_tier = "gold"                     # ProtonDB rating at time of creation
pcgamingwiki_dx_version = "DirectX 9"      # DirectX version from PCGamingWiki

[install]
method = "lutris"                          # "lutris" | "standard" | "manual"
lutris_installer_slug = "dragons-lair-trilogy-gog"
architecture = "win64"                     # "win32" | "win64"
wine_version_hint = "ge-proton"            # Suggested Wine version type
installer_args = "/VERYSILENT"             # Silent install arguments

[protonfixes]
umu_game_id = "umu-1151640"
enabled = true
has_complex_logic = false
notes = "Protonfixes applies vcrun2019 automatically"

[winetricks]
verbs = ["vcrun2019", "d3dx9", "dotnet48"]

[dll_overrides]
ddraw = "native,builtin"
d3d9 = "native"
quartz = "disabled"

[registry]

[[registry.entries]]
path = "HKEY_CURRENT_USER\\Software\\Wine\\Direct3D"
name = "MaxVersionGL"
type = "REG_DWORD"
value = "196610"

[environment]
STAGING_WRITECOPY = "1"
DXVK_STATE_CACHE = "1"
PULSE_LATENCY_MSEC = "90"

[environment.remove]
# Environment variables to explicitly unset
keys = ["SteamAppId"]

[rendering]
use_dxvk = true
dxvk_version = ""
use_vkd3d = false
vkd3d_version = ""
renderer = "vulkan"
virtual_desktop = ""

[performance]
use_gamescope = false
gamescope_width = 1920
gamescope_height = 1080
gamescope_refresh_rate = 60
gamescope_upscaler = ""
gamescope_fps_limit = 0
use_mangohud = false

[launch]
executable_hint = "drive_c/Program Files/Game/game.exe"
command_replacements = []                  # From protonfixes replace_command
arguments = ""
working_directory = ""

[flags]
# Boolean flags from protonfixes
disable_esync = false
disable_fsync = false
disable_nvapi = false
install_eac_runtime = false
install_battleye_runtime = false

[notes]
user_notes = ""
community_notes = ""
tested_on = ""
rating = 0
```

**7.2 — TOML parser/writer service**

Create [packages/dillinger-core/lib/services/makeitrun-service.ts](packages/dillinger-core/lib/services/makeitrun-service.ts):

- Add `smol-toml` package for TOML parsing/serialization (zero-dependency, ESM-compatible)
- `loadConfig(slug): MakeItRunConfig | null` — reads from `/data/storage/makeitrun/{slug}.toml`
- `saveConfig(slug, config): void` — writes TOML
- `deleteConfig(slug): void`
- `listConfigs(): MakeItRunConfigSummary[]` — lists all stored configs
- `generateFromGame(game, platformConfig): MakeItRunConfig` — extracts current settings into TOML struct
- `generateFromCompatReport(report: CompatibilityReport): MakeItRunConfig` — creates config from Compatibility Intelligence results
- `applyToGame(game, config): GamePlatformConfig` — merges TOML config into game's platform settings
- `importFromLutris(analysis: LutrisScriptAnalysis): Partial<MakeItRunConfig>` — converts Lutris analysis
- `importFromProtonfixes(entry: ProtonfixEntry): Partial<MakeItRunConfig>` — converts protonfixes index entry
- `mergeConfigs(base: MakeItRunConfig, overlay: Partial<MakeItRunConfig>): MakeItRunConfig` — merges two configs (union winetricks, merge DLLs, etc.)
- `validateConfig(config): ValidationResult` — schema validation

**7.3 — TypeScript types**

Add to [packages/shared/src/types/makeitrun.ts](packages/shared/src/types/makeitrun.ts):

- `MakeItRunConfig` interface matching the TOML schema above
- `MakeItRunConfigSummary` for listings (slug, title, author, rating, updated, sources)
- `MakeItRunImportSource = 'manual' | 'lutris' | 'protonfixes' | 'community' | 'compatibility_intelligence'`
- `ProtonfixEntry` — matches the protonfixes index JSON entries
- `CompatibilityReport` and `CompatibilitySource` interfaces (from 3.4)

**7.4 — Storage directory**

Have `JSONStorageService` in [packages/dillinger-core/lib/services/storage.ts](packages/dillinger-core/lib/services/storage.ts) create `/data/storage/makeitrun/` at init alongside existing `games`, `platforms`, etc. (at [L148](packages/dillinger-core/lib/services/storage.ts#L148)).

---

### Phase 8: MakeItRun API (Local + Community Spec)

**8.1 — Local CRUD API routes**

Create [packages/dillinger-core/app/api/makeitrun/](packages/dillinger-core/app/api/makeitrun/):

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/makeitrun` | GET | List all local MakeItRun configs |
| `/api/makeitrun` | POST | Create/import a new config |
| `/api/makeitrun/[slug]` | GET | Get config for a game |
| `/api/makeitrun/[slug]` | PUT | Update config |
| `/api/makeitrun/[slug]` | DELETE | Delete config |
| `/api/makeitrun/[slug]/apply` | POST | Apply config to the game's platform settings |
| `/api/makeitrun/[slug]/export` | GET | Download TOML file |
| `/api/makeitrun/generate/[gameId]` | POST | Generate config from current game settings |
| `/api/compatibility/[gameId]` | GET | Run Compatibility Intelligence lookup |
| `/api/compatibility/[gameId]` | POST | Re-run lookup (bust cache) |

**8.2 — Community sharing API spec (future implementation)**

Document in [docs/plans/spec-makeitrun-community-api.md](docs/plans/spec-makeitrun-community-api.md):

REST API for `api.dillinger.gaming/v1/makeitrun/`:

| Route | Method | Purpose |
|-------|--------|---------|
| `/v1/makeitrun/search` | GET | Search configs by game title, slug, platform, store |
| `/v1/makeitrun/{slug}` | GET | Get community configs for a game (array, sorted by rating) |
| `/v1/makeitrun/{slug}/{configId}` | GET | Get a specific community config |
| `/v1/makeitrun/` | POST | Submit a new config (requires auth) |
| `/v1/makeitrun/{slug}/{configId}/rate` | POST | Rate a config (1-5 stars) |
| `/v1/makeitrun/{slug}/{configId}/report` | POST | Report a broken config |
| `/v1/makeitrun/popular` | GET | Trending/most-downloaded configs |
| `/v1/makeitrun/recent` | GET | Recently submitted configs |
| `/v1/makeitrun/user/{userId}` | GET | Configs submitted by a user |
| `/v1/makeitrun/stats` | GET | Global stats (total configs, games covered, top contributors) |

**Response shape:**
```
{
  configs: MakeItRunConfig[],
  meta: { total, page, perPage },
  game: { title, slug, igdbId?, gogId?, steamAppId? }
}
```

**Medal system (like ProtonDB):**
- **Platinum**: Works perfectly out of the box with the config
- **Gold**: Works with minor tweaks
- **Silver**: Playable but with noticeable issues
- **Bronze**: Runs but with significant problems
- **Borked**: Does not run

**Authentication:** OAuth2 via future DillingerGaming accounts. Local Dillinger instances call with an API key (generated in settings).

**Sync flow:**
1. User clicks "Share" on local MakeItRun config
2. Local Dillinger POSTs config to community API
3. Other users search by game title → download TOML → import locally
4. Ratings aggregate over time
5. Local Dillinger can show "Community configs available" badge in the game list

---

### Phase 9: Refactor GameForm.tsx

**9.1 — Extract Wine sections into separate components**

The 3292-line [GameForm.tsx](packages/dillinger-core/app/components/GameForm.tsx) is too large. Extract:

- `WineStatusBanner.tsx` — phase banner (new)
- `WineInstallSection.tsx` — installation config + read-only installed state
- `WineRenderingSection.tsx` — DXVK, VKD3D, renderer, virtual desktop, xrandr
- `WineMakeItRunSection.tsx` — protonfixes, Lutris config, winetricks, DLLs, env vars, registry, export/import
- `WinePerformanceSection.tsx` — Gamescope + MangoHUD (new)
- `GameInfoSection.tsx` — description, metadata, screenshots, images, scraper

Each component receives `formData`, `setFormData`, `activeInstallation`, and `phase` as props. This makes `GameForm.tsx` a layout shell (<1000 lines).

**9.2 — Phase-gated rendering**

Each extracted section component checks `phase` and renders either its full UI or a locked placeholder. The section components handle their own explainer text.

---

### Phase 10: No-Regression Launch Verification

**10.1 — Preserve all existing env vars**

The Wine launch flow in [docker-service.ts](packages/dillinger-core/lib/services/docker-service.ts) (at [~L1700+](packages/dillinger-core/lib/services/docker-service.ts#L1700)) must continue pushing the same environment variables:

Verify these are unchanged:
- `WINEPREFIX`, `WINEARCH`, `WINEDEBUG`, `GAME_EXECUTABLE`, `GAME_ARGS`
- `WINE_VERSION_ID`, `UMU_GAME_ID`, `GAME_SLUG`
- `INSTALL_DXVK`, `DXVK_VERSION_ID`, `INSTALL_VKD3D`, `VKD3D_VERSION_ID`
- `WINE_DLL_OVERRIDES`, `WINEDLLOVERRIDES`
- `WINE_WINETRICKS`, `WINE_REGISTRY_SETTINGS`
- `WINE_COMPAT_MODE`, `WINE_VIRTUAL_DESKTOP`, `WINE_D3D_RENDERER`
- `USE_GAMESCOPE` + gamescope sub-vars, `ENABLE_MANGOHUD`
- `XRANDR_MODE`, `STREAMING_PRESET_ID`, `KEEP_ALIVE`

**10.2 — MakeItRun config applies through existing paths**

When a MakeItRun config is applied via `POST /api/makeitrun/{slug}/apply`, it writes values into the game's `GamePlatformConfig.settings` — the same fields that the launch route already reads. No changes to `launchGame()` or `wine-entrypoint.sh` are needed for Phase 1.

**10.3 — New env vars (additive only)**

Compatibility Intelligence may surface `environment` entries from protonfixes (e.g., `PULSE_LATENCY_MSEC`, `PROTON_NO_ESYNC`). These are added to the game's `settings.launch.environment` map and passed through the existing env var pipeline in `docker-service.ts`. The entrypoint already handles arbitrary env vars.

**10.4 — Automated test coverage**

Add tests in [packages/dillinger-core/](packages/dillinger-core/):
- `deriveWinePhase()` unit tests (all phase transitions)
- `makeitrun-service` unit tests (load, save, generate, apply, validate, merge)
- `MakeItRunConfig` TOML round-trip tests (parse → serialize → parse)
- `protonfixes-parser` unit tests (regex extraction against sample .py files)
- `compatibility-service` unit tests (mock API responses, verify merged output)
- Integration test: existing game JSON → apply MakeItRun → verify `GamePlatformConfig.settings` match expected env vars
- Regression test: mock launch with pre-existing game config → verify all env vars present

---

### Phase 11: UX Polish & Explainers

**11.1 — Wizard explainer text**

Add brief, helpful explainer text (small gray text, `text-xs text-gray-500`) throughout:

| Location | Explainer |
|----------|-----------|
| Wine Version selector | "GE-Proton includes community fixes. System Wine is simpler but may have fewer game patches." |
| UMU Game ID | "Links your game to protonfixes — community patches that auto-fix known issues." |
| Architecture selector | "Most modern games use 64-bit. Some older games (pre-2010) require 32-bit." |
| DXVK toggle | "Translates DirectX 9/10/11 calls to Vulkan for better performance on Linux." |
| VKD3D-Proton toggle | "Translates DirectX 12 to Vulkan. Only needed for DX12 games." |
| DLL Overrides | "Controls which DLL version Wine uses: 'native' = game's bundled DLL, 'builtin' = Wine's emulated DLL." |
| Winetricks | "Installs Windows components your game might need (DirectX, .NET, VC++ runtimes)." |
| Gamescope | "A micro-compositor for resolution scaling, frame limiting, and HDR. Useful for games that don't support all resolutions." |
| MangoHUD | "Shows an on-screen performance overlay (FPS, CPU/GPU usage, frame times)." |
| Post-install exe picker | "Choose the main game executable. Avoid files named 'setup', 'uninstall', or 'redist'." |
| Compatibility Intelligence | "We check community databases for known fixes. This data helps configure Wine for the best experience." |
| ProtonDB tier badge | "ProtonDB is a community database where users report how well games run on Linux." |

**11.2 — Transition animations**

Add smooth transitions when:
- Sidebar sections unlock (opacity animation)
- Status banner changes state (color transition)
- Installation wizard steps advance (slide transition)
- Compatibility Intelligence cards load (skeleton → content fade)

---

## Verification

1. **State machine correctness**: Navigate to a Wine game edit page → verify banner shows correct phase for: new game (needs_install), after install (post_install), after setting exe (ready), during session (running)
2. **Sidebar locking**: With a non-installed Wine game, click locked sections → verify they're visually dimmed and not interactive
3. **Installation wizard**: Click Install → verify full-page wizard opens at `/games/{id}/install`, Compatibility Intelligence auto-fires, complete all steps, verify return to edit page with Installation section read-only
4. **Compatibility Intelligence**: For a game with known protonfixes (e.g., Horizon Zero Dawn / GOG ID 1209025141), verify:
   - UMU database returns `umu-1151640`
   - Protonfixes index shows `vcrun2019` winetrick
   - Lutris API returns installers
   - ProtonDB shows Gold/Platinum tier
   - Merged fixes are accurate (no duplicates)
5. **Auto-lookup toggle**: Disable auto-lookup in settings → verify wizard Step 1 shows manual "Check Compatibility" button instead
6. **Reinstall flow**: On an installed game, click Reinstall → verify confirmation, then wizard restarts with cleared prefix
7. **MakeItRun TOML**: Export a game's config → verify TOML file at `/data/storage/makeitrun/{slug}.toml`. Verify `[sources]` section records which databases contributed.
8. **No regression**: Launch a currently-working Wine game → verify all environment variables match pre-refactor values. `docker inspect` on the container.
9. **Protonfixes index**: Run `pnpm index:protonfixes` → verify `protonfixes-index.json` is generated with correct structure
10. **Section removal**: Verify Old GOG and DirectDraw preset buttons no longer appear
11. **Screenshots position**: Verify carousel appears within Game Information section
12. **Run**: `pnpm test && pnpm lint`

## Decisions

- **MakeItRun storage**: Separate directory `/data/storage/makeitrun/{slug}.toml` — enables independent sharing/importing
- **Wizard UX**: Full-page wizard at `/games/{id}/install` with post-install configurators inline
- **State visibility**: Both top banner AND sidebar indicators
- **Wine Advanced rename**: "MakeItRun Config"
- **Gamescope/MangoHUD**: New "Performance" sidebar section
- **Community API**: Full spec designed now, implementation deferred
- **Protonfixes repo**: Git submodule in `third_party/umu-protonfixes/` (consistent with existing third_party/ pattern)
- **Protonfixes parsing**: Python AST indexer for ~95% coverage + TypeScript regex fallback for runtime queries
- **Auto-lookup**: Enabled by default, global checkbox in settings to disable (shows manual button when off)
- **Compatibility Intelligence timing**: Runs as Step 1 of install wizard (auto or manual based on setting)
- **Data sources**: UMU Database API (no auth) → Protonfixes index (local) + Lutris API (existing) + ProtonDB (no auth) + PCGamingWiki Cargo API (optional enrichment)
- **Caching**: Compat results cached 7 days at `/data/storage/cache/compat/{slug}.json`
- **No launch changes**: MakeItRun applies through existing `GamePlatformConfig.settings` → `launchGame()` reads those fields unchanged
- **TOML library**: `smol-toml` (zero-dependency, ESM-compatible)