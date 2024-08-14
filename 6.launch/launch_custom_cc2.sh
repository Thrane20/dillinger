#!/bin/bash
WINEDLLOVERRIDES='wbemprox=n;msdmo=n;nvapi;nvapi64=n' WINEESYNC=1 \
WINEFSYNC=1 ./rum.sh wine-ge15 ./cc2 wine \
./setup.exe