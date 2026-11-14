import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { createActivityManager } from '../activity';
import { READ_CACHE_TTL_MS, createReadCache } from '../read-cache';
import { readRoutes } from './reads';

const IDEA =
  '---\nid: IDEA-1\ntitle: First idea\nstatus: idea\ncreated: 2026-01-01\n---\n\nBody text.\n';
import type { RouteContext } from './types';

const roots: string[] = [];

afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

async function makeRoot(config?: unknown): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-reads-route-test-'));
  roots.push(root);
  await mkdir(join(root, 'papercamp', 'ideas'), { recursive: true });
  if (config !== undefined) {
    await writeFile(join(root, 'papercamp', 'config.json'), JSON.stringify(config), 'utf-8');
  }
  return root;
}

function route(root: string, path: string) {
  const found = readRoutes({ root } as RouteContext).find((r) => r.path === path);
  if (!found) throw new Error(`no read route registered for ${path}`);
  return found;
}

function fakeRes(ifNoneMatch?: string): {
  res: ServerResponse;
  status: () => number;
  json: () => unknown;
  headers: Record<string, string>;
} {
  const headers: Record<string, string> = {};
  let statusCode = 0;
  let body = '';
  const res = {
    req: { headers: ifNoneMatch ? { 'if-none-match': ifNoneMatch } : {} },
    setHeader: (name: string, value: string) => {
      headers[name.toLowerCase()] = value;
    },
    removeHeader: () => {},
    end: (chunk?: string) => {
      body = chunk ?? '';
    },
    set statusCode(code: number) {
      statusCode = code;
    },
    get statusCode() {
      return statusCode;
    },
  } as unknown as ServerResponse;
  return { res, status: () => statusCode, json: () => JSON.parse(body), headers };
}

describe('readRoutes', () => {
  it('registers every entry as a GET route, not the legacy any-method match', async () => {
    const root = await makeRoot();
    for (const r of readRoutes({ root } as RouteContext)) {
      expect(r.method).toBe('GET');
    }
  });

  it('answers 200 with the handler result', async () => {
    const root = await makeRoot();
    const { res, status, json } = fakeRes();
    await route(root, '/api/package-name').handle({} as IncomingMessage, res);
    expect(status()).toBe(200);
    expect(json()).toBeNull();
  });
});

describe('GET /api/config', () => {
  it('answers null when config.json is missing', async () => {
    const root = await makeRoot();
    const { res, status, json } = fakeRes();
    await route(root, '/api/config').handle({} as IncomingMessage, res);
    expect(status()).toBe(200);
    expect(json()).toBeNull();
  });

  it('coerces defaultAgents and fills in subjects from the roadmap', async () => {
    const root = await makeRoot({
      projectName: 'demo',
      defaultAgents: { build: 'opencode' },
    });
    const { res, json } = fakeRes();
    await route(root, '/api/config').handle({} as IncomingMessage, res);
    const body = json() as { projectName: string; defaultAgents: { build: { agent: string } } };
    expect(body.projectName).toBe('demo');
    expect(body.defaultAgents.build).toEqual({ agent: 'opencode' });
  });
});

function reqFor(url: string): IncomingMessage {
  return { url, headers: { host: 'localhost' } } as unknown as IncomingMessage;
}

describe('GET /api/worklist and /api/entities', () => {
  async function seededRoot(): Promise<string> {
    const root = await makeRoot();
    await writeFile(join(root, 'papercamp', 'ideas', 'IDEA-1.md'), IDEA, 'utf-8');
    return root;
  }

  it('lists row-shaped entries without bodies', async () => {
    const root = await seededRoot();
    const { res, status, json } = fakeRes();
    await route(root, '/api/worklist').handle(reqFor('/api/worklist'), res);
    expect(status()).toBe(200);
    const rows = json() as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 'IDEA-1', title: 'First idea', active: false });
    expect(rows[0]).not.toHaveProperty('body');
  });

  it('serves one full entity by id', async () => {
    const root = await seededRoot();
    const { res, json } = fakeRes();
    await route(root, '/api/entities').handle(reqFor('/api/entities?id=IDEA-1'), res);
    expect(json()).toMatchObject({ id: 'IDEA-1', body: expect.stringContaining('Body text') });
  });

  it('throws a 404 for an unknown id', async () => {
    const root = await seededRoot();
    const { res } = fakeRes();
    await expect(
      route(root, '/api/entities').handle(reqFor('/api/entities?id=IDEA-99'), res),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('answers 304 when If-None-Match matches the ETag', async () => {
    const root = await seededRoot();
    const first = fakeRes();
    await route(root, '/api/worklist').handle(reqFor('/api/worklist'), first.res);
    const etag = first.headers.etag;
    expect(etag).toBeTruthy();
    const second = fakeRes(etag);
    await route(root, '/api/worklist').handle(reqFor('/api/worklist'), second.res);
    expect(second.status()).toBe(304);
  });
});

describe('GET /api/stats and /api/doctor', () => {
  function cachedRoutes(compute: {
    stats: () => Promise<unknown>;
    doctor: () => Promise<unknown>;
  }) {
    const activity = createActivityManager('/x');
    const stats = createReadCache(compute.stats);
    const doctor = createReadCache(compute.doctor);
    activity.onChange(() => {
      stats.drop();
      doctor.drop();
    });
    const routes = readRoutes({ root: '/x', activity, stats, doctor } as unknown as RouteContext);
    const call = async (path: string) => {
      const out = fakeRes();
      await routes.find((r) => r.path === path)?.handle({} as never, out.res);
      return out.json();
    };
    return { activity, call };
  }

  afterEach(() => vi.useRealTimers());

  it('answers a second request within five minutes from the cache', async () => {
    let n = 0;
    const doctor = vi.fn(async () => ({ run: ++n }));
    const stats = vi.fn(async () => ({ run: ++n }));
    const { activity, call } = cachedRoutes({ stats, doctor });
    expect(await call('/api/doctor')).toEqual({ run: 1 });
    expect(await call('/api/doctor')).toEqual({ run: 1 });
    expect(await call('/api/stats')).toEqual({ run: 2 });
    expect(await call('/api/stats')).toEqual({ run: 2 });
    expect(doctor).toHaveBeenCalledTimes(1);
    expect(stats).toHaveBeenCalledTimes(1);
    activity.close();
  });

  it('recomputes both after notifyChanged', async () => {
    const doctor = vi.fn(async () => ({}));
    const stats = vi.fn(async () => ({}));
    const { activity, call } = cachedRoutes({ stats, doctor });
    await call('/api/doctor');
    await call('/api/stats');
    activity.notifyChanged('git');
    await call('/api/doctor');
    await call('/api/stats');
    expect(doctor).toHaveBeenCalledTimes(2);
    expect(stats).toHaveBeenCalledTimes(2);
    activity.close();
  });

  it('recomputes once the five minutes are up', async () => {
    vi.useFakeTimers();
    const doctor = vi.fn(async () => ({}));
    const stats = vi.fn(async () => ({}));
    const { activity, call } = cachedRoutes({ stats, doctor });
    await call('/api/doctor');
    vi.advanceTimersByTime(READ_CACHE_TTL_MS);
    await call('/api/doctor');
    expect(doctor).toHaveBeenCalledTimes(2);
    activity.close();
  });
});
