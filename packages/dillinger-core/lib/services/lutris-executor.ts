/**
 * Lutris Script Executor
 * 
 * Analyzes Lutris installer scripts and generates shell commands
 * that can be executed in a Wine container environment.
 * 
 * Reference: https://github.com/lutris/lutris/blob/master/lutris/installer/commands.py
 */

import type { LutrisScript, LutrisStep } from './lutris-service';

/**
 * Execution context for Lutris scripts
 */
export interface LutrisExecutionContext {
  /** Installation directory (Wine prefix) - $GAMEDIR */
  gameDir: string;
  /** Cache directory for temp files - $CACHE */
  cacheDir: string;
  /** Path to the GOG installer file */
  installerPath: string;
  /** Wine architecture */
  wineArch: 'win32' | 'win64';
  /** File mappings from the script's files section */
  files: Record<string, string>;
}

/**
 * Result of analyzing a Lutris script
 */
export interface LutrisScriptAnalysis {
  /** Wine architecture to use */
  wineArch: 'win32' | 'win64';
  /** Winetricks verbs to install before the game */
  winetricks: string[];
  /** DLL overrides to set */
  dllOverrides: Record<string, string>;
  /** Environment variables to set */
  environment: Record<string, string>;
  /** Whether the script requires user to provide a file */
  requiresUserFile: boolean;
  /** Prompt for user file selection */
  userFilePrompt?: string;
  /** Key in the files section that maps to user file */
  userFileKey?: string;
  /** Installer arguments (for GOG silent install) */
  installerArgs?: string;
  /** Steps that need manual execution (not just env setup) */
  executionSteps: LutrisExecutionStep[];
  /** Path to game executable (from game.exe) */
  gameExePath?: string;
  /** Working directory for the game */
  workingDir?: string;
  /** Lutris recommendations for Wine settings */
  recommendations: {
    /** Whether Lutris recommends enabling DXVK (true/false/undefined=no recommendation) */
    useDxvk?: boolean;
    /** Whether Lutris recommends enabling esync */
    useEsync?: boolean;
    /** Wine version recommended by the script */
    wineVersion?: string;
  };
}

/**
 * A step that needs to be executed during installation
 */
export interface LutrisExecutionStep {
  type: 'extract' | 'move' | 'merge' | 'execute' | 'wineexec' | 'winetricks' | 
        'write_config' | 'write_file' | 'set_regedit' | 'mkdir' | 'chmodx' | 'rename';
  description: string;
  /** Shell command to execute (for reference/debugging) */
  shellCommand?: string;
  /** Parameters for the step */
  params: Record<string, unknown>;
}

/**
 * Analyze a Lutris script and extract configuration
 */
export function analyzeLutrisScript(script: LutrisScript): LutrisScriptAnalysis {
  const analysis: LutrisScriptAnalysis = {
    wineArch: 'win64',
    winetricks: [],
    dllOverrides: {},
    environment: {},
    requiresUserFile: false,
    executionSteps: [],
    recommendations: {},
  };

  // Extract Wine architecture from game config
  if (script.game?.arch) {
    analysis.wineArch = script.game.arch;
  }

  // Extract game executable path
  if (script.game?.exe) {
    analysis.gameExePath = script.game.exe;
  }

  // Extract working directory
  if (script.game?.working_dir) {
    analysis.workingDir = script.game.working_dir;
  }

  // Extract DLL overrides from wine config
  if (script.wine?.overrides) {
    analysis.dllOverrides = { ...script.wine.overrides };
  }

  // Extract Lutris wine recommendations (DXVK, esync, wine version)
  if (script.wine) {
    if (typeof script.wine.dxvk === 'boolean') {
      analysis.recommendations.useDxvk = script.wine.dxvk;
    }
    if (typeof script.wine.esync === 'boolean') {
      analysis.recommendations.useEsync = script.wine.esync;
    }
    if (script.wine.version) {
      analysis.recommendations.wineVersion = script.wine.version;
    }
  }

  // Extract environment variables from system config
  if (script.system?.env) {
    analysis.environment = { ...script.system.env };
  }

  // Check files section for user-provided files
  if (script.files) {
    for (const fileEntry of script.files) {
      for (const [key, value] of Object.entries(fileEntry)) {
        if (typeof value === 'string' && value.startsWith('N/A:')) {
          analysis.requiresUserFile = true;
          analysis.userFilePrompt = value.substring(4).trim();
          analysis.userFileKey = key;
          break;
        }
      }
    }
  }

  // Process installer steps
  if (script.installer) {
    for (const step of script.installer) {
      processInstallerStep(step, analysis);
    }
  }

  return analysis;
}

/**
 * Process a single installer step
 */
