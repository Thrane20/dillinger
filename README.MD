# Dillinger 

> "You shouldn't have come back, Flynn" - Master Control Program

## About

Dillinger is a containerised game launcher and asset management system, specifically for linux boffins. 

Rather than being Yet Another Front End GUI Game Launcher (e.g. Launchbox - which is fantastic btw!), Dillinger seeks to fully containerise every facet of your gaming library, for these key needs:

- Supporting the push for "Gaming on Linux".
- Immutability (Nothing breaks your gaming images, not matter what computer you run on, what version of wine just got installed etc. etc.)
- Post Apocolyptic Storage (No run-time dependency on the internet *(well, mostly)* - your library is your library, beautifully managed, and locally hosted).
- In particular, enhance positive and successful Wine-based outcomes, using the best of Proton and Glorious Eggroll's Proton and Lutris builds. And umu-launcher when it becomes more useful.
- Support for a wide gamut of Retro gaming needs (MAME, C64, Amiga, NES etc.) in a *game oriented* fashion. Find a retro game to play, and enjoy that title across all the different platforms it was written on.
- Inbuilt ROM finders to assist in DLs for the games you already own. (nb. this is only to abandonware websites for non-profitable retro consoles. For everything current, this will link to your own Steam, GOG purchases etc.)
- Standardisation of support tools, such as Gamescope, OpenTrack etc. to be available and applied to any game image.

## Where Is It?

I'm building it. 

## What's Dillinger Built On?

100% containerised runtime (Podman), and Rust for the backend. I've chosen Rust as its a learning project for me, and I want something closer to the tin than NodeJS etc. A mix of tech for the front (as there's 1000 frameworks for web/js and whatever is cool now will be toast tomorrow) :bread:

## Install and Run

1. You need Podman installed.

2. You need to create a root volume where all your game config and launch info is stored.

    1. First, create a directory on your favourite drive. Let's go for ```~/dillinger_root```

    2. In ```~/dillinger_root```, create a filename called ```dillinger.conf```

    3. Now mount a podman volume to the directory you selected. Call the volume "dillinger_root", e.g. 

        ```
        podman volume create --opt type=none --opt device=~/dillinger_root --opt o=bind dillinger_root
        ````

3. Run the Dillinger Core container

This runs the backend server and web host.

