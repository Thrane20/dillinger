## Plan: Dillinger CLI (`dillinger-gaming`)

Build a TypeScript CLI using Commander.js that replaces `start-dillinger.sh` with a globally-installable npm package. Users will run `npx dillinger-gaming start` or install globally via `pnpm add -g dillinger-gaming`.

**TL;DR:** Create a new `packages/cli/` package with Commander.js, porting all functionality from the 705-line bash script. The CLI provides lifecycle management (`start`, `stop`, `status`), update checking (self + Docker images), volume management (create at custom paths, backup, verify), and diagnostics. Interactive prompts by default with `--yes` flag for automation. Publishes to npm as `dillinger-gaming`.

---

### Steps

**1. Create new package structure**

Create [packages/cli/](packages/cli/) with:
- `package.json` with `"bin": { "dillinger-gaming": "./dist/index.js" }`
- `tsconfig.json` extending `../../tsconfig.base.json`
- `src/index.ts` as Commander entry point
- `src/commands/` directory for modular command files

Add CLI dependencies: `commander`, `chalk`, `ora` (spinners), `inquirer` (prompts), `execa` (shell commands), `conf` (local config storage), `update-notifier` (self-update checks).

**2. Implement core command structure**

Entry point [packages/cli/src/index.ts](packages/cli/src/index.ts):
- Parse package version from `package.json`
- Register commands: `start`, `stop`, `restart`, `status`, `logs`, `update`, `volume`, `doctor`, `config`
- Global flags: `--yes` (skip prompts), `--verbose`, `--quiet`

**3. Port lifecycle commands from bash script**

[packages/cli/src/commands/start.ts](packages/cli/src/commands/start.ts) - Port `start_container()` logic:
- Docker prerequisite checks (`check_docker`, `check_docker_running`, `check_docker_permissions`)
- Volume initialization (`check_volume`, `init_wolf_config`)
- Build dynamic `docker run` command with all passthrough options (X11, GPU, audio, input)
- Options: `--port <number>`, `--detach`, `--no-update-check`

[packages/cli/src/commands/stop.ts](packages/cli/src/commands/stop.ts) - Stop/remove container
[packages/cli/src/commands/status.ts](packages/cli/src/commands/status.ts) - Show container state, ports, uptime
[packages/cli/src/commands/logs.ts](packages/cli/src/commands/logs.ts) - Stream container logs with `--follow`

**4. Implement update system**

[packages/cli/src/commands/update.ts](packages/cli/src/commands/update.ts) - Port `check_script_update()` and `check_image()`:
- Fetch [versioning.env](versioning.env) from GitHub raw URL
- Compare local CLI version to remote `DILLINGER_START_SCRIPT_VERSION`
- Compare local Docker image label to remote `DILLINGER_CORE_VERSION`
- Interactive prompts to upgrade (skippable with `--yes`)
- Sub-commands: `update check` (dry-run), `update apply`

Use `update-notifier` for background update checks on every CLI invocation.

**5. Implement volume management**

[packages/cli/src/commands/volume.ts](packages/cli/src/commands/volume.ts) with sub-commands:

| Sub-command | Purpose |
|-------------|---------|
| `volume create` | Create `dillinger_root` Docker volume |
| `volume create --bind <path>` | Create with bind mount at specific host path |
| `volume verify` | Run verification logic from [volume-verification.ts](packages/dillinger-core/lib/services/volume-verification.ts) |
| `volume backup <file>` | Export volume to tar archive |
| `volume restore <file>` | Import volume from tar archive |
| `volume destroy --force` | Remove volume (requires confirmation) |

Bind mount option enables user-specified storage locations on their filesystem.

**6. Implement doctor/diagnostics command**

[packages/cli/src/commands/doctor.ts](packages/cli/src/commands/doctor.ts) - System health check:
- Docker installed and running
- Docker permissions (user in docker group)
- GPU availability (`/dev/dri` exists)
- Audio setup (PulseAudio socket)
- X11/Wayland display
- Volume integrity
- Network connectivity to ghcr.io

