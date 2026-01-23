# Lutris Installer Script Support

Dillinger can execute Lutris installer scripts for automated GOG game installation with proper Wine configuration.

## Supported Lutris Operations

### Environment Configuration

| Feature | Environment Variable | Format |
|---------|---------------------|--------|
| Winetricks | `WINE_WINETRICKS` | `verb1;verb2;verb3` |
| DLL Overrides | `WINEDLLOVERRIDES` | `dll1=mode1;dll2=mode2` |
| Wine Architecture | `WINEARCH` | `win32` or `win64` |
| Registry Settings | `WINE_REGISTRY_SETTINGS` | JSON array |

### Execution Steps

| Operation | Environment Variable | Description |
|-----------|---------------------|-------------|
| Extract | `LUTRIS_EXTRACT_STEPS` | Extract archives (7z, zip, tar, innoextract) |
| Move/Merge | `LUTRIS_MOVE_STEPS` | Move, rename, or merge files/directories |
| Execute | `LUTRIS_EXECUTE_STEPS` | Run shell commands |
| Wine Exec | `LUTRIS_WINEEXEC_STEPS` | Run Windows executables via Wine |

## Script Analysis

The `analyzeLutrisScript()` function in [lutris-executor.ts](../../packages/dillinger-core/lib/services/lutris-executor.ts) parses Lutris YAML scripts and extracts:

1. **Wine Configuration**
   - Architecture (win32/win64)
   - DLL overrides
   - Environment variables

2. **Installation Steps**
   - Extract operations (archive extraction)
   - File operations (move, merge, rename)
   - Shell commands
   - Wine executable runs
   - Registry modifications

3. **Game Configuration**
   - Executable path
   - Working directory
   - Launch arguments

## Variable Substitution

Lutris scripts use variables that are substituted at runtime:

| Variable | Container Path |
|----------|---------------|
| `$GAMEDIR` | `/wineprefix` (Wine prefix directory) |
| `$CACHE` | `/tmp/lutris_cache` |
| `$INSTALL` | `/install` (installation target) |
| `$HOME` | `/home/gameuser` |
| `$WINEPREFIX` | `/wineprefix` |

## Execution Order

During installation, operations execute in this order:

1. Wine prefix creation (automatic)
2. Lutris extract steps (`LUTRIS_EXTRACT_STEPS`)
3. Lutris move/merge steps (`LUTRIS_MOVE_STEPS`)
4. Lutris execute steps (`LUTRIS_EXECUTE_STEPS`)
5. Lutris Wine exec steps (`LUTRIS_WINEEXEC_STEPS`)
6. Winetricks verbs (`WINE_WINETRICKS`)
7. Registry settings (`WINE_REGISTRY_SETTINGS`)
8. Main installer execution

## Example Script Analysis

Given a Lutris script like:

```yaml
game:
  arch: win32
  exe: drive_c/Program Files/MyGame/game.exe

wine:
  overrides:
    ddraw: native

installer:
  - task:
      name: winetricks
      app: vcrun2019 d3dcompiler_47
  - extract:
      file: installer
      dst: $CACHE/extracted
  - move:
      src: $CACHE/extracted/game
      dst: $GAMEDIR/drive_c/Program Files/MyGame
  - task:
      name: wineexec
      executable: setup.exe
      args: /VERYSILENT
```

The analyzer extracts:
- `wineArch`: `win32`
- `winetricks`: `['vcrun2019', 'd3dcompiler_47']`
- `dllOverrides`: `{ddraw: 'native'}`
- `executionSteps`: extract, move, wineexec steps

## Limitations

Currently not supported:
- `autosetup_gog_game` task (use standard Wine installer instead)
- `insert-disc` and `eject_disc` tasks
- `install_cab_component` task
- Complex conditional logic in scripts

## References

- [Lutris Installer Documentation](https://github.com/lutris/lutris/blob/master/docs/installers.rst)
- [Lutris Commands Source](https://github.com/lutris/lutris/blob/master/lutris/installer/commands.py)
- [Lutris Wine Commands Source](https://github.com/lutris/lutris/blob/master/lutris/runners/commands/wine.py)
