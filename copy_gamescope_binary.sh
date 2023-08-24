#!/bin/bash
echo "Firing up the gamescope builder" &&
docker run -d --rm --name builder-gamescope docker.io/dillinger/gamescope:3.11.51 tail -f /dev/null && 
echo "Copying..." &&
docker cp builder-gamescope:/opt/gamescope/gamescope ./dist/gamescope && 
docker cp builder-gamescope:/opt/gamescope/VkLayer_FROG_gamescope_wsi.json ./dist/VkLayer_FROG_gamescope_wsi.json && 
docker cp builder-gamescope:/opt/gamescope/libVkLayer_FROG_gamescope_wsi.so ./dist/libVkLayer_FROG_gamescope_wsi.so && 
echo "Stopping the gamescope builder..." &&
docker stop builder-gamescope