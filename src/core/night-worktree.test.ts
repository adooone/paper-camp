import { spawnSync } from 'node:child_process';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  addNightWorktree,
  diffChunkSinceCommit,
  listChunkFiles,
  removeNightWorktree,
  resolveHeadCommit,
} from './night-worktree';

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf-8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function initGitRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-night-worktree-'));
  dirs.push(root);
  git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test User');
  git(root, 'config', 'commit.gpgsign', 'false');
  return root;
}

async function commitFiles(root: string, files: Record<string, string>, subject: string) {
  for (const [file, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), content, 'utf-8');
  }
  git(root, 'add', '.');
  git(root, 'commit', '-m', subject);
  return git(root, 'rev-parse', 'HEAD');
}

describe('addNightWorktree / removeNightWorktree', () => {
  it('checks out the given commit into a fresh directory, then removes it cleanly', async () => {
    const root = await initGitRepo();
    const first = await commitFiles(root, { 'a.txt': 'v1\n' }, 'v1');
    await commitFiles(root, { 'a.txt': 'v2\n' }, 'v2');

    const worktreePath = await addNightWorktree(root, first);
    expect(await access(join(worktreePath, 'a.txt')).then(() => true)).toBe(true);
    const content = await import('node:fs/promises').then((fs) =>
      fs.readFile(join(worktreePath, 'a.txt'), 'utf-8'),
    );
    expect(content).toBe('v1\n');

    await removeNightWorktree(root, worktreePath);
    await expect(access(worktreePath)).rejects.toThrow();
    expect(git(root, 'worktree', 'list', '--porcelain')).not.toContain(worktreePath);
  });

  it('rejects for a commit that does not exist', async () => {
    const root = await initGitRepo();
    await commitFiles(root, { 'a.txt': 'v1\n' }, 'v1');
    await expect(
      addNightWorktree(root, 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'),
    ).rejects.toThrow();
  });
});

describe('resolveHeadCommit', () => {
  it('resolves the current HEAD sha', async () => {
    const root = await initGitRepo();
    const sha = await commitFiles(root, { 'a.txt': 'v1\n' }, 'v1');
    expect(await resolveHeadCommit(root)).toBe(sha);
  });
});

describe('listChunkFiles', () => {
  it('lists files under the chunk path at the given commit, not outside it', async () => {
    const root = await initGitRepo();
    const sha = await commitFiles(
      root,
      { 'src/app/a.ts': 'a', 'src/app/sub/b.ts': 'b', 'src/core/c.ts': 'c' },
      'seed',
    );
    expect((await listChunkFiles(root, sha, 'src/app')).sort()).toEqual([
      'src/app/a.ts',
      'src/app/sub/b.ts',
    ]);
  });

  it('is empty for a chunk with no files at that commit', async () => {
    const root = await initGitRepo();
    const sha = await commitFiles(root, { 'a.txt': 'v1' }, 'v1');
    expect(await listChunkFiles(root, sha, 'src/missing')).toEqual([]);
  });
});

describe('diffChunkSinceCommit', () => {
  it('is empty when there is no prior commit to diff against', async () => {
    const root = await initGitRepo();
    const sha = await commitFiles(root, { 'src/app/a.ts': 'v1\n' }, 'v1');
    expect(await diffChunkSinceCommit(root, 'src/app', null, sha)).toBe('');
  });

  it('diffs only the chunk path between two commits', async () => {
    const root = await initGitRepo();
    const first = await commitFiles(
      root,
      { 'src/app/a.ts': 'v1\n', 'src/core/c.ts': 'v1\n' },
      'v1',
    );
    const second = await commitFiles(
      root,
      { 'src/app/a.ts': 'v2\n', 'src/core/c.ts': 'v2\n' },
      'v2',
    );
    const diff = await diffChunkSinceCommit(root, 'src/app', first, second);
    expect(diff).toContain('src/app/a.ts');
    expect(diff).not.toContain('src/core/c.ts');
  });
});
