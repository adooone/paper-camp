import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { logLastCommit } from './post-commit-log';

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeGitProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-post-commit-'));
  dirs.push(root);
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: root });
  await mkdir(join(root, 'papercamp'), { recursive: true });
  return root;
}

function commit(root: string, message: string): void {
  execFileSync('git', ['commit', '--allow-empty', '-q', '-m', message], { cwd: root });
}

describe('logLastCommit', () => {
  it('appends a bullet under today under a fresh papercamp/progress.md', async () => {
    const root = await makeGitProject();
    commit(root, 'feat(cli): add a thing');

    await logLastCommit(root);

    const progress = await readFile(join(root, 'papercamp', 'progress.md'), 'utf-8');
    expect(progress).toContain('Commit: feat(cli): add a thing');
  });

  it('prepends under an existing today heading rather than replacing it', async () => {
    const root = await makeGitProject();
    const today = new Date().toISOString().slice(0, 10);
    await writeFile(join(root, 'papercamp', 'progress.md'), `## ${today}\n- earlier bullet\n`);
    commit(root, 'fix(core): fix a bug');

    await logLastCommit(root);

    const progress = await readFile(join(root, 'papercamp', 'progress.md'), 'utf-8');
    const lines = progress.trimEnd().split('\n');
    expect(lines).toEqual([`## ${today}`, '- Commit: fix(core): fix a bug', '- earlier bullet']);
  });

  it('is a no-op outside a papercamp/ project', async () => {
    const root = await mkdtemp(join(tmpdir(), 'papercamp-post-commit-none-'));
    dirs.push(root);
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: root });
    commit(root, 'chore: unrelated repo');

    await logLastCommit(root);

    await expect(readFile(join(root, 'papercamp', 'progress.md'), 'utf-8')).rejects.toThrow();
  });
});
