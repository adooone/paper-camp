import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import {
  parseBranchLine,
  parseGitLogOutput,
  readFirstParentLog,
  resolveIdsWithMainActivity,
} from './git-log';

// `spawn` wrapped in a vi.fn so a test can count real git invocations — a bare
// vi.spyOn can't redefine this module's export.
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return { ...actual, spawn: vi.fn(actual.spawn) };
});
const spawnMock = vi.mocked(spawn);

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
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), `${file}\n`);
  git(root, 'add', '.');
  git(root, 'commit', '-m', body ? `${subject}\n\n${body}` : subject);
}

function commitFiles(root: string, files: string[], subject: string, body?: string): void {
  for (const file of files) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), `${file}\n`);
  }
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

    return resolveIdsWithMainActivity(root).then(({ ids }) => {
      expect(ids).toEqual(new Set(['IDEA-116', 'IDEA-9']));
    });
  });

  it('collects ids referenced by a squash-merge subject', () => {
    const root = initGitRepo();
    commit(root, 'a.txt', 'feat(app): Roadmap items become the subject vocabulary (IDEA-95) (#78)');

    return resolveIdsWithMainActivity(root).then(({ ids }) => {
      expect(ids).toEqual(new Set(['IDEA-95']));
    });
  });

  it('is empty when no commit references an id', () => {
    const root = initGitRepo();
    commit(root, 'a.txt', 'chore(repo): seed main');

    return resolveIdsWithMainActivity(root).then(({ ids }) => {
      expect(ids).toEqual(new Set());
    });
  });

  it('ignores a plan-draft commit that only touches papercamp/', () => {
    const root = initGitRepo();
    commit(root, 'papercamp/ideas/IDEA-243.md', 'docs(ideas): Auto-fix — plan', 'Refs: IDEA-243');

    return resolveIdsWithMainActivity(root).then(({ ids }) => {
      expect(ids).toEqual(new Set());
    });
  });

  it('counts a mixed commit that touches papercamp/ and other files', () => {
    const root = initGitRepo();
    commitFiles(
      root,
      ['papercamp/ideas/IDEA-243.md', 'src/core/status.ts'],
      'fix(core): Ignore corpus-only commits',
      'Refs: IDEA-243',
    );

    return resolveIdsWithMainActivity(root).then(({ ids }) => {
      expect(ids).toEqual(new Set(['IDEA-243']));
    });
  });

  it('is empty for a non-git directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'papercamp-git-log-plain-'));
    gitRoots.push(root);

    return resolveIdsWithMainActivity(root).then(({ ids }) => {
      expect(ids).toEqual(new Set());
    });
  });

  it('returns the resolved sha, and spawns no `git log` on a cache hit', async () => {
    const root = initGitRepo();
    commit(root, 'a.txt', 'feat(core): Add the thing', 'Refs: IDEA-116');
    const headSha = git(root, 'rev-parse', 'main');

    const first = await resolveIdsWithMainActivity(root);
    expect(first.sha).toBe(headSha);
    expect(first.ids).toEqual(new Set(['IDEA-116']));

    spawnMock.mockClear();
    const second = await resolveIdsWithMainActivity(root);
    expect(second.sha).toBe(headSha);
    expect(second.ids).toEqual(new Set(['IDEA-116']));
    expect(spawnMock.mock.calls.map(([, args]) => (args as string[])[0])).not.toContain('log');
  });
});

function initBareRemote(): string {
  const root = mkdtempSync(join(tmpdir(), 'papercamp-git-log-remote-'));
  gitRoots.push(root);
  git(root, 'init', '--bare', '-b', 'main');
  return root;
}

