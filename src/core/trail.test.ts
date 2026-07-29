import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearPrCache } from './git-pr/pr-lookup';
import { formatEntityFile } from './serialize/serializer';
import {
  findReleaseLineForId,
  resolveEntityIdForCommit,
  resolveEntityTrail,
  resolveIdFromCommitMessage,
} from './trail';

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf-8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

const gitRoots: string[] = [];

function initGitRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'papercamp-trail-git-'));
  gitRoots.push(root);
  git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test User');
  git(root, 'config', 'commit.gpgsign', 'false');
  return root;
}

afterAll(() => {
  for (const root of gitRoots) rmSync(root, { recursive: true, force: true });
});

const originalPath = process.env.PATH;

function installFailingGh(): void {
  const dir = mkdtempSync(join(tmpdir(), 'papercamp-trail-gh-'));
  writeFileSync(join(dir, 'gh'), '#!/bin/sh\nexit 1\n');
  chmodSync(join(dir, 'gh'), 0o755);
  process.env.PATH = `${dir}:${process.env.PATH}`;
}

function installGh(rows: object[]): void {
  const dir = mkdtempSync(join(tmpdir(), 'papercamp-trail-gh-'));
  writeFileSync(join(dir, 'gh'), `#!/bin/sh\necho '${JSON.stringify(rows)}'\n`);
  chmodSync(join(dir, 'gh'), 0o755);
  process.env.PATH = `${dir}:${process.env.PATH}`;
}

beforeEach(() => {
  clearPrCache();
  installFailingGh();
});
afterEach(() => {
  process.env.PATH = originalPath;
  clearPrCache();
});

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'papercamp-trail-root-'));
  mkdirSync(join(root, 'papercamp', 'ideas', 'archive'), { recursive: true });
  return root;
}

function writeIdea(root: string, entity: Parameters<typeof formatEntityFile>[0]): void {
  writeFileSync(
    join(root, 'papercamp', 'ideas', `${entity.id}.md`),
    `${formatEntityFile(entity)}\n`,
  );
}

describe('findReleaseLineForId', () => {
  it('finds the line stamped with the id', () => {
    const changelog = [
      '# Changelog',
      '* **app:** Something else ([abc](url))',
      '* **core:** Trace an idea from roadmap to release (IDEA-93) ([def](url))',
    ].join('\n');
    expect(findReleaseLineForId(changelog, 'IDEA-93')).toBe(
      '* **core:** Trace an idea from roadmap to release (IDEA-93) ([def](url))',
    );
  });

  it('returns undefined when no line carries the id', () => {
    expect(
      findReleaseLineForId('# Changelog\n* **app:** Something else', 'IDEA-93'),
    ).toBeUndefined();
  });
});

