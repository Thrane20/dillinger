#!/bin/bash
WINEDLLOVERRIDES='wbemprox=n;msdmo=n;nvapi;nvapi64=n' WINEESYNC=1 \
WINEFSYNC=1 ./rum.sh wine-ge15 ./star_citizen wine \
./RSI-Setup-2.0.1.exe