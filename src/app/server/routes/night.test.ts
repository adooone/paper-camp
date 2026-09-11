import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  addProject,
  defaultRegistryPath,
  loadRegistry,
  saveRegistry,
  setNightProject,
} from '@/core/machine-registry';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import type { RouteContext } from './types';

const { mockSpawn } = vi.hoisted(() => ({ mockSpawn: vi.fn() }));
vi.mock('node:child_process', () => ({ spawn: mockSpawn }));
// The route now builds the health map itself; with git's spawn mocked above, the map
// is read back from the night.json each test seeds instead.
vi.mock('@/core/night-health', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/night-health')>();
  const { readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  return {
    ...actual,
    computeNightHealthMap: async (root: string) => {
      const raw = await readFile(join(root, 'papercamp', 'night.json'), 'utf-8').catch(() => null);
      const chunks = raw ? (JSON.parse(raw).chunks ?? []) : [];
      return { generatedAt: new Date().toISOString(), chunks };
    },
  };
});

import { nightRoutes } from './night';

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  dirs.push(dir);
  return dir;
}

let originalConfigDir: string | undefined;

afterEach(() => {
  // biome-ignore lint/performance/noDelete: an undefined assignment stringifies to "undefined" on process.env, unlike a plain object.
  if (originalConfigDir === undefined) delete process.env.PAPERCAMP_CONFIG_DIR;
  else process.env.PAPERCAMP_CONFIG_DIR = originalConfigDir;
  mockSpawn.mockReset();
});

async function useConfigDir(): Promise<string> {
  const dir = await makeTempDir('paper-camp-night-route-config-');
  originalConfigDir = process.env.PAPERCAMP_CONFIG_DIR;
  process.env.PAPERCAMP_CONFIG_DIR = dir;
  return dir;
}

async function makeProjectDir(name: string): Promise<string> {
  const parent = await makeTempDir('paper-camp-night-route-project-');
  const projectDir = join(parent, name);
  await mkdir(join(projectDir, 'papercamp'), { recursive: true });
  await writeFile(join(projectDir, 'papercamp', 'config.json'), '{}', 'utf-8');
  return projectDir;
}

function route(root: string, method: string, path: string) {
  const found = nightRoutes({ root } as RouteContext).find(
    (r) => r.method === method && r.path === path,
  );
  if (!found) throw new Error(`no ${method} ${path} route registered`);
  return found;
}

function fakeReq(body = ''): IncomingMessage {
  const listeners: Record<string, (chunk?: string) => void> = {};
  const req = {
    url: '/',
    headers: {},
    on(event: string, cb: (chunk?: string) => void) {
      listeners[event] = cb;
      return req;
    },
  } as unknown as IncomingMessage;
  queueMicrotask(() => {
    listeners.data?.(body);
    listeners.end?.();
  });
  return req;
}

function fakeRes(): { res: ServerResponse; status: () => number; json: () => unknown } {
  let statusCode = 0;
  let body = '';
  const res = {
    setHeader: () => {},
    end: (chunk: string) => {
      body = chunk;
    },
    set statusCode(code: number) {
      statusCode = code;
    },
    get statusCode() {
      return statusCode;
    },
  } as unknown as ServerResponse;
  return { res, status: () => statusCode, json: () => JSON.parse(body) };
}

describe('GET /api/night/status', () => {
  it('is disabled when no project is registered as the night project', async () => {
    await useConfigDir();
    const root = await makeProjectDir('demo');
    await saveRegistry(
      defaultRegistryPath(),
      addProject({ version: 1, projects: [] }, root).registry,
    );

    const { res, json } = fakeRes();
    await route(root, 'GET', '/api/night/status').handle(fakeReq(), res);
    expect(json()).toEqual({ enabled: false, pausedUntil: null });
  });

  it('is enabled with the current pausedUntil when this project is the night project', async () => {
    await useConfigDir();
    const root = await makeProjectDir('demo');
    const added = addProject({ version: 1, projects: [] }, root);
    const withNight = setNightProject(added.registry, added.entry.slug);
    await saveRegistry(defaultRegistryPath(), {
      ...withNight.registry,
      night: { ...withNight.registry.night!, pausedUntil: 123 },
    });

    const { res, json } = fakeRes();
    await route(root, 'GET', '/api/night/status').handle(fakeReq(), res);
    expect(json()).toEqual({ enabled: true, pausedUntil: 123 });
  });

  it('is disabled for an unregistered project', async () => {
    await useConfigDir();
    const root = await makeProjectDir('demo');

    const { res, json } = fakeRes();
    await route(root, 'GET', '/api/night/status').handle(fakeReq(), res);
    expect(json()).toEqual({ enabled: false, pausedUntil: null });
  });
});

