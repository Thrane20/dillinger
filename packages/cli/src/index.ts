#!/usr/bin/env node

import { Command } from 'commander';
import { startCommand } from './commands/start.js';
import { stopCommand } from './commands/stop.js';
import { restartCommand } from './commands/restart.js';
import { statusCommand } from './commands/status.js';
import { logsCommand } from './commands/logs.js';
import { doctorCommand } from './commands/doctor.js';
import {
  volumeBackupCommand,
  volumeCreateCommand,
  volumeDestroyCommand,
  volumeListCommand,
  volumeRestoreCommand,
  volumeVerifyCommand,
} from './commands/volume.js';
import { configResetCommand, configSetCommand, configShowCommand } from './commands/config.js';
import { udevCommand } from './commands/udev.js';
import { notifyCliUpdates, updateApplyCommand, updateCheckCommand } from './commands/update.js';
import { setAutoYes } from './utils/prompts.js';

async function main(): Promise<void> {
  const program = new Command();

  await notifyCliUpdates(new URL('../package.json', import.meta.url).pathname);

  program
    .name('dillinger-gaming')
    .description('Dillinger Gaming CLI')
    .option('-y, --yes', 'Skip interactive prompts')
    .option('--verbose', 'Verbose output')
    .option('--quiet', 'Quiet output')
    .hook('preAction', (thisCommand) => {
      const rootOptions = thisCommand.opts<{ yes?: boolean }>();
      setAutoYes(Boolean(rootOptions.yes));
    });

  program
    .command('start')
    .option('--port <number>', 'Web UI host port')
    .option('--detach', 'Run container in detached mode', true)
    .option('--no-update-check', 'Skip update checks')
    .option('--no-gpu', 'Disable GPU passthrough')
    .option('--no-audio', 'Disable audio passthrough')
    .option('--no-display', 'Disable display passthrough')
    .option('--no-input', 'Disable input device passthrough')
    .action(startCommand);

  program.command('stop').option('--remove', 'Remove container after stopping').action(stopCommand);
  program.command('restart').action(restartCommand);
  program.command('status').action(statusCommand);
  program.command('logs').option('-f, --follow', 'Follow logs').option('--tail <lines>', 'Tail lines', '100').action(logsCommand);

  const update = program.command('update').description('Check and apply updates');
  update.command('check').action(updateCheckCommand);
  update.command('apply').action(updateApplyCommand);

  const volume = program.command('volume').description('Manage Dillinger volume');
  volume.command('list').action(volumeListCommand);
  volume.command('create').option('--bind <path>', 'Bind volume to host path').action(volumeCreateCommand);
  volume.command('verify').action(volumeVerifyCommand);
  volume.command('backup <file>').action(volumeBackupCommand);
  volume.command('restore <file>').action(volumeRestoreCommand);
  volume.command('destroy').option('--force', 'Skip confirmation').action(volumeDestroyCommand);

  const config = program.command('config').description('CLI configuration');
  config.command('show').action(configShowCommand);
  config.command('set <key> <value>').action(configSetCommand);
  config.command('reset').action(configResetCommand);

  program.command('doctor').action(doctorCommand);
  program.command('udev').action(udevCommand);

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
