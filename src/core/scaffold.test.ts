import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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

describe('initProject Claude Code integration scaffolding', () => {
  it('writes the skill file and settings.json hooks', async () => {
    const root = await makeTempDir('papercamp-scaffold-');

    await initProject(root, { projectName: 'demo' });

    const skill = await readFile(
      join(root, '.claude', 'skills', 'paper-camp', 'SKILL.md'),
      'utf-8',
    );
    expect(skill).toContain('name: paper-camp');

    const settings = JSON.parse(await readFile(join(root, '.claude', 'settings.json'), 'utf-8'));
    expect(settings.hooks.SessionStart[0].hooks[0].command).toContain('session-focus');
    expect(settings.hooks.PostToolUse[0].hooks[0].command).toContain('post-tool-use-log');
  });

  it('never overwrites an existing skill file or settings.json', async () => {
    const root = await makeTempDir('papercamp-scaffold-noclobber-');

    await mkdir(join(root, '.claude', 'skills', 'paper-camp'), { recursive: true });
    await writeFile(
      join(root, '.claude', 'skills', 'paper-camp', 'SKILL.md'),
      'custom skill content\n',
      'utf-8',
    );
    await writeFile(join(root, '.claude', 'settings.json'), '{"custom":true}\n', 'utf-8');

    await initProject(root, { projectName: 'demo' });

    expect(await readFile(join(root, '.claude', 'skills', 'paper-camp', 'SKILL.md'), 'utf-8')).toBe(
      'custom skill content\n',
    );
    expect(await readFile(join(root, '.claude', 'settings.json'), 'utf-8')).toBe(
      '{"custom":true}\n',
    );
  });
});
