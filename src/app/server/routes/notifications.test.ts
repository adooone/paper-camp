import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { appendNotification, readNotifications } from '../notification-log';
import { notificationRoutes } from './notifications';
import type { RouteContext } from './types';

const roots: string[] = [];

afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-notifications-route-test-'));
  roots.push(root);
  await mkdir(join(root, 'papercamp'), { recursive: true });
  return root;
}

function route(root: string, path: string) {
  const found = notificationRoutes({ root } as RouteContext).find((r) => r.path === path);
  if (!found) throw new Error(`no route registered for ${path}`);
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

describe('POST /api/notifications/mark-read', () => {
  it('flips the matching notification to read', async () => {
    const root = await makeRoot();
    await appendNotification(root, {
      id: 'notif-1',
      kind: 'completed',
      entityId: 'IDEA-1',
      entityTitle: 'First',
      text: 'run-all finished',
    });

    const { res, status, json } = fakeRes();
    await route(root, '/api/notifications/mark-read').handle(
      fakeReq(JSON.stringify({ id: 'notif-1' })),
      res,
    );

    expect(status()).toBe(200);
    expect(json()).toMatchObject({ ok: true });
    const logged = await readNotifications(root);
    expect(logged.find((n) => n.id === 'notif-1')?.read).toBe(true);
  });

  it('rejects a request without an id', async () => {
    const root = await makeRoot();
    const { res, status, json } = fakeRes();
    await route(root, '/api/notifications/mark-read').handle(fakeReq(JSON.stringify({})), res);

    expect(status()).toBe(400);
    expect(json()).toMatchObject({ error: 'id is required' });
  });
});