describe('resolveEntityTrail', () => {
  it('assembles the idea, phases, task runs, PR and release line for an entity', async () => {
    const root = makeRoot();
    writeIdea(root, {
      id: 'IDEA-93',
      title: 'Trace an idea from roadmap to release',
      type: 'feat',
      status: 'in-progress',
      created: '2026-07-25',
      tags: ['core'],
      body: 'Provenance trail.',
      phases: [{ text: 'Model the provenance trail', done: false }],
    });
    writeFileSync(
      join(root, 'papercamp', 'tasks.log'),
      `${JSON.stringify({
        id: 't1',
        taskKind: 'run',
        planId: 'IDEA-93',
        planTitle: 'Trace an idea from roadmap to release',
        agentId: 'claude-code',
        startedAt: '2026-07-26T00:00:00Z',
        endedAt: '2026-07-26T00:01:00Z',
        outcome: 'done',
      })}\n`,
    );
    writeFileSync(
      join(root, 'CHANGELOG.md'),
      '# Changelog\n* **core:** Trace an idea from roadmap to release (IDEA-93) ([abc](url))\n',
    );

    const trail = await resolveEntityTrail(root, 'IDEA-93');

    expect(trail.idea).toEqual({
      reached: true,
      data: { title: 'Trace an idea from roadmap to release', status: 'in-progress', type: 'feat' },
    });
    expect(trail.phases.reached).toBe(true);
    expect(trail.phases.data).toHaveLength(1);
    expect(trail.taskRuns.reached).toBe(true);
    expect(trail.taskRuns.data).toHaveLength(1);
    expect(trail.commits).toEqual({ reached: false });
    expect(trail.pr).toEqual({ reached: false });
    expect(trail.releaseLine).toEqual({
      reached: true,
      data: '* **core:** Trace an idea from roadmap to release (IDEA-93) ([abc](url))',
    });
  });

  it('resolves the PR when gh reports one', async () => {
    const root = makeRoot();
    writeIdea(root, {
      id: 'IDEA-1',
      title: 'Some work',
      type: 'feat',
      status: 'in-progress',
      created: '2026-07-01',
      tags: [],
      body: 'x',
    });
    installGh([
      {
        number: 7,
        url: 'https://github.com/o/r/pull/7',
        state: 'OPEN',
        isDraft: false,
        headRefName: 'feat/idea-1-some-work',
        body: '',
        reviewDecision: '',
      },
    ]);

    const trail = await resolveEntityTrail(root, 'IDEA-1');

    expect(trail.pr.reached).toBe(true);
    expect(trail.pr.data?.number).toBe(7);
  });

  it('resolves branch commits ahead of main for the entity', async () => {
    const root = initGitRepo();
    mkdirSync(join(root, 'papercamp', 'ideas', 'archive'), { recursive: true });
    writeFileSync(join(root, 'a.txt'), 'a\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'chore(repo): seed main');
    git(root, 'checkout', '-b', 'feat/idea-1-some-work');
    writeFileSync(join(root, 'b.txt'), 'b\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'feat(core): Add the thing');

    const trail = await resolveEntityTrail(root, 'IDEA-1');

    expect(trail.commits).toEqual({ reached: true, data: ['feat(core): Add the thing'] });
  });

  it('marks every hop unreached for an unknown id', async () => {
    const root = makeRoot();
    const trail = await resolveEntityTrail(root, 'IDEA-999');
    expect(trail).toEqual({
      id: 'IDEA-999',
      idea: { reached: false },
      phases: { reached: false },
      taskRuns: { reached: false },
      commits: { reached: false },
      pr: { reached: false },
      releaseLine: { reached: false },
    });
  });
});

describe('resolveIdFromCommitMessage', () => {
  it('reads the id off a Refs: trailer', () => {
    expect(
      resolveIdFromCommitMessage('feat(core): Model the provenance trail\n\nRefs: IDEA-93'),
    ).toBe('IDEA-93');
  });

  it('reads the id off a squash-merge title', () => {
    expect(
      resolveIdFromCommitMessage(
        'feat(core): Roadmap items become the subject vocabulary (IDEA-95) (#78)',
      ),
    ).toBe('IDEA-95');
  });

  it('reads the id off a CHANGELOG release line', () => {
    expect(
      resolveIdFromCommitMessage(
        '* **ci:** One release line per idea (IDEA-83) ([d7d7a51](https://github.com/o/r/commit/d7d7a51c6450b3fade9684225284e54604ba39b1))',
      ),
    ).toBe('IDEA-83');
  });

  it('returns null when nothing is stamped', () => {
    expect(resolveIdFromCommitMessage('fix(app): Address IDEA-77 review comments')).toBeNull();
    expect(resolveIdFromCommitMessage('chore(repo): updates')).toBeNull();
  });
});

describe('resolveEntityIdForCommit', () => {
  it('resolves the id from the commit message trailer', () => {
    const root = initGitRepo();
    writeFileSync(join(root, 'a.txt'), 'a\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'feat(core): Do the thing', '-m', 'Refs: IDEA-1');
    const sha = git(root, 'rev-parse', 'HEAD');

    return resolveEntityIdForCommit(root, sha).then((id) => expect(id).toBe('IDEA-1'));
  });

  it('falls back to the CHANGELOG when the commit carries no id itself', () => {
    const root = initGitRepo();
    writeFileSync(join(root, 'a.txt'), 'a\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'chore(repo): updates');
    const sha = git(root, 'rev-parse', 'HEAD');
    writeFileSync(
      join(root, 'CHANGELOG.md'),
      `# Changelog\n* **repo:** updates (IDEA-2) ([${sha.slice(0, 7)}](https://github.com/o/r/commit/${sha}))\n`,
    );

    return resolveEntityIdForCommit(root, sha).then((id) => expect(id).toBe('IDEA-2'));
  });

  it('returns null for an untraceable commit', () => {
    const root = initGitRepo();
    writeFileSync(join(root, 'a.txt'), 'a\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'chore(repo): updates');
    const sha = git(root, 'rev-parse', 'HEAD');

    return resolveEntityIdForCommit(root, sha).then((id) => expect(id).toBeNull());
  });

  it('rejects an option-like sha instead of forwarding it to git', () => {
    const root = initGitRepo();
    writeFileSync(join(root, 'a.txt'), 'a\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'chore(repo): updates');
    const poc = join(root, 'owned');

    return resolveEntityIdForCommit(root, `--output=${poc}`).then((id) => {
      expect(id).toBeNull();
      expect(existsSync(poc)).toBe(false);
    });
  });
});