function processInstallerStep(step: LutrisStep, analysis: LutrisScriptAnalysis): void {
  // Task execution (wineexec, winetricks, create_prefix, etc.)
  if (step.task) {
    const task = step.task;
    
    switch (task.name) {
      case 'winetricks':
        // Extract winetricks verbs
        if (task.app) {
          const verbs = task.app.split(/\s+/).filter(v => v.length > 0);
          analysis.winetricks.push(...verbs);
        }
        // Also get arch from task if specified
        if (task.arch) {
          analysis.wineArch = task.arch;
        }
        break;
        
      case 'wineexec':
        // Get arch from task
        if (task.arch) {
          analysis.wineArch = task.arch;
        }
        // Store installer args for GOG installers
        if (task.args && task.executable) {
          analysis.installerArgs = task.args;
        }
        // Add as execution step
        analysis.executionSteps.push({
          type: 'wineexec',
          description: `Run: ${task.executable || 'wine'} ${task.args || ''}`,
          params: { ...task },
        });
        break;
        
      case 'create_prefix':
        // Get arch from task
        if (task.arch) {
          analysis.wineArch = task.arch;
        }
        // We create prefix automatically, but note it
        analysis.executionSteps.push({
          type: 'wineexec',
          description: 'Create Wine prefix',
          params: { name: 'create_prefix', arch: task.arch || analysis.wineArch },
        });
        break;
        
      case 'winekill':
        // Kill wine processes - typically after installation
        analysis.executionSteps.push({
          type: 'execute',
          description: 'Kill Wine processes',
          shellCommand: 'wineserver -k',
          params: {},
        });
        break;
        
      case 'set_regedit':
        analysis.executionSteps.push({
          type: 'set_regedit',
          description: `Set registry: ${task.prefix || ''}`,
          params: { ...task },
        });
        break;
        
      default:
        // Unknown task - log for debugging
        analysis.executionSteps.push({
          type: 'execute',
          description: `Unknown task: ${task.name}`,
          params: { ...task },
        });
    }
    return;
  }

  // Extract archive
  if (step.extract) {
    analysis.executionSteps.push({
      type: 'extract',
      description: `Extract: ${step.extract.file} -> ${step.extract.dst}`,
      params: { ...step.extract },
    });
    return;
  }

  // Move files
  if (step.move) {
    analysis.executionSteps.push({
      type: 'move',
      description: `Move: ${step.move.src} -> ${step.move.dst}`,
      params: { ...step.move },
    });
    return;
  }

  // Merge/copy files
  if (step.merge) {
    analysis.executionSteps.push({
      type: 'merge',
      description: `Merge: ${step.merge.src} -> ${step.merge.dst}`,
      params: { ...step.merge },
    });
    return;
  }

  // Execute shell command
  if (step.execute) {
    analysis.executionSteps.push({
      type: 'execute',
      description: `Execute: ${step.execute.command || step.execute.file || ''}`,
      params: { ...step.execute },
    });
    return;
  }

  // Make executable
  if (step.chmodx) {
    analysis.executionSteps.push({
      type: 'chmodx',
      description: `chmod +x: ${step.chmodx}`,
      shellCommand: `chmod +x "${step.chmodx}"`,
      params: { file: step.chmodx },
    });
    return;
  }

  // Write config file
  if (step.write_config) {
    analysis.executionSteps.push({
      type: 'write_config',
      description: `Write config: ${step.write_config.file}`,
      params: { ...step.write_config },
    });
    return;
  }
}

/**
 * Generate shell commands for a Lutris script
 * These can be executed in order within a Wine container
 */
