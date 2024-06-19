#!/bin/bash
docker run -d --rm \
  --name=dillinger_core \
  --privileged=true \
  -v /run/dbus:/run/dbus:ro \
  --ipc=host \
  -p 3060:3060 \
  dillinger/core:1.0 \