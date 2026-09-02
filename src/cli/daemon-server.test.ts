import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { ApiMiddleware } from '../app/server/api';
import { type MachineRegistry, addProject, saveRegistry } from '../core/machine-registry';
import { createProjectMounter, parseMountRequest } from './daemon-server';

describe('parseMountRequest', () => {
  it('extracts the slug and defaults rest to "/" for the bare mount', () => {
    expect(parseMountRequest('/p/my-repo')).toEqual({ slug: 'my-repo', rest: '/' });
  });

  it('extracts the slug and the remaining sub-path', () => {
    expect(parseMountRequest('/p/my-repo/api/status')).toEqual({
      slug: 'my-repo',
      rest: '/api/status',
    });
  });

  it('returns null for paths outside the /p/ mount', () => {
    expect(parseMountRequest('/')).toBeNull();
    expect(parseMountRequest('/assets/app.js')).toBeNull();
    expect(parseMountRequest('/plans/some-title')).toBeNull();
  });

  it('returns null for /p/ with no slug', () => {
    expect(parseMountRequest('/p/')).toBeNull();
  });
});

describe('createProjectMounter', () => {
  const fakeApi = () => vi.fn() as unknown as ApiMiddleware;
  const dirs: string[] = [];

  afterAll(async () => {
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function makeRegistryFile(registry: MachineRegistry): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-daemon-test-'));
    dirs.push(dir);
    const path = join(dir, 'projects.json');
    await saveRegistry(path, registry);
    return path;
  }

  it('resolves null for an unregistered slug without building an API', async () => {
    const registryPath = await makeRegistryFile({ version: 1, projects: [] });
    const buildApi = vi.fn();

    const { mount } = createProjectMounter(registryPath, buildApi);
    const result = await mount('missing');

    expect(result).toBeNull();
    expect(buildApi).not.toHaveBeenCalled();
  });

  it('builds and caches a registered project on first request', async () => {
    const { registry } = addProject({ version: 1, projects: [] }, '/some/repo', 'Repo');
    const registryPath = await makeRegistryFile(registry);
    const api = fakeApi();
    const buildApi = vi.fn().mockResolvedValue(api);

    const { mount, mounted } = createProjectMounter(registryPath, buildApi);
    const first = await mount('repo');
    const second = await mount('repo');

    expect(first).toBe(api);
    expect(second).toBe(api);
    expect(buildApi).toHaveBeenCalledTimes(1);
    expect(mounted.get('repo')).toBe(api);
  });

  it('mounts independent slugs independently', async () => {
    const step1 = addProject({ version: 1, projects: [] }, '/some/alpha');
    const step2 = addProject(step1.registry, '/some/beta');
    const registryPath = await makeRegistryFile(step2.registry);
    const apiAlpha = fakeApi();
    const apiBeta = fakeApi();
    const buildApi = vi.fn().mockResolvedValueOnce(apiAlpha).mockResolvedValueOnce(apiBeta);

    const { mount } = createProjectMounter(registryPath, buildApi);

    expect(await mount('alpha')).toBe(apiAlpha);
    expect(await mount('beta')).toBe(apiBeta);
    expect(buildApi).toHaveBeenCalledTimes(2);
  });
});