Output clear pass/fail for each check with remediation hints.

**7. Implement config command**

[packages/cli/src/commands/config.ts](packages/cli/src/commands/config.ts) - Local CLI settings:
- `config show` - Display current settings
- `config set <key> <value>` - Set option (e.g., `config set port 3010`)
- `config reset` - Restore defaults

Store in `~/.config/dillinger-gaming/config.json` using `conf` package.

Configurable options: `port`, `imageName`, `autoUpdate`, `volumeName`.

**8. Implement udev setup command**

[packages/cli/src/commands/udev.ts](packages/cli/src/commands/udev.ts) - Port `setup_udev_rules()`:
- Detect if rules already installed
- Prompt for sudo (interactive) or fail with instructions
- Install Wolf gamepad rules to `/etc/udev/rules.d/`
- Reload udev: `udevadm control --reload-rules && udevadm trigger`

**9. Create shared utilities**

[packages/cli/src/utils/docker.ts](packages/cli/src/utils/docker.ts):
- `isDockerInstalled()`, `isDockerRunning()`, `hasDockerPermissions()`
- `runContainer()`, `stopContainer()`, `getContainerStatus()`
- Wrap Docker commands using `execa`

[packages/cli/src/utils/version.ts](packages/cli/src/utils/version.ts):
- `fetchRemoteVersions()` - Parse versioning.env from GitHub
- `compareVersions()` - Semantic version comparison
- `getLocalImageVersion()` - Read Docker image labels

[packages/cli/src/utils/prompts.ts](packages/cli/src/utils/prompts.ts):
- Wrapper around `inquirer` that respects `--yes` flag
- `confirm()`, `select()`, `input()` helpers

**10. Set up build and publish workflow**

Update [packages/cli/package.json](packages/cli/package.json):
```json
{
  "name": "dillinger-gaming",
  "bin": { "dillinger-gaming": "./dist/index.js" },
  "files": ["dist"],
  "publishConfig": { "access": "public" }
}
```

Add build script using `tsup` or `esbuild` for bundling.

Add to root [package.json](package.json):
- `"cli:build": "pnpm --filter dillinger-gaming build"`
- `"cli:publish": "pnpm --filter dillinger-gaming publish"`

**11. Add CLI to pnpm workspace**

Already covered by `packages/*` glob in [pnpm-workspace.yaml](pnpm-workspace.yaml).

**12. Documentation**

Create [packages/cli/README.md](packages/cli/README.md):
- Installation: `pnpm add -g dillinger-gaming` or `npx dillinger-gaming`
- Command reference with examples
- Migration guide from `start-dillinger.sh`

Update [README.USERS.md](README.USERS.md) to reference new CLI.

---

### Verification

1. **Unit tests:** Add test files in `packages/cli/tests/` using Vitest - mock Docker/execa calls
2. **Integration test:** Run locally:
   ```bash
   cd packages/cli && pnpm build
   node dist/index.js doctor
   node dist/index.js start --help
   ```
3. **npm pack test:** `pnpm pack` in CLI package, install tarball globally, verify `dillinger-gaming --version` works
4. **Full flow:** `dillinger-gaming doctor && dillinger-gaming start && dillinger-gaming status && dillinger-gaming stop`

---

### Decisions

- **Package name:** `dillinger-gaming` (user-provided)
- **CLI framework:** Commander.js over oclif/yargs (simpler, sufficient for needs)
- **Platform scope:** Linux-only (matches existing bash script, avoids macOS edge cases)
- **Interactivity:** Interactive by default with `--yes` bypass (matches user preference and existing UX)
- **Config storage:** `conf` package for `~/.config/dillinger-gaming/` (XDG-compliant)
- **Bundler:** tsup for simple ESM/CJS bundling with TypeScript
