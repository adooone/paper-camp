import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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
  withRequestedNetwork,
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

  async function makeProjectDir(name: string): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-daemon-project-'));
    dirs.push(dir);
    const projectPath = join(dir, name);
    await mkdir(join(projectPath, 'papercamp'), { recursive: true });
    await writeFile(join(projectPath, 'papercamp', 'config.json'), '{}', 'utf-8');
    return projectPath;
  }

  it('resolves unknown for an unregistered slug without building an API', async () => {
    const registryPath = await makeRegistryFile({ version: 1, projects: [] });
    const buildApi = vi.fn();

    const { mount } = createProjectMounter(registryPath, buildApi);
    const result = await mount('missing');

    expect(result).toEqual({ kind: 'unknown' });
    expect(buildApi).not.toHaveBeenCalled();
  });

  it('builds and caches a registered project on first request', async () => {
    const projectPath = await makeProjectDir('repo');
    const { registry } = addProject({ version: 1, projects: [] }, projectPath, 'Repo');
    const registryPath = await makeRegistryFile(registry);
    const api = fakeApi();
    const buildApi = vi.fn().mockResolvedValue(api);

    const { mount, mounted } = createProjectMounter(registryPath, buildApi);
    const first = await mount('repo');
    const second = await mount('repo');

    expect(first).toEqual({ kind: 'mounted', api });
    expect(second).toEqual({ kind: 'mounted', api });
    expect(buildApi).toHaveBeenCalledTimes(1);
    expect(mounted.get('repo')).toBe(api);
  });

  it('mounts independent slugs independently', async () => {
    const alphaPath = await makeProjectDir('alpha');
    const betaPath = await makeProjectDir('beta');
    const step1 = addProject({ version: 1, projects: [] }, alphaPath);
    const step2 = addProject(step1.registry, betaPath);
    const registryPath = await makeRegistryFile(step2.registry);
    const apiAlpha = fakeApi();
    const apiBeta = fakeApi();
    const buildApi = vi.fn().mockResolvedValueOnce(apiAlpha).mockResolvedValueOnce(apiBeta);

    const { mount } = createProjectMounter(registryPath, buildApi);

    expect(await mount('alpha')).toEqual({ kind: 'mounted', api: apiAlpha });
    expect(await mount('beta')).toEqual({ kind: 'mounted', api: apiBeta });
    expect(buildApi).toHaveBeenCalledTimes(2);
  });

  it('evicts a mounted project once its folder is gone, then mounts it fresh when restored', async () => {
    const projectPath = await makeProjectDir('repo');
    const registryPath = await makeRegistryFile({
      version: 1,
      projects: [{ slug: 'repo', path: projectPath, name: 'Repo' }],
    });
    const killCurrent = vi.fn().mockResolvedValue(undefined);
    const killAll = vi.fn().mockResolvedValue(undefined);
    const liveApi = () =>
      Object.assign(vi.fn(), {
        agent: { killCurrent, hasActiveTask: () => false },
        services: { killAll },
      }) as unknown as ApiMiddleware;
    const buildApi = vi.fn().mockImplementation(async () => liveApi());
    const { mount, mounted } = createProjectMounter(registryPath, buildApi);

    expect((await mount('repo')).kind).toBe('mounted');
    await rm(join(projectPath, 'papercamp'), { recursive: true, force: true });

    expect(await mount('repo')).toEqual({ kind: 'missing', path: projectPath });
    expect(mounted.has('repo')).toBe(false);
    expect(killCurrent).toHaveBeenCalledTimes(1);
    expect(killAll).toHaveBeenCalledTimes(1);

    await mkdir(join(projectPath, 'papercamp'), { recursive: true });
    await writeFile(join(projectPath, 'papercamp', 'config.json'), '{}', 'utf-8');
    expect((await mount('repo')).kind).toBe('mounted');
    expect(buildApi).toHaveBeenCalledTimes(2);
  });

  it('reports missing for a registered project whose folder has no papercamp/config.json, without building an API', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-daemon-project-'));
    dirs.push(dir);
    const deletedPath = join(dir, 'deleted-repo');
    const { registry } = addProject({ version: 1, projects: [] }, deletedPath, 'Deleted');
    const registryPath = await makeRegistryFile(registry);
    const buildApi = vi.fn();

    const { mount } = createProjectMounter(registryPath, buildApi);
    const result = await mount('deleted-repo');

    expect(result).toEqual({ kind: 'missing', path: deletedPath });
    expect(buildApi).not.toHaveBeenCalled();
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

  async function makeProjectDir(name: string): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-daemon-project-'));
    dirs.push(dir);
    const projectPath = join(dir, name);
    await mkdir(join(projectPath, 'papercamp'), { recursive: true });
    await writeFile(join(projectPath, 'papercamp', 'config.json'), '{}', 'utf-8');
    return projectPath;
  }

  const fakeApi = (active: boolean) =>
    ({
      agent: { hasActiveTask: () => active, getInterruptedOnBoot: () => 0 },
    }) as unknown as ApiMiddleware;

  it('lists slug and name, sorted, with no filesystem path, unmounted by default', async () => {
    const zetaPath = await makeProjectDir('zeta');
    const alphaPath = await makeProjectDir('alpha');
    const step1 = addProject({ version: 1, projects: [] }, zetaPath, 'Zeta');
    const step2 = addProject(step1.registry, alphaPath, 'Alpha');
    const registryPath = await makeRegistryFile(step2.registry);

    const summaries = await readMachineProjectSummaries(registryPath, new Map());

    expect(summaries).toEqual([
      { slug: 'alpha', name: 'Alpha', mounted: false, busy: false, missing: false },
      { slug: 'zeta', name: 'Zeta', mounted: false, busy: false, missing: false },
    ]);
  });

  it('resolves an empty list for an empty registry', async () => {
    const registryPath = await makeRegistryFile({ version: 1, projects: [] });

    expect(await readMachineProjectSummaries(registryPath, new Map())).toEqual([]);
  });

  it('reports mounted true and busy false for an idle mounted project', async () => {
    const projectPath = await makeProjectDir('demo');
    const registryPath = await makeRegistryFile(
      addProject({ version: 1, projects: [] }, projectPath, 'Demo').registry,
    );

    const summaries = await readMachineProjectSummaries(
      registryPath,
      new Map([['demo', fakeApi(false)]]),
    );

    expect(summaries).toEqual([
      {
        slug: 'demo',
        name: 'Demo',
        mounted: true,
        busy: false,
        missing: false,
        interruptedCount: 0,
      },
    ]);
  });

  it('reports busy true for a mounted project with an active task', async () => {
    const projectPath = await makeProjectDir('demo');
    const registryPath = await makeRegistryFile(
      addProject({ version: 1, projects: [] }, projectPath, 'Demo').registry,
    );

    const summaries = await readMachineProjectSummaries(
      registryPath,
      new Map([['demo', fakeApi(true)]]),
    );

    expect(summaries).toEqual([
      {
        slug: 'demo',
        name: 'Demo',
        mounted: true,
        busy: true,
        missing: false,
        interruptedCount: 0,
      },
    ]);
  });

  it('reports missing true for a registered project whose folder has no papercamp/config.json', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-daemon-project-'));
    dirs.push(dir);
    const deletedPath = join(dir, 'deleted-repo');
    const registryPath = await makeRegistryFile(
      addProject({ version: 1, projects: [] }, deletedPath, 'Deleted').registry,
    );

    const summaries = await readMachineProjectSummaries(registryPath, new Map());

    expect(summaries).toEqual([
      { slug: 'deleted-repo', name: 'Deleted', mounted: false, busy: false, missing: true },
    ]);
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
    ({
      agent: { hasActiveTask: () => active, getInterruptedOnBoot: () => 0 },
    }) as unknown as ApiMiddleware;

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
  const localLink =
    'https://paper-camp.vercel.app/?machine=http://localhost:4333&token=shared-token';
  const networkLink =
    'https://paper-camp.vercel.app/?runtime=http://100.80.79.13:4333&token=shared-token';
  const tailnetLink =
    'https://paper-camp.vercel.app/?machine=https://box.tailnet.ts.net/&token=shared-token';
  const tunnelLink =
    'https://paper-camp.vercel.app/?machine=https://foo.trycloudflare.com&token=shared-token';
  const reachable = { link: networkLink, blocked: false };

  it('carries the resolved Network link over the loopback link', () => {
    const banner = formatDaemonBanner(localLink, reachable, undefined, undefined, false);
    expect(banner).toContain(`Network\n  ${networkLink}`);
    expect(banner).not.toContain('This host');
  });

  it('never prints the pairing token as its own bare line', () => {
    const banner = formatDaemonBanner(localLink, reachable, undefined, undefined, false);
    expect(banner).not.toMatch(/^Pairing token:/m);
  });

  it('falls back to the loopback link when the machine has no reachable address', () => {
    const banner = formatDaemonBanner(localLink, { blocked: false }, undefined, undefined, false);
    expect(banner).toContain(`This host\n  ${localLink}`);
    expect(banner).not.toContain('Network\n');
  });

  it('drops the HTTPS remedy once --tailnet or --share was asked for', () => {
    expect(withRequestedNetwork({ blocked: true }, true)).toEqual({ blocked: false });
    expect(withRequestedNetwork({ blocked: true }, false)).toEqual({ blocked: true });
    const banner = formatDaemonBanner(
      localLink,
      withRequestedNetwork({ blocked: true }, true),
      undefined,
      undefined,
      false,
    );
    expect(banner).not.toContain('add --tailnet or --share');
  });

  it('prints the remedy alongside the loopback link when the pair is blocked', () => {
    const banner = formatDaemonBanner(localLink, { blocked: true }, undefined, undefined, false);
    expect(banner).not.toContain('Network\n');
    expect(banner).toContain('add --tailnet or --share');
  });

  it('prefers the Tailnet link over the Tunnel link, Network link, and loopback link', () => {
    const banner = formatDaemonBanner(localLink, reachable, tailnetLink, tunnelLink, false);
    expect(banner).toContain(`Tailnet\n  ${tailnetLink}`);
    expect(banner).not.toContain('Network');
    expect(banner).not.toContain('Tunnel\n');
    expect(banner).not.toContain('This host');
  });

  it('prefers the Tunnel link over the Network link and loopback link when there is no Tailnet link', () => {
    const banner = formatDaemonBanner(localLink, reachable, undefined, tunnelLink, false);
    expect(banner).toContain(`Tunnel\n  ${tunnelLink}`);
    expect(banner).not.toContain('Network');
  });

  it('prints exactly one link entry', () => {
    const banner = formatDaemonBanner(localLink, reachable, tailnetLink, tunnelLink, false);
    const linkLines = banner.split('\n').filter((line) => line.startsWith('  http'));
    expect(linkLines).toHaveLength(1);
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

  async function makeProjectDir(name: string): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-daemon-e2e-project-'));
    dirs.push(dir);
    const projectPath = join(dir, name);
    await mkdir(join(projectPath, 'papercamp'), { recursive: true });
    await writeFile(join(projectPath, 'papercamp', 'config.json'), '{}', 'utf-8');
    return projectPath;
  }

  const localLink = 'https://paper-camp.vercel.app/?machine=http://localhost:4333&token=t';

  async function startHandler(registryPath: string): Promise<{ port: number; seenUrls: string[] }> {
    const seenUrls: string[] = [];
    const mockedApi = Object.assign(
      vi.fn((req, res) => {
        seenUrls.push(req.url ?? '');
        res.statusCode = 200;
        res.end('mounted');
      }),
      { agent: { hasActiveTask: () => false, getInterruptedOnBoot: () => 0 } },
    ) as unknown as ApiMiddleware;
    const { mount, mounted } = createProjectMounter(registryPath, () => Promise.resolve(mockedApi));
    const handler = createDaemonRequestHandler(registryPath, mount, mounted, localLink);
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
    const projectPath = await makeProjectDir('demo');
    const registryPath = await makeRegistryFile(
      addProject({ version: 1, projects: [] }, projectPath, 'Demo').registry,
    );
    const { port } = await startHandler(registryPath);

    const response = await fetch(`http://127.0.0.1:${port}/api/machine/projects`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      projects: [{ slug: 'demo', name: 'Demo', mounted: false, busy: false, missing: false }],
    });
  });

  it('reports a project as mounted after a request has built its middleware', async () => {
    const projectPath = await makeProjectDir('demo');
    const registryPath = await makeRegistryFile(
      addProject({ version: 1, projects: [] }, projectPath, 'Demo').registry,
    );
    const { port } = await startHandler(registryPath);
    await fetch(`http://127.0.0.1:${port}/p/demo/`);

    const response = await fetch(`http://127.0.0.1:${port}/api/machine/projects`);

    expect(await response.json()).toEqual({
      projects: [
        {
          slug: 'demo',
          name: 'Demo',
          mounted: true,
          busy: false,
          missing: false,
          interruptedCount: 0,
        },
      ],
    });
  });

  it('mounts a registered slug and rewrites the forwarded URL to strip the /p/<slug> prefix', async () => {
    const projectPath = await makeProjectDir('demo');
    const registryPath = await makeRegistryFile(
      addProject({ version: 1, projects: [] }, projectPath, 'Demo').registry,
    );
    const { port, seenUrls } = await startHandler(registryPath);

    const response = await fetch(`http://127.0.0.1:${port}/p/demo/sub?x=1`);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('mounted');
    expect(seenUrls).toEqual(['/sub?x=1']);
  });

  it('404s a registered slug whose folder has no papercamp/config.json', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-daemon-e2e-project-'));
    dirs.push(dir);
    const deletedPath = join(dir, 'deleted-repo');
    const registryPath = await makeRegistryFile(
      addProject({ version: 1, projects: [] }, deletedPath, 'Deleted').registry,
    );
    const { port, seenUrls } = await startHandler(registryPath);

    const response = await fetch(`http://127.0.0.1:${port}/p/deleted-repo/`);

    expect(response.status).toBe(404);
    expect(await response.text()).toBe(
      `paper-camp daemon: project folder missing at ${deletedPath}`,
    );
    expect(seenUrls).toEqual([]);
  });

  it('reports missing true at /api/machine/projects for a registered slug whose folder has no papercamp/config.json', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-daemon-e2e-project-'));
    dirs.push(dir);
    const deletedPath = join(dir, 'deleted-repo');
    const registryPath = await makeRegistryFile(
      addProject({ version: 1, projects: [] }, deletedPath, 'Deleted').registry,
    );
    const { port } = await startHandler(registryPath);

    const response = await fetch(`http://127.0.0.1:${port}/api/machine/projects`);

    expect(await response.json()).toEqual({
      projects: [
        { slug: 'deleted-repo', name: 'Deleted', mounted: false, busy: false, missing: true },
      ],
    });
  });

  it('404s an unregistered slug without mounting anything', async () => {
    const registryPath = await makeRegistryFile({ version: 1, projects: [] });
    const { port, seenUrls } = await startHandler(registryPath);

    const response = await fetch(`http://127.0.0.1:${port}/p/unknown/`);

    expect(response.status).toBe(404);
    expect(await response.text()).toContain('no registered project with slug "unknown"');
    expect(seenUrls).toEqual([]);
  });

  it('404s any /api/* path at the daemon root other than /api/machine/projects', async () => {
    const registryPath = await makeRegistryFile({ version: 1, projects: [] });
    const { port } = await startHandler(registryPath);

    const response = await fetch(`http://127.0.0.1:${port}/api/package-name`);

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ error: 'no project mounted at the daemon root' });
  });

  it('redirects the bare root to the hosted-client Local link', async () => {
    const registryPath = await makeRegistryFile({ version: 1, projects: [] });
    const { port } = await startHandler(registryPath);

    const response = await fetch(`http://127.0.0.1:${port}/`, { redirect: 'manual' });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(localLink);
  });
});
