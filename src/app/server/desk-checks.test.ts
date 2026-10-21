import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { corpusFingerprint } from '@/core/corpus';
import { afterAll, describe, expect, it } from 'vitest';
import { MissingFixCmdError, createDeskCheckManager } from './desk-checks';
import { createGitManager } from './git';

const run = promisify(execFile);
const roots: string[] = [];

afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

async function tmpRoot(cmd: string, fixCmd?: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-desk-checks-'));
  await mkdir(join(root, 'papercamp'), { recursive: true });
  await writeFile(
    join(root, 'papercamp', 'config.json'),
    JSON.stringify({ desk: { checks: [{ name: 'test', cmd, fixCmd }] } }),
  );
  return root;
}

async function makeGitRoot(lintCmd?: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-desk-checks-git-'));
  roots.push(root);
  await mkdir(join(root, 'papercamp'), { recursive: true });
  if (lintCmd) {
    await writeFile(
      join(root, 'papercamp', 'config.json'),
      JSON.stringify({ desk: { checks: [{ name: 'lint', cmd: lintCmd }] } }),
    );
  }
  await run('git', ['init', '-q'], { cwd: root });
  await run('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  await run('git', ['config', 'user.name', 'Test'], { cwd: root });
  await run('git', ['commit', '-q', '--allow-empty', '-m', 'init'], { cwd: root });
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

describe('runCheck fingerprint', () => {
  it('captures the fingerprint before the command runs, not after', async () => {
    const root = await tmpRoot('sleep 0.05');
    let calls = 0;
    const getFingerprint = async () => {
      calls += 1;
      return { headSha: `sha-${calls}`, treeHash: `tree-${calls}` };
    };
    const { runCheck, getState } = createDeskCheckManager(root, getFingerprint);

    await runCheck('test');

    expect(calls).toBe(1);
    expect(getState().runtimes.get('test')).toEqual(
      expect.objectContaining({ headSha: 'sha-1', treeHash: 'tree-1', status: 'pass' }),
    );
  });

  it('settles the check instead of hanging when the fingerprint lookup fails', async () => {
    const root = await tmpRoot('true');
    const getFingerprint = async () => {
      throw new Error('git unavailable');
    };
    const { runCheck, getState } = createDeskCheckManager(root, getFingerprint);

    const status = await runCheck('test');

    expect(status).toBe('pass');
    expect(getState().runtimes.get('test')).toEqual(
      expect.objectContaining({ headSha: null, treeHash: null, status: 'pass' }),
    );
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

describe('getCachedOrRunChecks', () => {
  it("reuses a check's own last result once it was produced on the current tree, but reruns after a second edit to the same file", async () => {
    const countFile = join(tmpdir(), `papercamp-desk-checks-count-${Date.now()}.txt`);
    const root = await makeGitRoot(`echo run >> ${countFile}`);
    await writeFile(join(root, 'tracked.txt'), 'one\n');
    await run('git', ['add', 'tracked.txt'], { cwd: root });
    await run('git', ['commit', '-q', '-m', 'add tracked'], { cwd: root });
    const git = createGitManager(root);
    const getFingerprint = async () => ({
      headSha: await git.getHeadSha(),
      treeHash: await git.getTreeHash(),
    });
    const { getCachedOrRunChecks, getState } = createDeskCheckManager(root, getFingerprint);
    getState().docs = {
      fingerprint: await corpusFingerprint(join(root, 'papercamp', 'ideas')),
      passed: true,
      output: '',
    };

    await writeFile(join(root, 'tracked.txt'), 'one\ntwo\n');
    await getCachedOrRunChecks();
    const runsAfterFirstEdit = (await readFile(countFile, 'utf-8')).trim().split('\n').length;

    // Same edit count as before but reused from cache, not re-run.
    await getCachedOrRunChecks();
    const runsAfterReuse = (await readFile(countFile, 'utf-8')).trim().split('\n').length;
    expect(runsAfterReuse).toBe(runsAfterFirstEdit);

    // A second edit to the already-modified file must still invalidate the stamp.
    await writeFile(join(root, 'tracked.txt'), 'one\ntwo\nthree\n');
    await getCachedOrRunChecks();
    const runsAfterSecondEdit = (await readFile(countFile, 'utf-8')).trim().split('\n').length;
    expect(runsAfterSecondEdit).toBeGreaterThan(runsAfterReuse);
  });

  it('runs only the checks missing a same-tree result', async () => {
    const root = await makeGitRoot('true');
    const git = createGitManager(root);
    const getFingerprint = async () => ({
      headSha: await git.getHeadSha(),
      treeHash: await git.getTreeHash(),
    });
    const { getCachedOrRunChecks, getState } = createDeskCheckManager(root, getFingerprint);
    const { headSha } = await getFingerprint();

    getState().docs = {
      fingerprint: await corpusFingerprint(join(root, 'papercamp', 'ideas')),
      passed: true,
      output: '',
    };
    // lint has no cached result yet, so it's the only check this call runs for real.

    await expect(getCachedOrRunChecks()).resolves.toEqual([]);
    expect(getState().runtimes.get('lint')).toEqual(
      expect.objectContaining({ status: 'pass', headSha }),
    );
  });
});
