import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiMiddleware } from '../app/server/api';
import { createPairCodeManager } from '../app/server/pair-code';
import type { PairingManagerState } from '../app/server/pairing';
import { writeCapacity } from '../core/capacity';
import {
  type MachineRegistry,
  addProject,
  saveRegistry,
  setNightProject,
} from '../core/machine-registry';
import { appendNightFindings } from '../core/night-suggestions';
import type { RateLimitSnapshot } from '../types/index';
import {
  buildNightGateResponse,
  createDaemonRequestHandler,
  createMachinePairCodeHandler,
  createMachinePairHandler,
  createMachineUpdateHandler,
  createProjectApi,
  createProjectMounter,
  createUpdateApplier,
  deriveUpdateEvent,
  formatDaemonBanner,
  isMachineBusy,
  parseMountRequest,
  readMachineProjectSummaries,
  watchForIdleRestart,
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

describe('buildNightGateResponse', () => {
  const dirs: string[] = [];

  afterAll(async () => {
    await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function makeRegistryFile(registry: MachineRegistry): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-night-gate-test-'));
    dirs.push(dir);
    const path = join(dir, 'projects.json');
    await saveRegistry(path, registry);
    return path;
  }

  async function makeProjectDir(
    name: string,
    nightConfig?: Record<string, unknown>,
    capacity?: RateLimitSnapshot,
  ): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-night-gate-project-'));
    dirs.push(dir);
    const projectPath = join(dir, name);
    await mkdir(join(projectPath, 'papercamp'), { recursive: true });
    await writeFile(
      join(projectPath, 'papercamp', 'config.json'),
      JSON.stringify({ ...(nightConfig !== undefined && { night: nightConfig }) }),
      'utf-8',
    );
    if (capacity) await writeCapacity(projectPath, capacity, 'run');
    return projectPath;
  }

  const capacitySnapshot = (fiveHourPct: number, sevenDayPct: number): RateLimitSnapshot => ({
    status: 'allowed',
    unifiedWindows: {
      five_hour: { utilization: fiveHourPct / 100 },
      seven_day: { utilization: sevenDayPct / 100 },
    },
  });

  const fakeApi = (active: boolean, lastRequestAt: number | null) =>
    ({
      agent: { hasActiveTask: () => active },
      getLastRequestAt: () => lastRequestAt,
    }) as unknown as ApiMiddleware;

  function git(cwd: string, ...args: string[]): string {
    const result = spawnSync('git', args, { cwd, encoding: 'utf-8' });
    if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
    return result.stdout.trim();
  }

  async function commitProjectFile(projectPath: string, file: string): Promise<string> {
    git(projectPath, 'init', '-b', 'main');
    git(projectPath, 'config', 'user.email', 'test@example.com');
    git(projectPath, 'config', 'user.name', 'Test User');
    git(projectPath, 'config', 'commit.gpgsign', 'false');
    await mkdir(join(projectPath, 'src'), { recursive: true });
    await writeFile(join(projectPath, file), 'export const a = 1;\n', 'utf-8');
    git(projectPath, 'add', '.');
    git(projectPath, 'commit', '-m', 'seed');
    return git(projectPath, 'rev-parse', 'HEAD');
  }

  it('is off with no gate when no project is selected', async () => {
    const registryPath = await makeRegistryFile({ version: 1, projects: [] });

    expect(await buildNightGateResponse(registryPath, new Map())).toEqual({
      slug: null,
      projectMissing: false,
      pausedUntil: null,
      gate: null,
    });
  });

  it('reports the selected project missing when its config.json is gone', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'paper-camp-night-gate-project-'));
    dirs.push(dir);
    const deletedPath = join(dir, 'deleted-repo');
    const registry = setNightProject(
      addProject({ version: 1, projects: [] }, deletedPath, 'Deleted').registry,
      'deleted-repo',
    ).registry;
    const registryPath = await makeRegistryFile(registry);

    expect(await buildNightGateResponse(registryPath, new Map())).toEqual({
      slug: 'deleted-repo',
      projectMissing: true,
      pausedUntil: null,
      gate: null,
    });
  });

  it('opens the gate for an unmounted project with a healthy capacity snapshot', async () => {
    const projectPath = await makeProjectDir('demo', undefined, capacitySnapshot(10, 10));
    const registry = setNightProject(
      addProject({ version: 1, projects: [] }, projectPath, 'Demo').registry,
      'demo',
    ).registry;
    const registryPath = await makeRegistryFile(registry);

    const response = await buildNightGateResponse(registryPath, new Map());
    expect(response.slug).toBe('demo');
    expect(response.projectMissing).toBe(false);
    expect(response.gate).toEqual({
      open: true,
      reasons: [],
      fiveHourUtilizationPct: 10,
      sevenDayUtilizationPct: 10,
    });
  });

  it('blocks on a mounted project with an active task and a busy dashboard', async () => {
    const projectPath = await makeProjectDir('demo', undefined, capacitySnapshot(10, 10));
    const registry = setNightProject(
      addProject({ version: 1, projects: [] }, projectPath, 'Demo').registry,
      'demo',
    ).registry;
    const registryPath = await makeRegistryFile(registry);
    const mounted = new Map([['demo', fakeApi(true, Date.now())]]);

    const response = await buildNightGateResponse(registryPath, mounted);
    expect(response.gate?.open).toBe(false);
    expect(response.gate?.reasons).toEqual(['dashboard-active', 'task-running']);
  });

  it('blocks with no-capacity-snapshot when the project has never reported one', async () => {
    const projectPath = await makeProjectDir('demo');
    const registry = setNightProject(
      addProject({ version: 1, projects: [] }, projectPath, 'Demo').registry,
      'demo',
    ).registry;
    const registryPath = await makeRegistryFile(registry);

    const response = await buildNightGateResponse(registryPath, new Map());
    expect(response.gate?.reasons).toEqual(['no-capacity-snapshot']);
  });

  it('honours the project-level ceiling/floor overrides from its own config.json', async () => {
    const projectPath = await makeProjectDir(
      'demo',
      { ceiling: 5, floor: 5 },
      capacitySnapshot(10, 10),
    );
    const registry = setNightProject(
      addProject({ version: 1, projects: [] }, projectPath, 'Demo').registry,
      'demo',
    ).registry;
    const registryPath = await makeRegistryFile(registry);

    const response = await buildNightGateResponse(registryPath, new Map());
    expect(response.gate?.reasons).toEqual(['five-hour-ceiling', 'seven-day-floor']);
  });

  it('blocks with open-findings when suggestions.md has a still-fresh finding', async () => {
    const projectPath = await makeProjectDir('demo', undefined, capacitySnapshot(10, 10));
    const commit = await commitProjectFile(projectPath, join('src', 'a.ts'));
    await writeFile(
      join(projectPath, 'papercamp', 'suggestions.md'),
      appendNightFindings('', [
        {
          date: '2026-09-10',
          check: 'bugs',
          chunk: 'src',
          file: 'src/a.ts',
          line: 12,
          commit,
          severity: 'high',
          message: 'Off-by-one in the turn counter.',
        },
      ]),
      'utf-8',
    );
    const registry = setNightProject(
      addProject({ version: 1, projects: [] }, projectPath, 'Demo').registry,
      'demo',
    ).registry;
    const registryPath = await makeRegistryFile(registry);

    const response = await buildNightGateResponse(registryPath, new Map());
    expect(response.gate?.reasons).toEqual(['open-findings']);
  });
});