describe('POST /api/night/toggle', () => {
  it('sets this project as the night project when enabling', async () => {
    await useConfigDir();
    const root = await makeProjectDir('demo');
    const added = addProject({ version: 1, projects: [] }, root);
    await saveRegistry(defaultRegistryPath(), added.registry);

    const { res, status } = fakeRes();
    await route(root, 'POST', '/api/night/toggle').handle(fakeReq('{"enabled":true}'), res);
    expect(status()).toBe(200);

    const registry = await loadRegistry(defaultRegistryPath());
    expect(registry.night?.slug).toBe(added.entry.slug);
  });

  it('clears the night project when disabling this (already-selected) project', async () => {
    await useConfigDir();
    const root = await makeProjectDir('demo');
    const added = addProject({ version: 1, projects: [] }, root);
    await saveRegistry(
      defaultRegistryPath(),
      setNightProject(added.registry, added.entry.slug).registry,
    );

    const { res, status } = fakeRes();
    await route(root, 'POST', '/api/night/toggle').handle(fakeReq('{"enabled":false}'), res);
    expect(status()).toBe(200);

    const registry = await loadRegistry(defaultRegistryPath());
    expect(registry.night).toBeUndefined();
  });

  it('does not clear a different project when disabling', async () => {
    await useConfigDir();
    const root = await makeProjectDir('demo');
    const other = await makeProjectDir('other');
    let registry = addProject({ version: 1, projects: [] }, root).registry;
    const otherAdded = addProject(registry, other);
    registry = setNightProject(otherAdded.registry, otherAdded.entry.slug).registry;
    await saveRegistry(defaultRegistryPath(), registry);

    const { res } = fakeRes();
    await route(root, 'POST', '/api/night/toggle').handle(fakeReq('{"enabled":false}'), res);

    const after = await loadRegistry(defaultRegistryPath());
    expect(after.night?.slug).toBe(otherAdded.entry.slug);
  });

  it('rejects enabling an unregistered project', async () => {
    await useConfigDir();
    const root = await makeProjectDir('demo');

    const { res, status } = fakeRes();
    await route(root, 'POST', '/api/night/toggle').handle(fakeReq('{"enabled":true}'), res);
    expect(status()).toBe(400);
  });
});

describe('POST /api/night/pause', () => {
  async function enableNight(root: string): Promise<void> {
    const added = addProject({ version: 1, projects: [] }, root);
    await saveRegistry(
      defaultRegistryPath(),
      setNightProject(added.registry, added.entry.slug).registry,
    );
  }

  it('rejects pausing when the night shift is not enabled here', async () => {
    await useConfigDir();
    const root = await makeProjectDir('demo');

    const { res, status } = fakeRes();
    await route(root, 'POST', '/api/night/pause').handle(fakeReq('{"paused":true}'), res);
    expect(status()).toBe(400);
  });

  it('rejects pausing when there is no capacity snapshot yet', async () => {
    await useConfigDir();
    const root = await makeProjectDir('demo');
    await enableNight(root);

    const { res, status } = fakeRes();
    await route(root, 'POST', '/api/night/pause').handle(fakeReq('{"paused":true}'), res);
    expect(status()).toBe(400);
  });

  it('pauses until the five-hour reset from the latest capacity snapshot', async () => {
    await useConfigDir();
    const root = await makeProjectDir('demo');
    await enableNight(root);
    await writeFile(
      join(root, 'papercamp', 'tasks.log'),
      `${JSON.stringify({
        id: '1',
        taskKind: 'phase',
        planTitle: 'x',
        agentId: 'claude-code',
        startedAt: '2026-01-01T00:00:00.000Z',
        endedAt: '2026-01-01T00:05:00.000Z',
        outcome: 'done',
        rateLimit: {
          status: 'allowed',
          unifiedWindows: { five_hour: { utilization: 0.1, resetsAt: 1800000000 } },
        },
      })}\n`,
      'utf-8',
    );

    const { res, status, json } = fakeRes();
    await route(root, 'POST', '/api/night/pause').handle(fakeReq('{"paused":true}'), res);
    expect(status()).toBe(200);
    expect(json()).toEqual({ ok: true, pausedUntil: 1800000000000 });

    const registry = await loadRegistry(defaultRegistryPath());
    expect(registry.night?.pausedUntil).toBe(1800000000000);
  });

  it('clears the pause', async () => {
    await useConfigDir();
    const root = await makeProjectDir('demo');
    await enableNight(root);
    const registryPath = defaultRegistryPath();
    const registry = await loadRegistry(registryPath);
    await saveRegistry(registryPath, {
      ...registry,
      night: { ...registry.night!, pausedUntil: 5 },
    });

    const { res, status, json } = fakeRes();
    await route(root, 'POST', '/api/night/pause').handle(fakeReq('{"paused":false}'), res);
    expect(status()).toBe(200);
    expect(json()).toEqual({ ok: true, pausedUntil: null });
  });
});

