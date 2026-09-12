import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, describe, expect, it } from 'vitest';
import { createDeskCheckManager } from './desk-checks';
import { createGitManager } from './git';
import { createStatusManager } from './status';

const run = promisify(execFile);
const roots: string[] = [];

afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

async function makeGitRoot(lintCmd?: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-status-test-'));
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

describe('getCachedOrRunChecks', () => {
  it("reuses every check's own last result once each was produced on the current HEAD", async () => {
    const root = await makeGitRoot('false');
    const git = createGitManager(root);
    const checks = createDeskCheckManager(root, () => git.getHeadSha());
    const status = createStatusManager(root, checks, git);
    const headSha = await git.getHeadSha();

    checks.getState().runtimes.set('lint', { status: 'fail', lastRun: '', output: '', headSha });
    status.getState().docs = { headSha, passed: true, output: '' };

    // Every result is already on this HEAD, so none of them re-run — lint's cmd
    // ('false') would flip the outcome to failing if it did.
    await expect(status.getCachedOrRunChecks()).resolves.toEqual([{ name: 'lint', output: '' }]);
  });

  it('runs only the checks missing a same-HEAD result', async () => {
    const root = await makeGitRoot('true');
    const git = createGitManager(root);
    const checks = createDeskCheckManager(root, () => git.getHeadSha());
    const status = createStatusManager(root, checks, git);
    const headSha = await git.getHeadSha();

    status.getState().docs = { headSha, passed: true, output: '' };
    // lint has no cached result yet, so it's the only check this call runs for real.

    await expect(status.getCachedOrRunChecks()).resolves.toEqual([]);
    expect(checks.getState().runtimes.get('lint')).toEqual(
      expect.objectContaining({ status: 'pass', headSha }),
    );
  });
});