describe('parseGitLogOutput', () => {
  function record(fields: string[]): string {
    return `\x1e${fields.join('\x1f')}`;
  }

  it('splits the conventional prefix from the subject', () => {
    const output = record([
      'abc123',
      'fix(app): Redesign night report',
      '2026-09-19T00:00:00+00:00',
      '',
      '',
    ]);

    const [commit] = parseGitLogOutput(output, null, new Set());

    expect(commit.prefix).toBe('fix(app)');
    expect(commit.subject).toBe('Redesign night report');
  });

  it('leaves a subject with no conventional prefix untouched', () => {
    const output = record(['abc123', 'Redesign night report', '2026-09-19T00:00:00+00:00', '', '']);

    const [commit] = parseGitLogOutput(output, null, new Set());

    expect(commit.prefix).toBe('');
    expect(commit.subject).toBe('Redesign night report');
  });

  it('pulls release tags out of the decoration field', () => {
    const output = record([
      'abc123',
      'chore(main): release 0.35.1',
      '2026-09-19T00:00:00+00:00',
      'HEAD -> main, tag: v0.35.1, tag: paper-camp-v0.35.1',
      '',
    ]);

    const [commit] = parseGitLogOutput(output, null, new Set());

    expect(commit.tags).toEqual(['v0.35.1', 'paper-camp-v0.35.1']);
  });

  it('marks the commit where the upstream head sits', () => {
    const output = record([
      'abc123',
      'chore: seed',
      '2026-09-19T00:00:00+00:00',
      'HEAD -> main, origin/main',
      '',
    ]);

    const [commit] = parseGitLogOutput(output, 'origin/main', new Set());

    expect(commit.isUpstreamHead).toBe(true);
  });

  it('reads the idea id from the Refs trailer', () => {
    const output = record([
      'abc123',
      'fix(app): Do the thing',
      '2026-09-19T00:00:00+00:00',
      '',
      'IDEA-274',
    ]);

    const [commit] = parseGitLogOutput(output, null, new Set());

    expect(commit.ideaId).toBe('IDEA-274');
  });

  it('is null when there is no Refs trailer', () => {
    const output = record([
      'abc123',
      'fix(app): Do the thing',
      '2026-09-19T00:00:00+00:00',
      '',
      '',
    ]);

    const [commit] = parseGitLogOutput(output, null, new Set());

    expect(commit.ideaId).toBeNull();
  });

  it('marks every commit unpushed when there is no upstream', () => {
    const output = record(['abc123', 'chore: seed', '2026-09-19T00:00:00+00:00', '', '']);

    const [commit] = parseGitLogOutput(output, null, new Set());

    expect(commit.pushed).toBe(false);
  });

  it('marks a commit unpushed when it is in the rev-list set', () => {
    const output = record(['abc123', 'chore: seed', '2026-09-19T00:00:00+00:00', '', '']);

    const [commit] = parseGitLogOutput(output, 'origin/main', new Set(['abc123']));

    expect(commit.pushed).toBe(false);
  });

  it('marks a commit pushed when it has an upstream and is not in the rev-list set', () => {
    const output = record(['abc123', 'chore: seed', '2026-09-19T00:00:00+00:00', '', '']);

    const [commit] = parseGitLogOutput(output, 'origin/main', new Set());

    expect(commit.pushed).toBe(true);
  });

  it('parses multiple records in newest-first order', () => {
    const output =
      record(['second', 'chore: second', '2026-09-19T00:01:00+00:00', '', '']) +
      record(['first', 'chore: first', '2026-09-19T00:00:00+00:00', '', '']);

    const commits = parseGitLogOutput(output, null, new Set());

    expect(commits.map((c) => c.hash)).toEqual(['second', 'first']);
  });
});

describe('readFirstParentLog', () => {
  it('has no upstream and marks every commit unpushed on a branch with no remote', () => {
    const root = initGitRepo();
    commit(root, 'a.txt', 'chore: seed');
    commit(root, 'b.txt', 'feat(core): Add the thing', 'Refs: IDEA-1');

    return readFirstParentLog(root, 0).then((page) => {
      expect(page.upstream).toBeNull();
      expect(page.hasMore).toBe(false);
      expect(page.commits).toHaveLength(2);
      expect(page.commits.every((c) => !c.pushed)).toBe(true);
      expect(page.commits[0].subject).toBe('Add the thing');
      expect(page.commits[0].prefix).toBe('feat(core)');
      expect(page.commits[0].ideaId).toBe('IDEA-1');
    });
  });

  it('marks pushed commits and stamps the upstream head once a remote exists', async () => {
    const remote = initBareRemote();
    const root = initGitRepo();
    git(root, 'remote', 'add', 'origin', remote);
    commit(root, 'a.txt', 'chore: seed');
    git(root, 'push', '-u', 'origin', 'main');
    commit(root, 'b.txt', 'fix(app): Local only change');

    const page = await readFirstParentLog(root, 0);

    expect(page.upstream).toBe('origin/main');
    expect(page.commits).toHaveLength(2);
    const [local, pushed] = page.commits;
    expect(local.subject).toBe('Local only change');
    expect(local.pushed).toBe(false);
    expect(pushed.pushed).toBe(true);
    expect(pushed.isUpstreamHead).toBe(true);
  });

  it('paginates with skip and reports hasMore', async () => {
    const root = initGitRepo();
    for (let i = 0; i < 4; i++) {
      commit(root, `f${i}.txt`, `chore: commit ${i}`);
    }

    const firstPage = await readFirstParentLog(root, 0, 2);
    expect(firstPage.commits).toHaveLength(2);
    expect(firstPage.hasMore).toBe(true);
    expect(firstPage.commits.map((c) => c.subject)).toEqual(['commit 3', 'commit 2']);

    const secondPage = await readFirstParentLog(root, 2, 2);
    expect(secondPage.commits).toHaveLength(2);
    expect(secondPage.hasMore).toBe(false);
    expect(secondPage.commits.map((c) => c.subject)).toEqual(['commit 1', 'commit 0']);
  });
});

describe('parseBranchLine', () => {
  it('reads the current branch with its upstream and ahead/behind counts', () => {
    expect(
      parseBranchLine(
        'feat/idea-294-compact-ideas\t*\torigin/feat/idea-294-compact-ideas\tahead 3, behind 1\t2026-10-13T07:20:34+00:00',
      ),
    ).toEqual({
      name: 'feat/idea-294-compact-ideas',
      current: true,
      upstream: 'origin/feat/idea-294-compact-ideas',
      ahead: 3,
      behind: 1,
      gone: false,
      date: '2026-10-13T07:20:34+00:00',
      ideaId: 'IDEA-294',
    });
  });

  it('marks a branch whose upstream was deleted, and ties ticket branches to their ticket', () => {
    expect(
      parseBranchLine('feat/ticket-4-import\t \torigin/feat/ticket-4-import\tgone\t'),
    ).toMatchObject({
      current: false,
      gone: true,
      ideaId: 'TICKET-4',
    });
  });

  it('leaves a branch with no upstream and no entity id plain', () => {
    expect(parseBranchLine('spike\t \t\t\t')).toMatchObject({
      upstream: null,
      ahead: 0,
      behind: 0,
      ideaId: null,
    });
  });
});
