# Dillinger Wolf Streaming Sidecar

Headless Wolf-based streaming sidecar with a single-app Dillinger mode and a
REST API for launching and stopping games inside the compositor.

## Ports
- 47984/tcp: Moonlight HTTPS (pairing)
- 47989/tcp: Moonlight HTTP (discovery)
- 47999/udp: Moonlight control
- 48010/tcp: RTSP streaming
- 48100/udp: Moonlight video
- 48200/udp: Moonlight audio
- 9999/tcp: Dillinger REST API

## Environment
- DILLINGER_MODE=1 (required)
- DILLINGER_API_PORT=9999 (optional)
- WOLF_CFG_FOLDER=/data/wolf (server cert/key, UUID, pairing DB)
- HOST_APPS_STATE_FOLDER=/data/wolf/apps (per-client app state)

## Persistence
To preserve Moonlight pairing and stable server identity across sidecar rebuilds,
mount `dillinger_root` to `/data` and keep these files in `/data/wolf`:

- `key.pem` / `cert.pem` (server identity)
- `paired_clients.json` (paired Moonlight clients)
- `dillinger_uuid.txt` (stable Dillinger-mode server UUID)

## REST API
- GET /health
- GET /status
- POST /launch (JSON: {"cmd": "...", "env": {"KEY": "VALUE"}})
- POST /stop
- GET /pair/status
- POST /pair/accept (JSON: {"pair_secret": "...", "pin": "1234"})

## Test Patterns
The image includes two helper scripts for quick video/audio validation:
- /opt/dillinger/gst-video-test.sh (SMPTE video test)
- /opt/dillinger/gst-av-test.sh (SMPTE video + sine audio)

You can call these via POST /launch to verify streaming without a game.

Example:

```bash
curl -X POST http://localhost:9999/launch \
	-H 'Content-Type: application/json' \
	-d '{"cmd":"/opt/dillinger/gst-video-test.sh"}'

curl -X POST http://localhost:9999/launch \
	-H 'Content-Type: application/json' \
	-d '{"cmd":"/opt/dillinger/gst-av-test.sh"}'
```

## Build
From repo root:

```
pnpm docker:build:streaming-sidecar
```
