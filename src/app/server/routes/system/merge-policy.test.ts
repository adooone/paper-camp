import { mkdtemp, rm } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { HttpError } from '../../http';
import type { RouteContext } from '../types';
import { mergePolicyRoutes } from './merge-policy';

const roots: string[] = [];

afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
});

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'papercamp-merge-policy-route-test-'));
  roots.push(root);
  return root;
}

function route(root: string) {
  const found = mergePolicyRoutes({ root } as RouteContext).find(
    (r) => r.path === '/api/merge-policy/apply',
  );
  if (!found) throw new Error('no route registered for /api/merge-policy/apply');
  return found;
}

function fakeReq(body: string): IncomingMessage {
  const listeners: Record<string, (chunk?: string) => void> = {};
  const req = {
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
  return { res, status: () => statusCode, json: () => JSON.parse(body) };
}

describe('POST /api/merge-policy/apply', () => {
  it('treats an empty body as "apply the recommended policy", not an error', async () => {
    const root = await makeRoot();
    const { res, status, json } = fakeRes();
    await route(root).handle(fakeReq(''), res);
    expect(status()).toBe(200);
    expect(json()).toMatchObject({ status: 'unavailable' });
  });

  it('throws HttpError(400) for a malformed JSON body — api.ts answers 400 for it', async () => {
    const root = await makeRoot();
    const { res } = fakeRes();
    const error = await Promise.resolve(route(root).handle(fakeReq('{not json'), res)).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(400);
  });

  it('rejects a well-formed but non-object JSON body with 400', async () => {
    const root = await makeRoot();
    const { res, status, json } = fakeRes();
    await route(root).handle(fakeReq(JSON.stringify([1, 2])), res);
    expect(status()).toBe(400);
    expect(json()).toMatchObject({ error: 'body must be a JSON object' });
  });
});
