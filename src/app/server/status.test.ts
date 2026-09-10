import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
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

async function makeGitRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-status-test-'));
  roots.push(root);
  await mkdir(join(root, 'papercamp'), { recursive: true });
  await run('git', ['init', '-q'], { cwd: root });
  await run('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  await run('git', ['config', 'user.name', 'Test'], { cwd: root });
  await run('git', ['commit', '-q', '--allow-empty', '-m', 'init'], { cwd: root });
  return root;
}

describe('getCachedOrRunChecks', () => {
  it('reuses the last sweep result instead of re-running when HEAD has not moved', async () => {
    const root = await makeGitRoot();
    const git = createGitManager(root);
    const checks = createDeskCheckManager(root);
    const status = createStatusManager(root, checks, git);

    const headSha = await git.getHeadSha();
    status.getState().lastSweep = { headSha, failing: ['lint', 'docs'] };

    await expect(status.getCachedOrRunChecks()).resolves.toEqual(['lint', 'docs']);
  });
});
