# Dillinger Sunshine Streaming Sidecar

Headless streaming sidecar based on sway + gamescope + sunshine.

## Ports
- 47984/tcp, 47984/udp: Moonlight
- 47990/tcp: Sunshine web UI
- 48010/tcp, 48010/udp: RTSP
- 9999/tcp: Health endpoints

## Health Endpoints
- /healthz
- /readyz
- /streamz
- /status
