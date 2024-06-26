#!/bin/bash

# TODO: check whether we need this before actually doing it

set -e

if [ -d /usr/nvidia ]; then
  echo "Nvidia driver detected"
  ldconfig
fi

if [ -d /usr/nvidia/share/vulkan/icd.d ]; then
  echo "[nvidia] Add Vulkan ICD"
  mkdir -p /usr/share/vulkan/icd.d/
  cp /usr/nvidia/share/vulkan/icd.d/* /usr/share/vulkan/icd.d/
fi

if [ -d /usr/nvidia/share/egl/egl_external_platform.d ]; then
  echo "[nvidia] Add EGL external platform"
  mkdir -p /usr/share/egl/egl_external_platform.d/
  cp /usr/nvidia/share/egl/egl_external_platform.d/* /usr/share/egl/egl_external_platform.d/
fi

if [ -d /usr/nvidia/share/glvnd/egl_vendor.d ]; then
  echo "[nvidia] Add egl-vendor"
  mkdir -p /usr/share/glvnd/egl_vendor.d/
  cp /usr/nvidia/share/glvnd/egl_vendor.d/* /usr/share/glvnd/egl_vendor.d/

fi

if [ -d /usr/nvidia/lib/gbm ]; then
  echo "[nvidia] Add gbm backend"
  mkdir -p /usr/lib/x86_64-linux-gnu/gbm/
  cp /usr/nvidia/lib/gbm/* /usr/lib/x86_64-linux-gnu/gbm/
fi