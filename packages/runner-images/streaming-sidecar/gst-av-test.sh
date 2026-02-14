#!/bin/bash
set -euo pipefail

WAYLAND_DISPLAY=${WAYLAND_DISPLAY:-wayland-1}

runtime_dir="${XDG_RUNTIME_DIR:-}"
if [[ -n "$runtime_dir" && -S "$runtime_dir/$WAYLAND_DISPLAY" ]]; then
  :
else
  runtime_dir=""
  for candidate in /run/user/*; do
    if [[ -S "$candidate/$WAYLAND_DISPLAY" ]]; then
      runtime_dir="$candidate"
      break
    fi
  done
fi

if [[ -z "$runtime_dir" ]]; then
  runtime_dir="/run/user/1000"
  mkdir -p "$runtime_dir"
  chmod 700 "$runtime_dir" || true
fi

export XDG_RUNTIME_DIR="$runtime_dir"
export WAYLAND_DISPLAY

exec gst-launch-1.0 -q \
  videotestsrc pattern=smpte is-live=true \
  ! video/x-raw,width=1280,height=720,framerate=60/1 \
  ! videoconvert \
  ! queue \
  ! waylandsink sync=false \
  audiotestsrc wave=sine is-live=true \
  ! audioconvert \
  ! audioresample \
  ! queue \
  ! pulsesink sync=false
