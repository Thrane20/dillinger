#!/bin/bash
echo "Firing up the gamescope builder" &&
docker run -d --rm --name builder-gamescope docker.io/dillinger/gamescope:3.11.51 tail -f /dev/null && 
echo "Copying..." &&
docker cp builder-gamescope:/opt/gamescope/bin/gamescope ./dist/gamescope && 
echo "Stopping the gamescope builder..." &&
docker stop builder-gamescope