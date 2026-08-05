import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { parseEntityFile } from '../core/parse';

// Exercises `paper-camp stamp-release` as a real subprocess (via bun, matching the "cli"
// script) against a real git repo, so the CHANGELOG range lookup, commit-to-idea join, and
// frontmatter rewrite are verified end to end — not just the extracted `trail.ts` logic.
const CLI_ENTRY = join(__dirname, 'index.ts');

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

function git(cwd: string, ...args: string[]): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf-8' });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

const IDEA_1 = `---
id: IDEA-1
title: Do the thing
type: feat
status: done
created: 2026-07-01
---
Body text.
`;

async function makeReleasedProject(): Promise<{ root: string; ideaFile: string }> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-cli-stamp-release-'));
  dirs.push(root);
  git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test User');
  git(root, 'config', 'commit.gpgsign', 'false');

  const ideasDir = join(root, 'papercamp', 'ideas');
  await mkdir(ideasDir, { recursive: true });
  const ideaFile = join(ideasDir, 'IDEA-1.md');
  await writeFile(ideaFile, IDEA_1);
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'chore(repo): seed main');
  git(root, 'tag', 'v0.1.0');

  await writeFile(join(root, 'a.txt'), 'a\n');
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'feat(core): Do the thing (IDEA-1) (#1)');
  git(root, 'tag', 'v0.2.0');

  await writeFile(
    join(root, 'CHANGELOG.md'),
    [
      '# Changelog',
      '',
      '## [0.2.0](https://github.com/o/r/compare/v0.1.0...v0.2.0) (2026-08-06)',
      '',
      '### Features',
      '',
      '* **core:** Do the thing (IDEA-1) ([abc](https://github.com/o/r/commit/abc))',
    ].join('\n'),
  );

  return { root, ideaFile };
}

function runStampRelease(root: string, version: string) {
  return spawnSync('bun', [CLI_ENTRY, 'stamp-release', version], {
    cwd: root,
    encoding: 'utf-8',
  });
}

describe('paper-camp stamp-release (CLI)', () => {
  it('stamps released: <version> onto every idea the release shipped', async () => {
    const { root, ideaFile } = await makeReleasedProject();

    const result = runStampRelease(root, 'v0.2.0');

    expect(result.stdout).toContain('[stamped]  IDEA-1 -> v0.2.0');
    expect(result.stdout).toContain('Stamped 1 of 1 idea(s)');

    const after = parseEntityFile(await readFile(ideaFile, 'utf-8')).entries[0];
    expect(after.released).toBe('v0.2.0');
    expect(after.title).toBe('Do the thing');
    expect(after.status).toBe('done');
  });

  it('is idempotent — skips an idea already stamped with that version', async () => {
    const { root } = await makeReleasedProject();
    runStampRelease(root, 'v0.2.0');

    const result = runStampRelease(root, 'v0.2.0');

    expect(result.stdout).toContain('[skip]     IDEA-1 — already stamped v0.2.0');
    expect(result.stdout).toContain('Stamped 0 of 1 idea(s)');
  });

  it('never overwrites an existing stamp with a later version a follow-up commit shipped in', async () => {
    const { root, ideaFile } = await makeReleasedProject();
    runStampRelease(root, 'v0.2.0');

    await writeFile(join(root, 'b.txt'), 'b\n');
    git(root, 'add', '.');
    git(root, 'commit', '-m', 'fix(core): Address it (IDEA-1) (#2)');
    git(root, 'tag', 'v0.3.0');
    await writeFile(
      join(root, 'CHANGELOG.md'),
      '# Changelog\n\n## [0.3.0](https://github.com/o/r/compare/v0.2.0...v0.3.0) (2026-08-07)\n',
      { flag: 'a' },
    );

    const result = runStampRelease(root, 'v0.3.0');

    expect(result.stdout).toContain('[skip]     IDEA-1 — already stamped v0.2.0');
    expect(result.stdout).toContain('Stamped 0 of 1 idea(s)');
    const after = parseEntityFile(await readFile(ideaFile, 'utf-8')).entries[0];
    expect(after.released).toBe('v0.2.0');
  });

  it('never stamps an idea whose stored status is dropped', async () => {
    const { root, ideaFile } = await makeReleasedProject();
    await writeFile(ideaFile, IDEA_1.replace('status: done', 'status: dropped'));

    const result = runStampRelease(root, 'v0.2.0');

    expect(result.stdout).toContain('[skip]     IDEA-1 — dropped');
    expect(result.stdout).toContain('Stamped 0 of 1 idea(s)');
    const after = parseEntityFile(await readFile(ideaFile, 'utf-8')).entries[0];
    expect(after.released).toBeUndefined();
  });

  it('fails when the CHANGELOG has no range for the requested version', async () => {
    const { root } = await makeReleasedProject();

    const result = runStampRelease(root, 'v9.9.9');

    expect(result.stderr).toContain('No release range for "v9.9.9"');
  });
});
