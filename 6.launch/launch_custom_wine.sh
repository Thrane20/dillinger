#!/bin/bash

WINEDLLOVERRIDES='wbemprox=n;msdmo=n;nvapi;nvapi64=n' WINEESYNC=1 \
WINEFSYNC=1 ./rum.sh wine-ge15 ./dcs-world wine \
./dcs-world/drive_c/Program\ Files/Eagle\ Dynamics/DCS\ World/bin/DCS_Updater.exe