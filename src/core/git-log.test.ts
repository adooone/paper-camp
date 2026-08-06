import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { resolveIdsWithMainActivity } from './git-log';

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf-8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

const gitRoots: string[] = [];

function initGitRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'papercamp-git-log-'));
  gitRoots.push(root);
  git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test User');
  git(root, 'config', 'commit.gpgsign', 'false');
  return root;
}

function commit(root: string, file: string, subject: string, body?: string): void {
  writeFileSync(join(root, file), `${file}\n`);
  git(root, 'add', '.');
  git(root, 'commit', '-m', body ? `${subject}\n\n${body}` : subject);
}

afterAll(() => {
  for (const root of gitRoots) rmSync(root, { recursive: true, force: true });
});

describe('resolveIdsWithMainActivity', () => {
  it('collects ids referenced by a Refs: trailer on main', () => {
    const root = initGitRepo();
    commit(root, 'a.txt', 'feat(core): Add the thing', 'Refs: IDEA-116');
    commit(root, 'b.txt', 'fix(app): Tweak it', 'Refs: IDEA-9');

    return resolveIdsWithMainActivity(root).then((ids) => {
      expect(ids).toEqual(new Set(['IDEA-116', 'IDEA-9']));
    });
  });

  it('collects ids referenced by a squash-merge subject', () => {
    const root = initGitRepo();
    commit(root, 'a.txt', 'feat(app): Roadmap items become the subject vocabulary (IDEA-95) (#78)');

    return resolveIdsWithMainActivity(root).then((ids) => {
      expect(ids).toEqual(new Set(['IDEA-95']));
    });
  });

  it('is empty when no commit references an id', () => {
    const root = initGitRepo();
    commit(root, 'a.txt', 'chore(repo): seed main');

    return resolveIdsWithMainActivity(root).then((ids) => {
      expect(ids).toEqual(new Set());
    });
  });

  it('is empty for a non-git directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'papercamp-git-log-plain-'));
    gitRoots.push(root);

    return resolveIdsWithMainActivity(root).then((ids) => {
      expect(ids).toEqual(new Set());
    });
  });
});