describe('createProjectApi', () => {
  it('shares one pairing token and origin set across every project it builds', async () => {
    const pairingState: PairingManagerState = { token: 'shared-token', origins: new Set() };
    const onPaired = vi.fn();

    const pairCodeManager = createPairCodeManager();
    const apiAlpha = await createProjectApi(
      { slug: 'alpha', path: '/some/alpha', name: 'Alpha' },
      pairingState,
      onPaired,
      () => false,
      pairCodeManager,
    );
    const apiBeta = await createProjectApi(
      { slug: 'beta', path: '/some/beta', name: 'Beta' },
      pairingState,
      onPaired,
      () => false,
      pairCodeManager,
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

describe('createUpdateApplier', () => {
  function fakeDeps(
    overrides: {
      runInstall?: ReturnType<typeof vi.fn>;
      installedVersion?: ReturnType<typeof vi.fn>;
      restart?: ReturnType<typeof vi.fn>;
    } = {},
  ) {
    return {
      runInstall: overrides.runInstall ?? vi.fn().mockResolvedValue({ ok: true, output: '' }),
      installedVersion: overrides.installedVersion ?? vi.fn().mockResolvedValue('0.28.4'),
      restart: overrides.restart ?? vi.fn(),
    };
  }

  it('installs and restarts when idle', async () => {
    const deps = fakeDeps({
      installedVersion: vi.fn().mockResolvedValueOnce('0.28.4').mockResolvedValueOnce('0.29.1'),
    });
    const apply = createUpdateApplier(() => false, deps);

    expect(await apply('0.29.1')).toEqual({ outcome: 'installed' });
    expect(deps.runInstall).toHaveBeenCalledWith('0.29.1');
    expect(deps.restart).toHaveBeenCalledOnce();
  });

  it('installs but holds the restart while the machine is busy', async () => {
    const deps = fakeDeps({
      installedVersion: vi.fn().mockResolvedValueOnce('0.28.4').mockResolvedValueOnce('0.29.1'),
    });
    const apply = createUpdateApplier(() => true, deps);

    expect(await apply('0.29.1')).toEqual({ outcome: 'waiting for idle' });
    expect(deps.runInstall).toHaveBeenCalledWith('0.29.1');
    expect(deps.restart).not.toHaveBeenCalled();
  });

  it('supersedes an earlier held restart rather than duplicating it', async () => {
    vi.useFakeTimers();
    let busy = true;
    let calls = 0;
    const deps = fakeDeps({
      // Pre-install check misses (forcing an install attempt), post-install check hits.
      installedVersion: vi.fn(async () => (calls++ % 2 === 0 ? '0.28.4' : '0.29.1')),
    });
    const apply = createUpdateApplier(() => busy, deps);

    expect(await apply('0.29.1')).toEqual({ outcome: 'waiting for idle' });
    expect(await apply('0.29.1')).toEqual({ outcome: 'waiting for idle' });
    busy = false;
    await vi.advanceTimersByTimeAsync(6_000);

    expect(deps.restart).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});

describe('deriveUpdateEvent', () => {
  it('records a hooked event with the version and time for any non-pending hook outcome', () => {
    const event = deriveUpdateEvent(undefined, 'hooked', '0.30.2', { outcome: 'already current' });
    expect(event).toMatchObject({ kind: 'hooked', version: '0.30.2' });
  });

  it('records boot check current when the boot check found nothing newer', () => {
    expect(
      deriveUpdateEvent(undefined, 'boot check', '0.29.1', { outcome: 'already current' }),
    ).toEqual({ kind: 'boot check current' });
  });

  it('keeps the previous event when the boot check installed something newer, since a restart is imminent', () => {
    const previous = deriveUpdateEvent(undefined, 'boot check', '0.29.1', {
      outcome: 'already current',
    });
    expect(deriveUpdateEvent(previous, 'boot check', '0.30.0', { outcome: 'installed' })).toBe(
      previous,
    );
  });

  it('keeps the previous event while waiting for idle, regardless of source', () => {
    const previous = deriveUpdateEvent(undefined, 'hooked', '0.29.1', { outcome: 'installed' });
    expect(deriveUpdateEvent(previous, 'hooked', '0.30.0', { outcome: 'waiting for idle' })).toBe(
      previous,
    );
  });

  it('records a failed event with the install output regardless of source', () => {
    expect(
      deriveUpdateEvent(undefined, 'boot check', '0.29.1', {
        outcome: 'failed',
        output: '404 Not Found',
      }),
    ).toEqual({ kind: 'failed', version: '0.29.1', output: '404 Not Found' });
  });
});

describe('createMachineUpdateHandler', () => {
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise((r) => server.close(r))));
  });

  async function startHandler(updateToken: string, applyUpdate: ReturnType<typeof vi.fn>) {
    const handler = createMachineUpdateHandler(updateToken, applyUpdate);
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
    return { port };
  }

  it('403s a missing or wrong bearer token without applying anything', async () => {
    const applyUpdate = vi.fn();
    const { port } = await startHandler('secret', applyUpdate);

    const missing = await fetch(`http://127.0.0.1:${port}/`, {
      method: 'POST',
      body: JSON.stringify({ version: '0.29.1' }),
    });
    const wrong = await fetch(`http://127.0.0.1:${port}/`, {
      method: 'POST',
      headers: { Authorization: 'Bearer nope' },
      body: JSON.stringify({ version: '0.29.1' }),
    });
    const sameLengthWrong = await fetch(`http://127.0.0.1:${port}/`, {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong!' },
      body: JSON.stringify({ version: '0.29.1' }),
    });

    expect(missing.status).toBe(403);
    expect(wrong.status).toBe(403);
    expect(sameLengthWrong.status).toBe(403);
    expect(applyUpdate).not.toHaveBeenCalled();
  });

  it('400s a request missing the version', async () => {
    const applyUpdate = vi.fn();
    const { port } = await startHandler('secret', applyUpdate);

    const response = await fetch(`http://127.0.0.1:${port}/`, {
      method: 'POST',
      headers: { Authorization: 'Bearer secret' },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
    expect(applyUpdate).not.toHaveBeenCalled();
  });

  it('answers with whatever the applier decides for a correct token', async () => {
    const applyUpdate = vi.fn().mockResolvedValue({ outcome: 'installed' });
    const { port } = await startHandler('secret', applyUpdate);

    const response = await fetch(`http://127.0.0.1:${port}/`, {
      method: 'POST',
      headers: { Authorization: 'Bearer secret' },
      body: JSON.stringify({ version: '0.29.1' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ outcome: 'installed' });
    expect(applyUpdate).toHaveBeenCalledWith('0.29.1');
  });
});

describe('createMachinePairCodeHandler', () => {
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise((r) => server.close(r))));
  });

  async function startHandler(updateToken: string) {
    const pairCodeManager = createPairCodeManager();
    const handler = createMachinePairCodeHandler(updateToken, pairCodeManager);
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
    return { port, pairCodeManager };
  }

  it('403s a mint request with a missing or wrong bearer token', async () => {
    const { port } = await startHandler('secret');

    const missing = await fetch(`http://127.0.0.1:${port}/api/machine/pair-code`, {
      method: 'POST',
    });
    const wrong = await fetch(`http://127.0.0.1:${port}/api/machine/pair-code`, {
      method: 'POST',
      headers: { Authorization: 'Bearer nope' },
    });

    expect(missing.status).toBe(403);
    expect(wrong.status).toBe(403);
  });

  it('mints a fresh code for a loopback request with a correct bearer token', async () => {
    const { port } = await startHandler('secret');

    const response = await fetch(`http://127.0.0.1:${port}/api/machine/pair-code`, {
      method: 'POST',
      headers: { Authorization: 'Bearer secret' },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { code: string; expiresAt: string };
    expect(body.code).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
    expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('long-polls the outcome of a minted code until it is redeemed', async () => {
    const { port, pairCodeManager } = await startHandler('secret');
    const { code } = pairCodeManager.mint();

    const pending = fetch(`http://127.0.0.1:${port}/api/machine/pair-code/${code}`, {
      headers: { Authorization: 'Bearer secret' },
    });
    pairCodeManager.redeem(code, 'https://app.papercamp.dev');

    const response = await pending;
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'paired',
      origin: 'https://app.papercamp.dev',
    });
  });

  it('403s a pair-code request on a non-loopback host even with the right bearer token', async () => {
    const handler = createMachinePairCodeHandler('secret', createPairCodeManager());
    const req = {
      url: '/api/machine/pair-code',
      method: 'POST',
      headers: { host: 'deimos.pitta-ray.ts.net', authorization: 'Bearer secret' },
    } as unknown as IncomingMessage;
    let statusCode = 0;
    const res = {
      setHeader: () => {},
      end: () => {},
      set statusCode(code: number) {
        statusCode = code;
      },
      get statusCode() {
        return statusCode;
      },
    } as unknown as ServerResponse;

    await handler(req, res);
    expect(statusCode).toBe(403);
  });
});

describe('watchForIdleRestart', () => {
  it('does not restart while busy, then restarts on the first idle tick', () => {
    vi.useFakeTimers();
    let busy = true;
    const restart = vi.fn();
    watchForIdleRestart(() => busy, restart);

    vi.advanceTimersByTime(20_000);
    expect(restart).not.toHaveBeenCalled();

    busy = false;
    vi.advanceTimersByTime(6_000);
    expect(restart).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(20_000);
    expect(restart).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('stops watching once the returned cleanup runs', () => {
    vi.useFakeTimers();
    const restart = vi.fn();
    const stop = watchForIdleRestart(() => false, restart);

    stop();
    vi.advanceTimersByTime(20_000);

    expect(restart).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe('formatDaemonBanner', () => {
  it('greets with the version and the pair hint, with no link of any kind', () => {
    const banner = formatDaemonBanner(undefined, false);
    expect(banner).toContain('Paper Camp');
    expect(banner).toContain('Run `paper-camp pair` to connect a device.');
    expect(banner).not.toContain('http');
  });

  it('never prints the pairing token as its own bare line', () => {
    const banner = formatDaemonBanner(undefined, false);
    expect(banner).not.toMatch(/^Pairing token:/m);
  });

  it('prints the tailnet name above the pair hint once --tailnet is up', () => {
    const banner = formatDaemonBanner('deimos.pitta-ray.ts.net', false);
    expect(banner).toContain('Tailnet  deimos.pitta-ray.ts.net');
    expect(banner).toContain('Run `paper-camp pair` to connect a device.');
  });

  it('emits no escape codes without color, so piped output stays clean', () => {
    expect(formatDaemonBanner('deimos.pitta-ray.ts.net', false)).not.toContain('\x1b[');
  });

  it('colorizes when asked, still carrying the same text', () => {
    const banner = formatDaemonBanner('deimos.pitta-ray.ts.net', true);
    expect(banner).toContain('\x1b[');
    const esc = String.fromCharCode(27);
    const colorCode = new RegExp(`${esc}\\[[0-9;]*m`, 'g');
    expect(banner.replaceAll(colorCode, '')).toBe(
      formatDaemonBanner('deimos.pitta-ray.ts.net', false),
    );
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

  async function startHandler(
    registryPath: string,
    serveToolbar?: (req: IncomingMessage, res: ServerResponse) => Promise<boolean>,
    getPendingUpdateVersion?: () => string | null,
    handleMachineUpdate?: (req: IncomingMessage, res: ServerResponse) => Promise<void>,
    handleMachinePairCode?: (req: IncomingMessage, res: ServerResponse) => Promise<void>,
  ): Promise<{ port: number; seenUrls: string[] }> {
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
    const handler = createDaemonRequestHandler(
      registryPath,
      mount,
      mounted,
      localLink,
      getPendingUpdateVersion,
      serveToolbar,
      handleMachineUpdate,
      handleMachinePairCode,
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

  async function startHandlerWithFakeToolbar(
    registryPath: string,
  ): Promise<{ port: number; seenUrls: string[] }> {
    const serveToolbar = async (req: IncomingMessage, res: ServerResponse) => {
      const name = (req.url ?? '').replace(/^\//, '');
      if (name !== 'toolbar.js') return false;
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
      res.end('console.log(1)');
      return true;
    };
    return startHandler(registryPath, serveToolbar);
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
      pendingUpdateVersion: null,
    });
  });

  it('carries a pending update version at /api/machine/projects', async () => {
    const projectPath = await makeProjectDir('demo');
    const registryPath = await makeRegistryFile(
      addProject({ version: 1, projects: [] }, projectPath, 'Demo').registry,
    );
    const { port } = await startHandler(registryPath, undefined, () => '0.29.1');

    const response = await fetch(`http://127.0.0.1:${port}/api/machine/projects`);

    expect(await response.json()).toMatchObject({ pendingUpdateVersion: '0.29.1' });
  });

  it('405s a non-POST request to /api/machine/update without calling the handler', async () => {
    const registryPath = await makeRegistryFile({ version: 1, projects: [] });
    const handleMachineUpdate = vi.fn();
    const { port } = await startHandler(registryPath, undefined, undefined, handleMachineUpdate);

    const response = await fetch(`http://127.0.0.1:${port}/api/machine/update`);

    expect(response.status).toBe(405);
    expect(handleMachineUpdate).not.toHaveBeenCalled();
  });

  it('delegates a POST to /api/machine/update to the injected handler', async () => {
    const registryPath = await makeRegistryFile({ version: 1, projects: [] });
    const handleMachineUpdate = vi.fn(async (_req: IncomingMessage, res: ServerResponse) => {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ outcome: 'installed' }));
    });
    const { port } = await startHandler(registryPath, undefined, undefined, handleMachineUpdate);

    const response = await fetch(`http://127.0.0.1:${port}/api/machine/update`, {
      method: 'POST',
      body: JSON.stringify({ version: '0.29.1' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ outcome: 'installed' });
    expect(handleMachineUpdate).toHaveBeenCalledOnce();
  });

  it('delegates /api/machine/pair-code and its /:code suffix to the injected handler', async () => {
    const registryPath = await makeRegistryFile({ version: 1, projects: [] });
    const handleMachinePairCode = vi.fn(async (_req: IncomingMessage, res: ServerResponse) => {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true }));
    });
    const { port } = await startHandler(
      registryPath,
      undefined,
      undefined,
      undefined,
      handleMachinePairCode,
    );

    const mint = await fetch(`http://127.0.0.1:${port}/api/machine/pair-code`, { method: 'POST' });
    const read = await fetch(`http://127.0.0.1:${port}/api/machine/pair-code/ABCD1234`);

    expect(mint.status).toBe(200);
    expect(read.status).toBe(200);
    expect(handleMachinePairCode).toHaveBeenCalledTimes(2);
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
      pendingUpdateVersion: null,
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
      pendingUpdateVersion: null,
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

  it('serves the toolbar bundle mounted at /p/<slug>/toolbar.js', async () => {
    const projectPath = await makeProjectDir('demo');
    const registryPath = await makeRegistryFile(
      addProject({ version: 1, projects: [] }, projectPath, 'Demo').registry,
    );
    const { port, seenUrls } = await startHandlerWithFakeToolbar(registryPath);

    const response = await fetch(`http://127.0.0.1:${port}/p/demo/toolbar.js`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
    expect(await response.text()).toBe('console.log(1)');
    expect(seenUrls).toEqual([]);
  });

  it('answers a toolbar asset request with CORS headers for a loopback origin', async () => {
    const projectPath = await makeProjectDir('demo');
    const registryPath = await makeRegistryFile(
      addProject({ version: 1, projects: [] }, projectPath, 'Demo').registry,
    );
    const { port } = await startHandlerWithFakeToolbar(registryPath);

    const response = await fetch(`http://127.0.0.1:${port}/p/demo/toolbar.js`, {
      headers: { Origin: 'http://localhost:5173' },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
  });

  it('answers the CORS preflight for a toolbar asset from a loopback origin', async () => {
    const projectPath = await makeProjectDir('demo');
    const registryPath = await makeRegistryFile(
      addProject({ version: 1, projects: [] }, projectPath, 'Demo').registry,
    );
    const { port } = await startHandlerWithFakeToolbar(registryPath);

    const response = await fetch(`http://127.0.0.1:${port}/p/demo/toolbar.js`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET',
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(response.headers.get('access-control-allow-methods')).toContain('GET');
  });

  it('omits CORS headers for a toolbar asset request from a non-loopback origin', async () => {
    const projectPath = await makeProjectDir('demo');
    const registryPath = await makeRegistryFile(
      addProject({ version: 1, projects: [] }, projectPath, 'Demo').registry,
    );
    const { port } = await startHandlerWithFakeToolbar(registryPath);

    const response = await fetch(`http://127.0.0.1:${port}/p/demo/toolbar.js`, {
      headers: { Origin: 'https://evil.example' },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('falls through to the mounted API when the toolbar asset is not found', async () => {
    const projectPath = await makeProjectDir('demo');
    const registryPath = await makeRegistryFile(
      addProject({ version: 1, projects: [] }, projectPath, 'Demo').registry,
    );
    const { port, seenUrls } = await startHandler(registryPath, async () => false);

    const response = await fetch(`http://127.0.0.1:${port}/p/demo/toolbar.js`);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('mounted');
    expect(seenUrls).toEqual(['/toolbar.js']);
  });
});

describe('createMachinePairHandler', () => {
  const pairServers: Server[] = [];
  afterAll(() => {
    for (const server of pairServers) server.close();
  });

  async function startPairServer() {
    const state: PairingManagerState = { token: 'long-token', origins: new Set() };
    const persist = vi.fn();
    const codes = createPairCodeManager();
    const handler = createMachinePairHandler(state, persist, codes);
    const server = createServer((req, res) => {
      void handler(req, res);
    });
    pairServers.push(server);
    const port = await new Promise<number>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
    });
    const post = (body: unknown, origin = 'https://paper.adoo.one') =>
      fetch(`http://127.0.0.1:${port}/api/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify(body),
      });
    return { state, persist, codes, port, post };
  }

  it('redeems a fresh code at the daemon root, pairing the origin and returning the token', async () => {
    const { state, persist, codes, post } = await startPairServer();
    const { code } = codes.mint();

    const response = await post({ code: `${code.slice(0, 4)}-${code.slice(4)}` });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      token: 'long-token',
      origin: 'https://paper.adoo.one',
    });
    expect(state.origins.has('https://paper.adoo.one')).toBe(true);
    expect(persist).toHaveBeenCalled();
  });

  it('refuses a code that was already used', async () => {
    const { codes, post } = await startPairServer();
    const { code } = codes.mint();
    await post({ code });

    const second = await post({ code }, 'https://another.example');
    expect(second.status).toBe(403);
  });

  it('answers the CORS preflight a hosted client sends before posting JSON', async () => {
    const { port } = await startPairServer();
    const response = await fetch(`http://127.0.0.1:${port}/api/pair`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://paper.adoo.one',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    });
    expect(response.status).toBeLessThan(300);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://paper.adoo.one');
  });
});
