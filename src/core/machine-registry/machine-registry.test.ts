import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  addProject,
  listProjects,
  loadRegistry,
  removeProject,
  saveRegistry,
  scanForProjects,
} from './machine-registry';

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'paper-camp-registry-'));
  dirs.push(dir);
  return dir;
}

describe('loadRegistry', () => {
  it('resolves the empty registry when the file does not exist', async () => {
    const dir = await makeTempDir();
    const registry = await loadRegistry(join(dir, 'projects.json'));
    expect(registry).toEqual({ version: 1, projects: [] });
  });

  it('resolves the empty registry for malformed JSON', async () => {
    const dir = await makeTempDir();
    const path = join(dir, 'projects.json');
    await writeFile(path, 'not json', 'utf-8');
    const registry = await loadRegistry(path);
    expect(registry).toEqual({ version: 1, projects: [] });
  });

  it('resolves the empty registry when the shape does not match', async () => {
    const dir = await makeTempDir();
    const path = join(dir, 'projects.json');
    await writeFile(path, JSON.stringify({ version: 1, projects: [{ slug: 'x' }] }), 'utf-8');
    const registry = await loadRegistry(path);
    expect(registry).toEqual({ version: 1, projects: [] });
  });

  it('round-trips what saveRegistry wrote', async () => {
    const dir = await makeTempDir();
    const path = join(dir, 'projects.json');
    const { registry } = addProject({ version: 1, projects: [] }, join(dir, 'demo'), 'demo');

    await saveRegistry(path, registry);
    const loaded = await loadRegistry(path);

    expect(loaded).toEqual(registry);
    const raw = await readFile(path, 'utf-8');
    expect(raw.endsWith('\n')).toBe(true);
  });
});

describe('addProject', () => {
  it('mints a slug from the directory basename', () => {
    const { entry, created } = addProject({ version: 1, projects: [] }, '/home/user/My Repo');
    expect(created).toBe(true);
    expect(entry.slug).toBe('my-repo');
    expect(entry.path).toBe('/home/user/My Repo');
    expect(entry.name).toBe('My Repo');
  });

  it('uses the provided name over the basename', () => {
    const { entry } = addProject({ version: 1, projects: [] }, '/home/user/repo', 'Custom Name');
    expect(entry.name).toBe('Custom Name');
  });

  it('disambiguates a colliding slug with a numeric suffix', () => {
    const first = addProject({ version: 1, projects: [] }, '/a/repo');
    const second = addProject(first.registry, '/b/repo');
    expect(first.entry.slug).toBe('repo');
    expect(second.entry.slug).toBe('repo-2');
  });

  it('is idempotent for an already-registered path', () => {
    const first = addProject({ version: 1, projects: [] }, '/a/repo');
    const second = addProject(first.registry, '/a/repo');
    expect(second.created).toBe(false);
    expect(second.entry).toEqual(first.entry);
    expect(second.registry.projects).toHaveLength(1);
  });
});

describe('removeProject', () => {
  it('removes a registered slug', () => {
    const { registry } = addProject({ version: 1, projects: [] }, '/a/repo');
    const result = removeProject(registry, 'repo');
    expect(result.removed).toBe(true);
    expect(result.registry.projects).toHaveLength(0);
  });

  it('reports not-removed for an unknown slug', () => {
    const registry = { version: 1 as const, projects: [] };
    const result = removeProject(registry, 'missing');
    expect(result.removed).toBe(false);
    expect(result.registry).toBe(registry);
  });
});

describe('listProjects', () => {
  it('sorts by slug', () => {
    const step1 = addProject({ version: 1, projects: [] }, '/a/zeta');
    const step2 = addProject(step1.registry, '/a/alpha');
    expect(listProjects(step2.registry).map((p) => p.slug)).toEqual(['alpha', 'zeta']);
  });
});

describe('scanForProjects', () => {
  async function makeProjectDir(
    root: string,
    name: string,
    config?: Record<string, unknown>,
  ): Promise<void> {
    const projectDir = join(root, name);
    await mkdir(projectDir, { recursive: true });
    if (config !== undefined) {
      const papercampDir = join(projectDir, 'papercamp');
      await mkdir(papercampDir, { recursive: true });
      await writeFile(join(papercampDir, 'config.json'), JSON.stringify(config), 'utf-8');
    }
  }

  it('flags folders one level deep with and without papercamp/config.json', async () => {
    const dir = await makeTempDir();
    await makeProjectDir(dir, 'with-config', { projectName: 'With Config' });
    await makeProjectDir(dir, 'without-config');

    const entries = await scanForProjects(dir);

    expect(entries).toEqual([
      { path: join(dir, 'with-config'), name: 'With Config', hasConfig: true },
      { path: join(dir, 'without-config'), name: 'without-config', hasConfig: false },
    ]);
  });

  it('falls back to the folder name when config.json has no projectName', async () => {
    const dir = await makeTempDir();
    await makeProjectDir(dir, 'nameless', {});

    const entries = await scanForProjects(dir);

    expect(entries).toEqual([{ path: join(dir, 'nameless'), name: 'nameless', hasConfig: true }]);
  });

  it('falls back to the folder name when config.json is malformed', async () => {
    const dir = await makeTempDir();
    const projectDir = join(dir, 'broken');
    await mkdir(join(projectDir, 'papercamp'), { recursive: true });
    await writeFile(join(projectDir, 'papercamp', 'config.json'), 'not json', 'utf-8');

    const entries = await scanForProjects(dir);

    expect(entries).toEqual([{ path: projectDir, name: 'broken', hasConfig: true }]);
  });

  it('ignores files and only descends one level', async () => {
    const dir = await makeTempDir();
    await writeFile(join(dir, 'not-a-dir.txt'), 'x', 'utf-8');
    await makeProjectDir(dir, 'nested-parent', undefined);
    await makeProjectDir(join(dir, 'nested-parent'), 'nested-child', { projectName: 'Nested' });

    const entries = await scanForProjects(dir);

    expect(entries).toEqual([
      { path: join(dir, 'nested-parent'), name: 'nested-parent', hasConfig: false },
    ]);
  });
});
