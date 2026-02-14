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

## Migration from start-dillinger.sh

- `./start-dillinger.sh` → `dillinger-gaming start`
- `docker logs dillinger` → `dillinger-gaming logs --follow`
- `docker stop dillinger` → `dillinger-gaming stop`
