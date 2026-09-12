import { mkdtemp, rm } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultPushStorePath, loadPushStore } from '@/core/push-store';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { pushRoutes } from './push';
import type { RouteContext } from './types';

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
});

async function useConfigDir(): Promise<string> {
  const dir = await makeTempDir('paper-camp-push-route-config-');
  originalConfigDir = process.env.PAPERCAMP_CONFIG_DIR;
  process.env.PAPERCAMP_CONFIG_DIR = dir;
  return dir;
}

function route(root: string, method: string, path: string) {
  const found = pushRoutes({ root } as RouteContext).find(
    (r) => r.method === method && r.path === path,
  );
  if (!found) throw new Error(`no route registered for ${method} ${path}`);
  return found;
}

function fakeReq(body: string): IncomingMessage {
  const listeners: Record<string, (chunk?: string) => void> = {};
  const req = {
    url: '',
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

describe('GET /api/push/public-key', () => {
  it('mints and returns a VAPID public key, stable across calls', async () => {
    await useConfigDir();
    const { res, status, json } = fakeRes();
    await route('/repo/a', 'GET', '/api/push/public-key').handle(fakeReq(''), res);

    expect(status()).toBe(200);
    const { publicKey } = json() as { publicKey: string };
    expect(publicKey).toMatch(/^[A-Za-z0-9_-]+$/);

    const second = fakeRes();
    await route('/repo/a', 'GET', '/api/push/public-key').handle(fakeReq(''), second.res);
    expect((second.json() as { publicKey: string }).publicKey).toBe(publicKey);
  });
});

describe('GET /api/push/subscriptions', () => {
  it('lists redacted subscriptions for the project only', async () => {
    await useConfigDir();
    await route('/repo/a', 'POST', '/api/push/subscribe').handle(
      fakeReq(
        JSON.stringify({
          transport: 'webpush',
          name: 'Chrome on laptop',
          subscription: { endpoint: 'https://push.example/1', keys: { p256dh: 'p', auth: 'a' } },
        }),
      ),
      fakeRes().res,
    );
    await route('/repo/b', 'POST', '/api/push/subscribe').handle(
      fakeReq(
        JSON.stringify({ transport: 'expo', name: 'Phone', token: 'ExponentPushToken[abc]' }),
      ),
      fakeRes().res,
    );

    const { res, status, json } = fakeRes();
    await route('/repo/a', 'GET', '/api/push/subscriptions').handle(fakeReq(''), res);

    expect(status()).toBe(200);
    expect(json()).toEqual([
      { transport: 'webpush', name: 'Chrome on laptop', key: 'https://push.example/1' },
    ]);
  });
});

describe('POST /api/push/subscribe', () => {
  it('stores a webpush subscription for the project', async () => {
    await useConfigDir();
    const { res, status, json } = fakeRes();
    await route('/repo/a', 'POST', '/api/push/subscribe').handle(
      fakeReq(
        JSON.stringify({
          transport: 'webpush',
          name: 'Chrome on laptop',
          subscription: { endpoint: 'https://push.example/1', keys: { p256dh: 'p', auth: 'a' } },
        }),
      ),
      res,
    );

    expect(status()).toBe(200);
    expect(json()).toMatchObject({ ok: true });
    const store = await loadPushStore(defaultPushStorePath());
    expect(store.subscriptions).toMatchObject([{ root: '/repo/a', transport: 'webpush' }]);
  });

  it('stores an expo subscription for the project', async () => {
    await useConfigDir();
    const { res, status } = fakeRes();
    await route('/repo/a', 'POST', '/api/push/subscribe').handle(
      fakeReq(
        JSON.stringify({ transport: 'expo', name: 'Phone', token: 'ExponentPushToken[abc]' }),
      ),
      res,
    );

    expect(status()).toBe(200);
    const store = await loadPushStore(defaultPushStorePath());
    expect(store.subscriptions).toMatchObject([
      { root: '/repo/a', transport: 'expo', token: 'ExponentPushToken[abc]' },
    ]);
  });

  it('rejects a malformed body', async () => {
    await useConfigDir();
    const { res, status, json } = fakeRes();
    await route('/repo/a', 'POST', '/api/push/subscribe').handle(fakeReq(JSON.stringify({})), res);

    expect(status()).toBe(400);
    expect(json()).toMatchObject({ error: expect.any(String) });
  });
});

describe('DELETE /api/push/subscribe', () => {
  it('removes a matching subscription and reports removed: true', async () => {
    await useConfigDir();
    await route('/repo/a', 'POST', '/api/push/subscribe').handle(
      fakeReq(
        JSON.stringify({
          transport: 'webpush',
          name: 'Chrome on laptop',
          subscription: { endpoint: 'https://push.example/1', keys: { p256dh: 'p', auth: 'a' } },
        }),
      ),
      fakeRes().res,
    );

    const { res, status, json } = fakeRes();
    await route('/repo/a', 'DELETE', '/api/push/subscribe').handle(
      fakeReq(JSON.stringify({ transport: 'webpush', endpoint: 'https://push.example/1' })),
      res,
    );

    expect(status()).toBe(200);
    expect(json()).toMatchObject({ ok: true, removed: true });
    const store = await loadPushStore(defaultPushStorePath());
    expect(store.subscriptions).toEqual([]);
  });

  it('reports removed: false for an unknown subscription', async () => {
    await useConfigDir();
    const { res, json } = fakeRes();
    await route('/repo/a', 'DELETE', '/api/push/subscribe').handle(
      fakeReq(JSON.stringify({ transport: 'webpush', endpoint: 'https://push.example/gone' })),
      res,
    );

    expect(json()).toMatchObject({ ok: true, removed: false });
  });
});
