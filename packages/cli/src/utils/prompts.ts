import inquirer from 'inquirer';

let autoYes = false;

export function setAutoYes(value: boolean): void {
  autoYes = value;
}

export async function confirm(message: string, defaultValue = true): Promise<boolean> {
  if (autoYes) {
    return true;
  }

  const result = await inquirer.prompt<{ ok: boolean }>([
    {
      type: 'confirm',
      name: 'ok',
      message,
      default: defaultValue,
    },
  ]);

  return result.ok;
}

export async function select<T extends string>(
  message: string,
  choices: Array<{ name: string; value: T }>,
): Promise<T> {
  const result = await inquirer.prompt<{ choice: T }>([
    {
      type: 'list',
      name: 'choice',
      message,
      choices,
    },
  ]);

  return result.choice;
}

export async function input(message: string, defaultValue?: string): Promise<string> {
  const result = await inquirer.prompt<{ value: string }>([
    {
      type: 'input',
      name: 'value',
      message,
      default: defaultValue,
    },
  ]);

  return result.value;
}
