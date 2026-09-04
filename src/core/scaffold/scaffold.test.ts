import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CORPUS_FORMAT_VERSION } from '../corpus-format';
import { addProject, loadRegistry } from '../machine-registry';
import { PAPER_CAMP_VERSION, initProject } from './scaffold';

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempDir(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  dirs.push(root);
  return root;
}

describe('PAPER_CAMP_VERSION', () => {
  it("tracks this package's own version rather than a hand-kept constant", async () => {
    const packageJsonPath = fileURLToPath(new URL('../../../package.json', import.meta.url));
    const pkg = JSON.parse(await readFile(packageJsonPath, 'utf-8'));
    expect(PAPER_CAMP_VERSION).toBe(pkg.version);
  });
});

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
  });

  it('stamps config.json with the corpus format version, not the package version', async () => {
    const root = await makeTempDir('papercamp-scaffold-');

    await initProject(root, { projectName: 'demo' });

    const config = JSON.parse(await readFile(join(root, 'papercamp', 'config.json'), 'utf-8'));
    expect(config.version).toBe(CORPUS_FORMAT_VERSION);
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

describe('initProject machine registry', () => {
  const originalConfigDir = process.env.PAPERCAMP_CONFIG_DIR;
  let configDir: string;

  beforeEach(async () => {
    configDir = await makeTempDir('papercamp-scaffold-registry-config-');
    process.env.PAPERCAMP_CONFIG_DIR = configDir;
  });

  afterEach(() => {
    if (originalConfigDir === undefined) {
      process.env.PAPERCAMP_CONFIG_DIR = undefined;
    } else {
      process.env.PAPERCAMP_CONFIG_DIR = originalConfigDir;
    }
  });

  it('registers the project, honouring PAPERCAMP_CONFIG_DIR', async () => {
    const root = await makeTempDir('papercamp-scaffold-registry-');

    await initProject(root, { projectName: 'demo' });

    const registry = await loadRegistry(join(configDir, 'projects.json'));
    expect(registry.projects).toHaveLength(1);
    expect(registry.projects[0]).toMatchObject({ path: resolve(root), name: 'demo' });
  });

  it('re-running registration for an already-registered path stays clean', async () => {
    const root = await makeTempDir('papercamp-scaffold-registry-');

    await initProject(root, { projectName: 'demo' });
    const before = await loadRegistry(join(configDir, 'projects.json'));

    const { created } = addProject(before, root, 'demo');
    expect(created).toBe(false);

    const after = await loadRegistry(join(configDir, 'projects.json'));
    expect(after).toEqual(before);
    expect(after.projects).toHaveLength(1);
  });
});

describe('initProject .gitignore', () => {
  it('creates .gitignore with the pairing entry when the repo has none', async () => {
    const root = await makeTempDir('papercamp-scaffold-gitignore-');

    await initProject(root, { projectName: 'demo' });

    expect(await readFile(join(root, '.gitignore'), 'utf-8')).toBe('papercamp/.pairing.json\n');
  });

  it('appends the pairing entry after an existing papercamp block', async () => {
    const root = await makeTempDir('papercamp-scaffold-gitignore-');
    await writeFile(
      join(root, '.gitignore'),
      'node_modules\npapercamp/tasks.log\npapercamp/pr-map.json\n# a comment\n',
      'utf-8',
    );

    await initProject(root, { projectName: 'demo' });

    expect(await readFile(join(root, '.gitignore'), 'utf-8')).toBe(
      'node_modules\npapercamp/tasks.log\npapercamp/pr-map.json\npapercamp/.pairing.json\n# a comment\n',
    );
  });

  it('does not duplicate the entry if already present', async () => {
    const root = await makeTempDir('papercamp-scaffold-gitignore-');
    await writeFile(
      join(root, '.gitignore'),
      'papercamp/tasks.log\npapercamp/.pairing.json\n',
      'utf-8',
    );

    await initProject(root, { projectName: 'demo' });

    expect(await readFile(join(root, '.gitignore'), 'utf-8')).toBe(
      'papercamp/tasks.log\npapercamp/.pairing.json\n',
    );
  });
});
