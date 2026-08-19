import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { runReleaseNotes } from './index';

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

function captureLogs() {
  const lines: string[] = [];
  const errors: string[] = [];
  const logSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
    lines.push(args.join(' '));
  });
  const errorSpy = vi.spyOn(console, 'error').mockImplementation((...args) => {
    errors.push(args.join(' '));
  });
  return {
    get output() {
      return lines.join('\n');
    },
    get errorOutput() {
      return errors.join('\n');
    },
    restore() {
      logSpy.mockRestore();
      errorSpy.mockRestore();
    },
  };
}

describe('runReleaseNotes', () => {
  it('prints release notes grouped by idea', async () => {
    const { root } = await makeReleasedProject();

    const logs = captureLogs();
    const ok = await runReleaseNotes(root, 'v0.2.0');
    logs.restore();

    expect(ok).toBe(true);
    expect(logs.output).toBe(
      ['## v0.2.0', '', '### Features', '', '- Do the thing (IDEA-1)'].join('\n'),
    );
  });

  it('fails when the CHANGELOG has no range for the requested version', async () => {
    const { root } = await makeReleasedProject();

    const logs = captureLogs();
    const ok = await runReleaseNotes(root, 'v9.9.9');
    logs.restore();

    expect(ok).toBe(false);
    expect(logs.errorOutput).toContain('No release range for "v9.9.9"');
  });
});
