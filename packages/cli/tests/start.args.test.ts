import { describe, expect, it } from 'vitest';
import { buildStartDockerArgs } from '../src/commands/start.js';

describe('buildStartDockerArgs', () => {
  it('includes default passthroughs', () => {
    const args = buildStartDockerArgs('dillinger', 'dillinger_root', 'img:1.0.0', 3010, {
      detach: true,
      noUpdateCheck: true,
    });

    expect(args).toContain('/dev/dri:/dev/dri');
    expect(args).toContain('/dev/input:/dev/input');
    expect(args).toContain('/dev/snd:/dev/snd');
    expect(args).toContain('/tmp/.X11-unix:/tmp/.X11-unix:rw');
    expect(args).toContain('-d');
    expect(args.at(-1)).toBe('img:1.0.0');
  });

  it('omits disabled passthroughs', () => {
    const args = buildStartDockerArgs('dillinger', 'dillinger_root', 'img:1.0.0', 3010, {
      gpu: false,
      audio: false,
      display: false,
      input: false,
      detach: false,
    });

    expect(args.join(' ')).not.toContain('/dev/dri:/dev/dri');
    expect(args.join(' ')).not.toContain('/dev/input:/dev/input');
    expect(args.join(' ')).not.toContain('/dev/snd:/dev/snd');
    expect(args.join(' ')).not.toContain('/tmp/.X11-unix:/tmp/.X11-unix:rw');
    expect(args).not.toContain('-d');
  });
});
