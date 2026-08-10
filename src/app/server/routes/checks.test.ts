import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DeskCheckState } from '@/types/index';
import { describe, expect, it, vi } from 'vitest';
import { checkRoutes } from './checks';
import type { RouteContext } from './types';

function route(path: string, method: string, checks: Partial<RouteContext['checks']>) {
  const found = checkRoutes({ checks } as RouteContext).find(
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

describe('GET /api/checks', () => {
  it('returns the manifest-derived check states', async () => {
    const state: DeskCheckState = {
      name: 'types',
      cmd: 'pnpm check-types',
      status: 'pass',
      lastRun: null,
      output: '',
    };
    const { res, status, json } = fakeRes();
    await route('/api/checks', 'GET', { getStatus: () => [state] }).handle(
      fakeReq('/api/checks'),
      res,
    );
    expect(status()).toBe(200);
    expect(json()).toEqual({ checks: [state] });
  });
});

describe('POST /api/checks/run', () => {
  it('rejects a missing name with 400', async () => {
    const runCheck = vi.fn();
    const { res, status } = fakeRes();
    await route('/api/checks/run', 'POST', { runCheck }).handle(fakeReq('/api/checks/run'), res);
    expect(status()).toBe(400);
    expect(runCheck).not.toHaveBeenCalled();
  });

  it('runs a named check and returns 202', async () => {
    const runCheck = vi.fn();
    const { res, status } = fakeRes();
    await route('/api/checks/run', 'POST', { runCheck }).handle(
      fakeReq('/api/checks/run?name=types'),
      res,
    );
    expect(status()).toBe(202);
    expect(runCheck).toHaveBeenCalledWith('types');
  });

  it('reports an unknown check as 404', async () => {
    const runCheck = vi.fn(() => {
      throw new Error('No check named "ghost" in the desk manifest');
    });
    const { res, status, json } = fakeRes();
    await route('/api/checks/run', 'POST', { runCheck }).handle(
      fakeReq('/api/checks/run?name=ghost'),
      res,
    );
    expect(status()).toBe(404);
    expect((json() as { error: string }).error).toMatch(/ghost/);
  });
});
