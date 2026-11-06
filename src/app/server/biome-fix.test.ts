import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runBiomeFix } from './biome-fix';

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

describe('runBiomeFix', () => {
  let root = '';

  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
  });

  it('kills the whole process chain when it times out', async () => {
    root = await mkdtemp(join(tmpdir(), 'papercamp-biome-fix-'));
    await runBiomeFix(root, 'sleep 30 & echo $! > child.pid; wait', 300);
    const childPid = Number((await readFile(join(root, 'child.pid'), 'utf8')).trim());
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(isAlive(childPid)).toBe(false);
  });

  it('resolves once a command that exits on its own finishes', async () => {
    root = await mkdtemp(join(tmpdir(), 'papercamp-biome-fix-'));
    const started = Date.now();
    await runBiomeFix(root, 'exit 1', 5000);
    expect(Date.now() - started).toBeLessThan(5000);
  });
});
