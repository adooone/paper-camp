import { describe, expect, it } from 'vitest';
import { run } from './run';

describe('run', () => {
  it('resolves with the exit code and captured output', async () => {
    const result = await run('node', ['-e', 'process.stdout.write("hi")'], process.cwd());
    expect(result).toEqual({ code: 0, stdout: 'hi', stderr: '', timedOut: false });
  });

  it('reports a non-zero exit without treating it as a timeout', async () => {
    const result = await run('node', ['-e', 'process.exit(1)'], process.cwd());
    expect(result).toMatchObject({ code: 1, timedOut: false });
  });

  it('kills a hanging process once the given timeout elapses, and flags it as timed out', async () => {
    const result = await run('node', ['-e', 'setTimeout(() => {}, 5000)'], process.cwd(), 50);
    expect(result).toMatchObject({ code: null, timedOut: true });
  });

  it('does not report a missing binary as timed out', async () => {
    const result = await run('paper-camp-definitely-not-a-real-binary', [], process.cwd(), 50);
    expect(result).toEqual({ code: null, stdout: '', stderr: '', timedOut: false });
  });
});
