# Dillinger 

> "You shouldn't have come back, Flynn" - Master Control Program

## About

Dillinger is a containerised game launcher and asset management system, specifically for linux boffins. 

Rather than being Yet Another Front End GUI Game Launcher (e.g. Launchbox - which is fantastic btw!), Dillinger seeks to fully containerise every facet of your gaming library, for these key needs:

- Supporting the push for "Gaming on Linux".
- Immutability (Nothing breaks your gaming images, not matter what computer you run on, what version of wine just got installed etc. etc.)
- Post Apocolyptic Storage (No run-time dependency on the internet *(well, mostly)* - your library is your library, beautifully managed, and locally hosted).
- In particular, enhance positive and successful Wine-based outcomes, using the best of Proton and Glorious Eggroll's Proton and Lutris builds.
- Support for a wide gamut of Retro gaming needs (MAME, C64, Amiga, NES etc.) in a *game oriented* fashion. Find a retro game to play, and enjoy that title across all the different platforms it was written on.
- Inbuilt ROM finders to assist in DLs for the games you already own.
- Standardisation of support tools, such as Gamescope, OpenTrack etc. to be available and applied to any game image.

## Where Is It?

I'm building it. 

## What's Dillinger Built On?

100% containerised runtime (Docker), and Rust for the backend. I've chosen Rust as its a learning project for me, and I want something closer to the tin than NodeJS etc. A mix of tech for the front (as there's 1000 frameworks for web/js and whatever is cool now will be toast tomorrow) :bread:
