#!/usr/bin/env bash

wines="/mnt/fastdrv1/Lutris/wines"

error() { echo -e "$@"; exit 1 ;}
[[ $# -lt 3 ]] && error "Not enough arguments!\nUsage: rum <wine-version or /path/to/wine/version> </path/to/wine/prefix> <wine command> [wine arguments...]\n\nWine versions available:\n$(ls $wines | sort --version-sort)"

winepath="$1"; shift
export WINEPREFIX="$(readlink -f $1)";  shift
[[ -d "$winepath" ]] || [[ -d "$wines/$winepath" ]] && winepath="$wines/$winepath" || error "Error! Path to wine version doesn't exist!\nWine versions available:\n$(ls $wines | sort --version-sort)"
if [[ ! -d "$WINEPREFIX" ]]; then
	read -p "Wine prefix doesn't exist, do you want to create it? [Y/n] " -s -n 1 -r
	echo
	[[ "$REPLY" =~ ^[Nn]$ ]] && error "Choose not to create prefix so exiting..." || mkdir -p "$WINEPREFIX" || error "Error! Path to wine prefix  couldn't be created."
fi

cmd="$@"

export PATH="$winepath/bin:$PATH"
export LD_LIBRARY_PATH="$winepath/lib:$LD_LIBRARY_PATH"
export WINESERVER="$winepath/bin/wineserver"
export WINELOADER="$winepath/bin/wine"
export WINEDLLPATH="$winepath/lib/wine"

echo $WINEDLLOVERRIDES

echo "Running $winepath ($(wine --version)) in: $WINEPREFIX"
gamemoderun "$@"
