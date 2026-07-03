import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { initProject } from './scaffold';

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempDir(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  dirs.push(root);
  return root;
}

function initGit(root: string): void {
  execFileSync('git', ['init', '-q'], { cwd: root });
}

describe('initProject Claude Code integration scaffolding', () => {
  it('writes the skill file and settings.json hooks in a non-git directory', async () => {
    const root = await makeTempDir('papercamp-scaffold-nogit-');

    await initProject(root, { projectName: 'demo' });

    const skill = await readFile(
      join(root, '.claude', 'skills', 'paper-camp', 'SKILL.md'),
      'utf-8',
    );
    expect(skill).toContain('name: paper-camp');

    const settings = JSON.parse(await readFile(join(root, '.claude', 'settings.json'), 'utf-8'));
    expect(settings.hooks.SessionStart[0].hooks[0].command).toContain('session-focus');
    expect(settings.hooks.PostToolUse[0].hooks[0].command).toContain('post-tool-use-log');

    await expect(stat(join(root, '.git', 'hooks', 'post-commit'))).rejects.toThrow();
  });

  it('installs an executable post-commit hook in a git repo', async () => {
    const root = await makeTempDir('papercamp-scaffold-git-');
    initGit(root);

    await initProject(root, { projectName: 'demo' });

    const hookPath = join(root, '.git', 'hooks', 'post-commit');
    const contents = await readFile(hookPath, 'utf-8');
    expect(contents).toContain('log-commit');
    const mode = (await stat(hookPath)).mode;
    expect(mode & 0o111).not.toBe(0);
  });

  it('never overwrites an existing skill file, settings.json, or post-commit hook', async () => {
    const root = await makeTempDir('papercamp-scaffold-noclobber-');
    initGit(root);

    await mkdir(join(root, '.claude', 'skills', 'paper-camp'), { recursive: true });
    await writeFile(
      join(root, '.claude', 'skills', 'paper-camp', 'SKILL.md'),
      'custom skill content\n',
      'utf-8',
    );
    await writeFile(join(root, '.claude', 'settings.json'), '{"custom":true}\n', 'utf-8');
    await mkdir(join(root, '.git', 'hooks'), { recursive: true });
    await writeFile(join(root, '.git', 'hooks', 'post-commit'), '#!/bin/sh\necho custom\n', {
      encoding: 'utf-8',
      mode: 0o755,
    });

    await initProject(root, { projectName: 'demo' });

    expect(await readFile(join(root, '.claude', 'skills', 'paper-camp', 'SKILL.md'), 'utf-8')).toBe(
      'custom skill content\n',
    );
    expect(await readFile(join(root, '.claude', 'settings.json'), 'utf-8')).toBe(
      '{"custom":true}\n',
    );
    expect(await readFile(join(root, '.git', 'hooks', 'post-commit'), 'utf-8')).toBe(
      '#!/bin/sh\necho custom\n',
    );
  });
});
