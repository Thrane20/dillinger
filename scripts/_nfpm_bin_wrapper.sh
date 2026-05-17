#!/bin/sh
# /usr/bin/dillinger-gaming – installed by the deb/rpm/arch package.
# Delegates to the bundled ESM entry point in /usr/lib/dillinger-gaming/.
exec node /usr/lib/dillinger-gaming/index.js "$@"
