import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { formatReleaseNotesMarkdown, resolveReleaseNotes } from './release-notes';
import { formatEntityFile } from './serialize/entity-file';

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf-8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

const gitRoots: string[] = [];

function initGitRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'papercamp-release-notes-git-'));
  gitRoots.push(root);
  git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test User');
  git(root, 'config', 'commit.gpgsign', 'false');
  mkdirSync(join(root, 'papercamp', 'ideas'), { recursive: true });
  return root;
}

afterAll(() => {
  for (const root of gitRoots) rmSync(root, { recursive: true, force: true });
});

function writeIdea(root: string, entity: Parameters<typeof formatEntityFile>[0]): void {
  writeFileSync(
    join(root, 'papercamp', 'ideas', `${entity.id}.md`),
    `${formatEntityFile(entity)}\n`,
  );
}

describe('resolveReleaseNotes', () => {
  it('groups shipped ideas by type, one row per idea, in first-shipped order', async () => {
    const root = initGitRepo();
    writeIdea(root, {
      id: 'IDEA-1',
      title: 'Add the thing',
      type: 'feat',
      status: 'done',
      created: '2026-07-01',
    });
    writeIdea(root, {
      id: 'IDEA-2',
      title: 'Fix the other thing',
      type: 'fix',
      status: 'done',
      created: '2026-07-01',
    });
    writeFileSync(join(root, 'a.txt'), 'a\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'chore(repo): seed main');
    git(root, 'tag', 'v0.1.0');

    writeFileSync(join(root, 'b.txt'), 'b\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'feat(core): Add the thing (IDEA-1) (#1)');

    writeFileSync(join(root, 'c.txt'), 'c\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'fix(core): Fix the other thing (IDEA-2) (#2)');

    writeFileSync(join(root, 'd.txt'), 'd\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'fix(core): Address it (IDEA-1) (#3)');
    git(root, 'tag', 'v0.2.0');

    writeFileSync(
      join(root, 'CHANGELOG.md'),
      '# Changelog\n\n## [0.2.0](https://github.com/o/r/compare/v0.1.0...v0.2.0) (2026-08-06)\n',
    );

    const sections = await resolveReleaseNotes(root, 'v0.2.0');

    expect(sections).toEqual([
      { label: 'Features', ideas: [{ id: 'IDEA-1', title: 'Add the thing' }] },
      { label: 'Bug Fixes', ideas: [{ id: 'IDEA-2', title: 'Fix the other thing' }] },
    ]);
  });

  it('returns null when the version has no range in the CHANGELOG', async () => {
    const root = initGitRepo();
    writeFileSync(join(root, 'CHANGELOG.md'), '# Changelog\n');

    expect(await resolveReleaseNotes(root, 'v9.9.9')).toBeNull();
  });

  it('skips a resolved idea id with no matching entity file', async () => {
    const root = initGitRepo();
    writeFileSync(join(root, 'a.txt'), 'a\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'chore(repo): seed main');
    git(root, 'tag', 'v0.1.0');

    writeFileSync(join(root, 'b.txt'), 'b\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'feat(core): Add the thing (IDEA-1) (#1)');
    git(root, 'tag', 'v0.2.0');

    writeFileSync(
      join(root, 'CHANGELOG.md'),
      '# Changelog\n\n## [0.2.0](https://github.com/o/r/compare/v0.1.0...v0.2.0) (2026-08-06)\n',
    );

    expect(await resolveReleaseNotes(root, 'v0.2.0')).toEqual([]);
  });
});

describe('formatReleaseNotesMarkdown', () => {
  it('renders a heading per section and a bullet per idea', () => {
    const markdown = formatReleaseNotesMarkdown('v0.2.0', [
      { label: 'Features', ideas: [{ id: 'IDEA-1', title: 'Add the thing' }] },
      { label: 'Bug Fixes', ideas: [{ id: 'IDEA-2', title: 'Fix the other thing' }] },
    ]);

    expect(markdown).toBe(
      [
        '## v0.2.0',
        '',
        '### Features',
        '',
        '- Add the thing (IDEA-1)',
        '',
        '### Bug Fixes',
        '',
        '- Fix the other thing (IDEA-2)',
      ].join('\n'),
    );
  });

  it('renders just the heading when there are no sections', () => {
    expect(formatReleaseNotesMarkdown('v0.2.0', [])).toBe('## v0.2.0');
  });
});
