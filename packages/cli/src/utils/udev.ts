import { execa } from 'execa';
import { readFile, writeFile } from 'node:fs/promises';
import { UDEV_RULES_FILE, WOLF_UDEV_RULES } from './constants.js';

export async function hasUdevRulesInstalled(): Promise<boolean> {
  try {
    const content = await readFile(UDEV_RULES_FILE, 'utf-8');
    return content.includes('Wolf Virtual Input Rules');
  } catch {
    return false;
  }
}

export async function installUdevRules(): Promise<void> {
  try {
    await writeFile(UDEV_RULES_FILE, WOLF_UDEV_RULES, { encoding: 'utf-8' });
  } catch {
    await execa('sudo', ['tee', UDEV_RULES_FILE], {
      input: WOLF_UDEV_RULES,
      stdout: 'ignore',
      stderr: 'inherit',
    });
  }

  await execa('sudo', ['udevadm', 'control', '--reload-rules'], { stdio: 'inherit' });
  await execa('sudo', ['udevadm', 'trigger'], { stdio: 'inherit' });
}