describe('POST /api/night/run', () => {
  async function enableNight(root: string): Promise<void> {
    const added = addProject({ version: 1, projects: [] }, root);
    await saveRegistry(
      defaultRegistryPath(),
      setNightProject(added.registry, added.entry.slug).registry,
    );
  }

  it('rejects running when the night shift is not enabled here', async () => {
    await useConfigDir();
    const root = await makeProjectDir('demo');

    const { res, status } = fakeRes();
    await route(root, 'POST', '/api/night/run').handle(fakeReq(), res);
    expect(status()).toBe(400);
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('rejects running when no chunk has been scored yet', async () => {
    await useConfigDir();
    const root = await makeProjectDir('demo');
    await enableNight(root);

    const { res, status } = fakeRes();
    await route(root, 'POST', '/api/night/run').handle(fakeReq(), res);
    expect(status()).toBe(400);
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('spawns a detached `paper-camp night run <chunk>` for the highest-scoring chunk', async () => {
    await useConfigDir();
    const root = await makeProjectDir('demo');
    await enableNight(root);
    await writeFile(
      join(root, 'papercamp', 'night.json'),
      JSON.stringify({
        chunks: [
          { path: 'src/core', score: 10 },
          { path: 'src/app', score: 80 },
        ],
      }),
      'utf-8',
    );
    const fakeChild = { unref: vi.fn(), on: vi.fn() };
    mockSpawn.mockReturnValue(fakeChild);
    const originalArgv1 = process.argv[1];
    process.argv[1] = '/fake/paper-camp';

    try {
      const { res, status, json } = fakeRes();
      await route(root, 'POST', '/api/night/run').handle(fakeReq(), res);
      expect(status()).toBe(202);
      expect(json()).toEqual({ ok: true, chunkPath: 'src/app' });
      expect(mockSpawn).toHaveBeenCalledWith(
        process.execPath,
        ['/fake/paper-camp', 'night', 'run', 'src/app'],
        expect.objectContaining({ cwd: root, detached: true }),
      );
    } finally {
      process.argv[1] = originalArgv1;
    }
  });

  it('rejects a second run while one is already in flight for this project', async () => {
    await useConfigDir();
    const root = await makeProjectDir('demo');
    await enableNight(root);
    await writeFile(
      join(root, 'papercamp', 'night.json'),
      JSON.stringify({ chunks: [{ path: 'src/core', score: 90 }] }),
      'utf-8',
    );
    const fakeChild = { unref: vi.fn(), on: vi.fn() };
    mockSpawn.mockReturnValue(fakeChild);
    const originalArgv1 = process.argv[1];
    process.argv[1] = '/fake/paper-camp';

    try {
      const first = fakeRes();
      await route(root, 'POST', '/api/night/run').handle(fakeReq(), first.res);
      expect(first.status()).toBe(202);

      const second = fakeRes();
      await route(root, 'POST', '/api/night/run').handle(fakeReq(), second.res);
      expect(second.status()).toBe(409);
    } finally {
      process.argv[1] = originalArgv1;
    }
  });
});