export function generateShellCommands(
  analysis: LutrisScriptAnalysis,
  context: LutrisExecutionContext
): string[] {
  const commands: string[] = [];

  // Variable substitution helper
  const substitute = (str: string): string => {
    return str
      .replace(/\$GAMEDIR/g, context.gameDir)
      .replace(/\$CACHE/g, context.cacheDir)
      .replace(/\$HOME/g, '/home/gameuser')
      .replace(/\$WINEPREFIX/g, context.gameDir);
  };

  // Create cache directory
  commands.push(`mkdir -p "${context.cacheDir}"`);

  // Process each execution step
  for (const step of analysis.executionSteps) {
    switch (step.type) {
      case 'extract': {
        const params = step.params as { file: string; dst: string; format?: string };
        const src = substitute(context.files[params.file] || params.file);
        const dst = substitute(params.dst);
        
        if (params.format === 'innoextract') {
          commands.push(`innoextract -d "${dst}" "${src}"`);
        } else {
          // Auto-detect format
          commands.push(`# Extract ${src} to ${dst}`);
          commands.push(`mkdir -p "${dst}"`);
          commands.push(`7z x -o"${dst}" "${src}" || unzip -o "${src}" -d "${dst}" || tar -xf "${src}" -C "${dst}"`);
        }
        break;
      }
      
      case 'move': {
        const params = step.params as { src: string; dst: string };
        commands.push(`mv "${substitute(params.src)}" "${substitute(params.dst)}"`);
        break;
      }
      
      case 'merge': {
        const params = step.params as { src: string; dst: string };
        commands.push(`cp -r "${substitute(params.src)}"/* "${substitute(params.dst)}/" 2>/dev/null || cp -r "${substitute(params.src)}" "${substitute(params.dst)}/"`);
        break;
      }
      
      case 'mkdir': {
        const params = step.params as { directory: string };
        commands.push(`mkdir -p "${substitute(params.directory)}"`);
        break;
      }
      
      case 'chmodx': {
        const params = step.params as { file: string };
        commands.push(`chmod +x "${substitute(params.file)}"`);
        break;
      }
      
      case 'execute': {
        const params = step.params as { file?: string; command?: string; args?: string };
        if (params.command) {
          commands.push(substitute(params.command));
        } else if (params.file) {
          const args = params.args ? ` ${params.args}` : '';
          commands.push(`"${substitute(params.file)}"${args}`);
        }
        break;
      }
      
      case 'wineexec': {
        const params = step.params as { executable?: string; args?: string; prefix?: string };
        if (params.executable) {
          const exe = substitute(context.files[params.executable] || params.executable);
          const args = params.args ? ` ${params.args}` : '';
          commands.push(`wine "${exe}"${args}`);
        }
        break;
      }
      
      case 'set_regedit': {
        const params = step.params as { path?: string; key?: string; value?: string; type?: string };
        if (params.path && params.key) {
          const regType = params.type || 'REG_SZ';
          const value = params.value || '';
          commands.push(`wine reg add "${params.path}" /v "${params.key}" /t ${regType} /d "${value}" /f`);
        }
        break;
      }
      
      default:
        commands.push(`# Unhandled step type: ${step.type}`);
    }
  }

  return commands;
}

/**
 * Get common GOG installer arguments
 * Many Lutris scripts use these for silent installation
 */
export function getGogInstallerArgs(silent: boolean = true): string {
  if (silent) {
    return '/SP- /NOCANCEL /SUPPRESSMSGBOXES /VERYSILENT /NOGUI';
  }
  return '/SP- /NOCANCEL';
}

/**
 * Check if a script is a simple GOG Wine installer
 * (just runs the installer with args, no complex steps)
 */
export function isSimpleGogInstaller(analysis: LutrisScriptAnalysis): boolean {
  // A simple installer has:
  // - At most one wineexec step
  // - Possibly some winetricks
  // - No extract, move, merge, execute steps
  
  const complexSteps = analysis.executionSteps.filter(
    step => !['wineexec', 'winetricks'].includes(step.type)
  );
  
  const wineexecSteps = analysis.executionSteps.filter(
    step => step.type === 'wineexec'
  );
  
  return complexSteps.length === 0 && wineexecSteps.length <= 1;
}

/**
 * Summarize what a Lutris script does (for display to user)
 */
export function summarizeLutrisScript(analysis: LutrisScriptAnalysis): string {
  const parts: string[] = [];
  
  if (analysis.wineArch === 'win32') {
    parts.push('32-bit Wine prefix');
  }
  
  // Include recommendations in summary
  const recParts: string[] = [];
  if (analysis.recommendations.useDxvk === true) recParts.push('DXVK');
  if (analysis.recommendations.useDxvk === false) recParts.push('no-DXVK');
  if (analysis.recommendations.useEsync === true) recParts.push('esync');
  if (recParts.length > 0) {
    parts.push(`Recommends: ${recParts.join(', ')}`);
  }
  
  if (analysis.winetricks.length > 0) {
    parts.push(`Winetricks: ${analysis.winetricks.join(', ')}`);
  }
  
  if (Object.keys(analysis.dllOverrides).length > 0) {
    parts.push(`DLL overrides: ${Object.keys(analysis.dllOverrides).join(', ')}`);
  }
  
  if (Object.keys(analysis.environment).length > 0) {
    parts.push(`Env vars: ${Object.keys(analysis.environment).join(', ')}`);
  }
  
  const stepTypes = [...new Set(analysis.executionSteps.map(s => s.type))];
  if (stepTypes.length > 0) {
    parts.push(`Steps: ${stepTypes.join(', ')}`);
  }
  
  return parts.length > 0 ? parts.join(' | ') : 'Standard Wine installation';
}
