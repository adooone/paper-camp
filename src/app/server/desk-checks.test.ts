import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createDeskCheckManager } from './desk-checks';

async function tmpRoot(cmd: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-desk-checks-'));
  await mkdir(join(root, 'papercamp'), { recursive: true });
  await writeFile(
    join(root, 'papercamp', 'config.json'),
    JSON.stringify({ desk: { checks: [{ name: 'test', cmd }] } }),
  );
  return root;
}

describe('runCheck', () => {
  it('joins a run already in flight instead of spawning a second process for the same check', async () => {
    const countFile = join(tmpdir(), `papercamp-desk-checks-count-${Date.now()}.txt`);
    const root = await tmpRoot(`sleep 0.1 && echo run >> ${countFile}`);
    const { runCheck } = createDeskCheckManager(root);

    const [first, second] = await Promise.all([runCheck('test'), runCheck('test')]);

    expect(first).toBe('pass');
    expect(second).toBe('pass');
    const runs = (await readFile(countFile, 'utf-8')).trim().split('\n');
    expect(runs).toHaveLength(1);
  });

  it('spawns a fresh process once the prior run has finished', async () => {
    const countFile = join(tmpdir(), `papercamp-desk-checks-count-${Date.now()}.txt`);
    const root = await tmpRoot(`echo run >> ${countFile}`);
    const { runCheck } = createDeskCheckManager(root);

    await runCheck('test');
    await runCheck('test');

    const runs = (await readFile(countFile, 'utf-8')).trim().split('\n');
    expect(runs).toHaveLength(2);
  });
});
