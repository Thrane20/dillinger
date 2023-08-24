#!/bin/bash
echo "Installing gamescope locally" &&
cp -p ./dist/gamescope /usr/local/bin/gamescope &&
cp -p ./dist/VkLayer_FROG_gamescope_wsi.json /usr/local/share/vulkan/implicit_layer.d/VkLayer_FROG_gamescope_wsi.json &&
cp -p ./dist/libVkLayer_FROG_gamescope_wsi.so /usr/local/lib/x86_64-linux-gnu/libVkLayer_FROG_gamescope_wsi.so &&
echo "Done."