import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

// Exercises `paper-camp release-notes` as a real subprocess (via bun, matching the "cli"
// script) against a real git repo, so the CHANGELOG range lookup, commit-to-idea join, and
// markdown rendering are verified end to end — not just the extracted `release-notes.ts` logic.
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

async function makeReleasedProject(): Promise<{ root: string }> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-cli-release-notes-'));
  dirs.push(root);
  git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test User');
  git(root, 'config', 'commit.gpgsign', 'false');

  const ideasDir = join(root, 'papercamp', 'ideas');
  await mkdir(ideasDir, { recursive: true });
  await writeFile(join(ideasDir, 'IDEA-1.md'), IDEA_1);
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'chore(repo): seed main');
  git(root, 'tag', 'v0.1.0');

  await writeFile(join(root, 'a.txt'), 'a\n');
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'feat(core): Do the thing (IDEA-1) (#1)');
  git(root, 'tag', 'v0.2.0');

  await writeFile(
    join(root, 'CHANGELOG.md'),
    '# Changelog\n\n## [0.2.0](https://github.com/o/r/compare/v0.1.0...v0.2.0) (2026-08-06)\n',
  );

  return { root };
}

function runReleaseNotes(root: string, version: string) {
  return spawnSync('bun', [CLI_ENTRY, 'release-notes', version], {
    cwd: root,
    encoding: 'utf-8',
  });
}

describe('paper-camp release-notes (CLI)', () => {
  it('prints release notes grouped by idea', async () => {
    const { root } = await makeReleasedProject();

    const result = runReleaseNotes(root, 'v0.2.0');

    expect(result.stdout).toBe(
      ['## v0.2.0', '', '### Features', '', '- Do the thing (IDEA-1)', ''].join('\n'),
    );
  });

  it('fails when the CHANGELOG has no range for the requested version', async () => {
    const { root } = await makeReleasedProject();

    const result = runReleaseNotes(root, 'v9.9.9');

    expect(result.stderr).toContain('No release range for "v9.9.9"');
  });
});
