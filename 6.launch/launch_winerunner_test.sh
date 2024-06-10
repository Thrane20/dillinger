#!/bin/bash
xhost +local:

docker run -it --rm \
  --name=dillinger_base \
  --privileged=true \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  -v /run/user/1000/pulse:/tmp/pulse \
  -v /run/dbus:/run/dbus:ro \
  -v /mnt/linuxfast/dev/dillinger/3.docker/images/runners/wine:/home/dillinger/runners_wine \
  -v /mnt/linuxfast/dev/dillinger/6.launch/run_ge.sh:/home/dillinger/run_ge.sh \
  --ipc=host \
  -e XORG_DISPLAY=:0 \
  -e DISPLAY=:0 \
  -e GOW_REQUIRED_DEVICES="/dev/uinput /dev/input/event* /dev/dri/*" \
  -e XDG_RUNTIME_DIR=/tmp/.X11-unix \
  -e PULSE_SERVER=unix:/tmp/pulse/native \
  dillinger/runner-wine:1.0 \
  # /home/dillinger/run_ge.sh 
  
xhost -local: