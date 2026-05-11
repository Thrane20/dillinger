# dillinger-gaming

TypeScript CLI for launching and managing Dillinger.

## Installation

```bash
pnpm add -g dillinger-gaming
# or
npm install -g dillinger-gaming
```

## Usage

```bash
dillinger-gaming
dillinger-gaming tui
dillinger-gaming start
dillinger-gaming status
dillinger-gaming logs --follow
dillinger-gaming update check
dillinger-gaming update apply
dillinger-gaming volume create
dillinger-gaming volume create --bind /path/to/data
dillinger-gaming volume verify
dillinger-gaming doctor
```

Running `dillinger-gaming` with no subcommand opens the default terminal UI. The TUI shows:

- Core runtime status and registration counts
- Docker volumes discovered on the host
- Managed bind-backed volumes that are auto-mounted into runner containers
- Game listing, search, and launch actions

In the Volumes tab:

- Press `c` to create a new managed bind-backed volume
- Press `Enter` on an existing bind-backed Docker volume to adopt it into Dillinger management or edit its metadata
- Set a friendly name, storage tier (`ssd`, `archive`, `network`, `unknown`), and optional Dillinger role such as `roms`, `cache`, `downloads`, `installers`, or `installed`

## Native Core Runtime

Docker remains required for runners, game containers, volumes, and streaming sidecars, but Core can run as a host daemon:

```bash
dillinger-gaming volume create --bind /path/to/dillinger-data
dillinger-gaming start --native
dillinger-gaming status --native
dillinger-gaming logs --native --follow
dillinger-gaming restart --native
dillinger-gaming stop --native
```

Native mode uses `DILLINGER_CORE_PATH` when it is set. Otherwise, it resolves the data path from the bind-backed `dillinger_core` Docker volume. Docker-managed non-bind volumes cannot be used directly by the host runtime.

## Managed Runner Volumes

Managed extra volumes are mounted into runner containers automatically at:

```text
/mnt/dillinger-volumes/<docker-volume-name>
```

Use the TUI Volumes screen to create or adopt a bind-backed Docker volume and persist it into Dillinger's managed `volumes` storage. Once registered, the volume is exposed to future runner launches automatically. When you assign a role like `roms` or `cache`, Dillinger also uses that managed volume as the preferred default for the matching workflow.

## Migration from start-dillinger.sh

- `./start-dillinger.sh` → `dillinger-gaming start`
- `docker logs dillinger` → `dillinger-gaming logs --follow`
- `docker stop dillinger` → `dillinger-gaming stop`
