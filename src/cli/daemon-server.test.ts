import { mkdtemp, rm } from 'node:fs/promises';
import { type Server, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiMiddleware } from '../app/server/api';
import type { PairingManagerState } from '../app/server/pairing';
import { type MachineRegistry, addProject, saveRegistry } from '../core/machine-registry';
import {
  createDaemonRequestHandler,
  createProjectApi,
  createProjectMounter,
  formatDaemonBanner,
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

  const fakeApi = (active: boolean) =>
    ({ agent: { hasActiveTask: () => active } }) as unknown as ApiMiddleware;

  it('lists slug and name, sorted, with no filesystem path, unmounted by default', async () => {
    const step1 = addProject({ version: 1, projects: [] }, '/some/zeta', 'Zeta');
    const step2 = addProject(step1.registry, '/some/alpha', 'Alpha');
    const registryPath = await makeRegistryFile(step2.registry);

    const summaries = await readMachineProjectSummaries(registryPath, new Map());

    expect(summaries).toEqual([
      { slug: 'alpha', name: 'Alpha', mounted: false, busy: false },
      { slug: 'zeta', name: 'Zeta', mounted: false, busy: false },
    ]);
  });

  it('resolves an empty list for an empty registry', async () => {
    const registryPath = await makeRegistryFile({ version: 1, projects: [] });

    expect(await readMachineProjectSummaries(registryPath, new Map())).toEqual([]);
  });

  it('reports mounted true and busy false for an idle mounted project', async () => {
    const registryPath = await makeRegistryFile(
      addProject({ version: 1, projects: [] }, '/some/demo', 'Demo').registry,
    );

    const summaries = await readMachineProjectSummaries(
      registryPath,
      new Map([['demo', fakeApi(false)]]),
    );

    expect(summaries).toEqual([{ slug: 'demo', name: 'Demo', mounted: true, busy: false }]);
  });

  it('reports busy true for a mounted project with an active task', async () => {
    const registryPath = await makeRegistryFile(
      addProject({ version: 1, projects: [] }, '/some/demo', 'Demo').registry,
    );

    const summaries = await readMachineProjectSummaries(
      registryPath,
      new Map([['demo', fakeApi(true)]]),
    );

    expect(summaries).toEqual([{ slug: 'demo', name: 'Demo', mounted: true, busy: true }]);
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

describe('formatDaemonBanner', () => {
  const networkLink =
    'https://paper-camp.vercel.app/?runtime=http%3A%2F%2F100.80.79.13%3A4333&token=shared-token';
  const reachable = { link: networkLink, blocked: false };

  it('carries the daemon port in the Local row and the resolved Network link', () => {
    const banner = formatDaemonBanner(4333, reachable, false);
    expect(banner).toContain('Local:   http://localhost:4333');
    expect(banner).toContain(`Network: ${networkLink}`);
  });

  it('keeps the lazy-mount note as a dim row after the banner', () => {
    const banner = formatDaemonBanner(4333, reachable, false);
    expect(banner).toContain('Registered projects mount lazily at /p/<slug>/ on first request.');
  });

  it('never prints the pairing token as its own bare line', () => {
    const banner = formatDaemonBanner(4333, reachable, false);
    expect(banner).not.toMatch(/^Pairing token:/m);
  });

  it('omits the Network row when the machine has no reachable address', () => {
    const banner = formatDaemonBanner(4333, { blocked: false }, false);
    expect(banner).not.toContain('Network:');
  });

  it('prints the remedy instead of the Network row when the pair is blocked', () => {
    const banner = formatDaemonBanner(4333, { blocked: true }, false);
    expect(banner).not.toContain('Network:');
    expect(banner).toContain('rerun with --tailnet or --share');
  });
});

describe('createDaemonRequestHandler', () => {
  const dirs: string[] = [];
  const servers: Server[] = [];

  afterAll(async () => {
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise((r) => server.close(r))));
  });

  async function makeRegistryFile(registry: MachineRegistry): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-daemon-e2e-'));
    dirs.push(dir);
    const path = join(dir, 'projects.json');
    await saveRegistry(path, registry);
    return path;
  }

  async function startHandler(registryPath: string): Promise<{ port: number; seenUrls: string[] }> {
    const seenUrls: string[] = [];
    const mockedApi = Object.assign(
      vi.fn((req, res) => {
        seenUrls.push(req.url ?? '');
        res.statusCode = 200;
        res.end('mounted');
      }),
      { agent: { hasActiveTask: () => false } },
    ) as unknown as ApiMiddleware;
    const { mount, mounted } = createProjectMounter(registryPath, () => Promise.resolve(mockedApi));
    const handler = createDaemonRequestHandler(
      registryPath,
      mount,
      mounted,
      '/nonexistent',
      '<html/>',
    );
    const server = createServer((req, res) => {
      handler(req, res).catch((error) => {
        res.statusCode = 500;
        res.end(String(error));
      });
    });
    servers.push(server);
    const port = await new Promise<number>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
    });
    return { port, seenUrls };
  }

  it('lists registered projects at /api/machine/projects for a loopback caller, unmounted', async () => {
    const registryPath = await makeRegistryFile(
      addProject({ version: 1, projects: [] }, '/some/demo', 'Demo').registry,
    );
    const { port } = await startHandler(registryPath);

    const response = await fetch(`http://127.0.0.1:${port}/api/machine/projects`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      projects: [{ slug: 'demo', name: 'Demo', mounted: false, busy: false }],
    });
  });

  it('reports a project as mounted after a request has built its middleware', async () => {
    const registryPath = await makeRegistryFile(
      addProject({ version: 1, projects: [] }, '/some/demo', 'Demo').registry,
    );
    const { port } = await startHandler(registryPath);
    await fetch(`http://127.0.0.1:${port}/p/demo/`);

    const response = await fetch(`http://127.0.0.1:${port}/api/machine/projects`);

    expect(await response.json()).toEqual({
      projects: [{ slug: 'demo', name: 'Demo', mounted: true, busy: false }],
    });
  });

  it('mounts a registered slug and rewrites the forwarded URL to strip the /p/<slug> prefix', async () => {
    const registryPath = await makeRegistryFile(
      addProject({ version: 1, projects: [] }, '/some/demo', 'Demo').registry,
    );
    const { port, seenUrls } = await startHandler(registryPath);

    const response = await fetch(`http://127.0.0.1:${port}/p/demo/sub?x=1`);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('mounted');
    expect(seenUrls).toEqual(['/sub?x=1']);
  });

  it('404s an unregistered slug without mounting anything', async () => {
    const registryPath = await makeRegistryFile({ version: 1, projects: [] });
    const { port, seenUrls } = await startHandler(registryPath);

    const response = await fetch(`http://127.0.0.1:${port}/p/unknown/`);

    expect(response.status).toBe(404);
    expect(await response.text()).toContain('no registered project with slug "unknown"');
    expect(seenUrls).toEqual([]);
  });
});
