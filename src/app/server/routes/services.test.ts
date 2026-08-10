import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServiceState } from '@/types/index';
import { describe, expect, it, vi } from 'vitest';
import { serviceRoutes } from './services';
import type { RouteContext } from './types';

function route(path: string, method: string, services: Partial<RouteContext['services']>) {
  const found = serviceRoutes({ services } as RouteContext).find(
    (r) => r.path === path && r.method === method,
  );
  if (!found) throw new Error(`no route registered for ${method} ${path}`);
  return found;
}

function fakeReq(url: string): IncomingMessage {
  return { url, headers: { host: 'localhost' } } as unknown as IncomingMessage;
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

describe('GET /api/services', () => {
  it('returns the manifest-derived service states', async () => {
    const state: ServiceState = {
      name: 'app',
      cmd: 'pnpm dev',
      hasHealthcheck: true,
      status: 'running',
      health: 'up',
      pid: 1234,
      startedAt: null,
      exitCode: null,
    };
    const { res, status, json } = fakeRes();
    await route('/api/services', 'GET', { getStatus: () => [state] }).handle(
      fakeReq('/api/services'),
      res,
    );
    expect(status()).toBe(200);
    expect(json()).toEqual({ services: [state] });
  });
});

describe('POST /api/services/start', () => {
  it('rejects a missing name with 400', async () => {
    const start = vi.fn(async () => {});
    const { res, status } = fakeRes();
    await route('/api/services/start', 'POST', { start }).handle(
      fakeReq('/api/services/start'),
      res,
    );
    expect(status()).toBe(400);
    expect(start).not.toHaveBeenCalled();
  });

  it('starts a named service and returns 202', async () => {
    const start = vi.fn(async () => {});
    const { res, status } = fakeRes();
    await route('/api/services/start', 'POST', { start }).handle(
      fakeReq('/api/services/start?name=app'),
      res,
    );
    expect(status()).toBe(202);
    expect(start).toHaveBeenCalledWith('app');
  });

  it('reports an unknown service as 404', async () => {
    const start = vi.fn(async () => {
      throw new Error('No service named "ghost" in the desk manifest');
    });
    const { res, status, json } = fakeRes();
    await route('/api/services/start', 'POST', { start }).handle(
      fakeReq('/api/services/start?name=ghost'),
      res,
    );
    expect(status()).toBe(404);
    expect((json() as { error: string }).error).toMatch(/ghost/);
  });
});

describe('GET /api/services/logs', () => {
  it('404s when the service is not in the manifest', async () => {
    const { res, status } = fakeRes();
    await route('/api/services/logs', 'GET', { getLog: () => null }).handle(
      fakeReq('/api/services/logs?name=ghost'),
      res,
    );
    expect(status()).toBe(404);
  });

  it('returns the joined log tail', async () => {
    const { res, status, json } = fakeRes();
    await route('/api/services/logs', 'GET', { getLog: () => 'line 1\nline 2' }).handle(
      fakeReq('/api/services/logs?name=app'),
      res,
    );
    expect(status()).toBe(200);
    expect(json()).toEqual({ name: 'app', log: 'line 1\nline 2' });
  });
});
