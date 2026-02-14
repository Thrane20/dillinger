import { describe, expect, it } from 'vitest';
import { confirm, setAutoYes } from '../src/utils/prompts.js';

describe('prompts', () => {
  it('returns true immediately when auto-yes is enabled', async () => {
    setAutoYes(true);
    await expect(confirm('continue?')).resolves.toBe(true);
    setAutoYes(false);
  });
});
