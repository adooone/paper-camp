import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MissingFixCmdError, createDeskCheckManager } from './desk-checks';

async function tmpRoot(cmd: string, fixCmd?: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-desk-checks-'));
  await mkdir(join(root, 'papercamp'), { recursive: true });
  await writeFile(
    join(root, 'papercamp', 'config.json'),
    JSON.stringify({ desk: { checks: [{ name: 'test', cmd, fixCmd }] } }),
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

describe('runFix', () => {
  it('runs the fix command, re-runs the check, and returns the refreshed state', async () => {
    const root = await tmpRoot('test -f marker.txt', 'touch marker.txt');
    const { runFix } = createDeskCheckManager(root);

    const state = await runFix('test');

    expect(state.name).toBe('test');
    expect(state.status).toBe('pass');
  });

  it('rejects a check with no fix command', async () => {
    const root = await tmpRoot('true');
    const { runFix } = createDeskCheckManager(root);

    await expect(runFix('test')).rejects.toThrow(MissingFixCmdError);
  });

  it('rejects an unknown check name', async () => {
    const root = await tmpRoot('true', 'true');
    const { runFix } = createDeskCheckManager(root);

    await expect(runFix('ghost')).rejects.toThrow(/ghost/);
  });
});
