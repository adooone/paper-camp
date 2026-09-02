import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { ApiMiddleware } from '../app/server/api';
import type { PairingManagerState } from '../app/server/pairing';
import { type MachineRegistry, addProject, saveRegistry } from '../core/machine-registry';
import {
  createProjectApi,
  createProjectMounter,
  isMachineBusy,
  parseMountRequest,
  readMachineProjectSummaries,
} from './daemon-server';

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

describe('readMachineProjectSummaries', () => {
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

  it('lists slug and name, sorted, with no filesystem path', async () => {
    const step1 = addProject({ version: 1, projects: [] }, '/some/zeta', 'Zeta');
    const step2 = addProject(step1.registry, '/some/alpha', 'Alpha');
    const registryPath = await makeRegistryFile(step2.registry);

    const summaries = await readMachineProjectSummaries(registryPath);

    expect(summaries).toEqual([
      { slug: 'alpha', name: 'Alpha' },
      { slug: 'zeta', name: 'Zeta' },
    ]);
  });

  it('resolves an empty list for an empty registry', async () => {
    const registryPath = await makeRegistryFile({ version: 1, projects: [] });

    expect(await readMachineProjectSummaries(registryPath)).toEqual([]);
  });
});

describe('createProjectApi', () => {
  it('shares one pairing token and origin set across every project it builds', async () => {
    const pairingState: PairingManagerState = { token: 'shared-token', origins: new Set() };
    const onPaired = vi.fn();

    const apiAlpha = await createProjectApi(
      { slug: 'alpha', path: '/some/alpha', name: 'Alpha' },
      pairingState,
      onPaired,
      () => false,
    );
    const apiBeta = await createProjectApi(
      { slug: 'beta', path: '/some/beta', name: 'Beta' },
      pairingState,
      onPaired,
      () => false,
    );

    expect(apiAlpha.pairing.token).toBe('shared-token');
    expect(apiBeta.pairing.token).toBe('shared-token');

    expect(apiAlpha.pairing.pair('shared-token', 'https://app.papercamp.dev')).toBe(true);
    expect(apiBeta.pairing.isPairedOrigin('https://app.papercamp.dev')).toBe(true);
    expect(onPaired).toHaveBeenCalledTimes(1);
  });
});

describe('isMachineBusy', () => {
  const fakeApi = (active: boolean) =>
    ({ agent: { hasActiveTask: () => active } }) as unknown as ApiMiddleware;

  it('is false when no mounted project has an active task', () => {
    const mounted = new Map([
      ['alpha', fakeApi(false)],
      ['beta', fakeApi(false)],
    ]);
    expect(isMachineBusy(mounted)).toBe(false);
  });

  it('is true when any mounted project has an active task, not just the first', () => {
    const mounted = new Map([
      ['alpha', fakeApi(false)],
      ['beta', fakeApi(true)],
    ]);
    expect(isMachineBusy(mounted)).toBe(true);
  });

  it('reflects a project mounted after the map was first captured', () => {
    const mounted = new Map<string, ApiMiddleware>([['alpha', fakeApi(false)]]);
    const checkMachineBusy = () => isMachineBusy(mounted);

    expect(checkMachineBusy()).toBe(false);
    mounted.set('beta', fakeApi(true));
    expect(checkMachineBusy()).toBe(true);
  });
});
