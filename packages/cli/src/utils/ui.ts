import chalk from 'chalk';
import ora from 'ora';

export const log = {
  info: (message: string): void => console.log(chalk.cyan(`ℹ ${message}`)),
  success: (message: string): void => console.log(chalk.green(`✓ ${message}`)),
  warn: (message: string): void => console.log(chalk.yellow(`⚠ ${message}`)),
  error: (message: string): void => console.error(chalk.red(`✗ ${message}`)),
  plain: (message: string): void => console.log(message),
};

export function createSpinner(text: string) {
  return ora({ text, isSilent: false }).start();
}
