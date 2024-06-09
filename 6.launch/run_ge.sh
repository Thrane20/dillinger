#!/bin/bash
export PATH="/home/dillinger/runners_wine/lutris-GE-Proton8-26-x86_64/bin:$PATH"
winecfg
exec "$@"