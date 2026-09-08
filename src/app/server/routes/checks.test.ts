import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DeskCheckState } from '@/types/index';
import { describe, expect, it, vi } from 'vitest';
import { MissingChangedCmdError, MissingFixCmdError } from '../desk-checks';
import { checkRoutes } from './checks';
import type { RouteContext } from './types';

function route(path: string, method: string, checks: Partial<RouteContext['checks']>) {
  const found = checkRoutes({ checks } as RouteContext).find(
    (r) => r.path === path && r.method === method,
  );
  if (!found) throw new Error(`no route registered for ${method} ${path}`);
  return found;
}

function fakeReq(url: string, body = ''): IncomingMessage {
  const listeners: Record<string, (chunk?: string) => void> = {};
  const req = {
    url,
    headers: { host: 'localhost' },
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

describe('POST /api/checks/changed', () => {
  it('rejects a missing name with 400', async () => {
    const runChangedCheck = vi.fn();
    const { res, status } = fakeRes();
    await route('/api/checks/changed', 'POST', { runChangedCheck }).handle(
      fakeReq('/api/checks/changed'),
      res,
    );
    expect(status()).toBe(400);
    expect(runChangedCheck).not.toHaveBeenCalled();
  });

  it('runs the changed check and returns 202', async () => {
    const runChangedCheck = vi.fn();
    const { res, status } = fakeRes();
    await route('/api/checks/changed', 'POST', { runChangedCheck }).handle(
      fakeReq('/api/checks/changed?name=test'),
      res,
    );
    expect(status()).toBe(202);
    expect(runChangedCheck).toHaveBeenCalledWith('test');
  });

  it('reports a check with no changed command as 400', async () => {
    const runChangedCheck = vi.fn(() => {
      throw new MissingChangedCmdError('Check "test" has no changed command');
    });
    const { res, status, json } = fakeRes();
    await route('/api/checks/changed', 'POST', { runChangedCheck }).handle(
      fakeReq('/api/checks/changed?name=test'),
      res,
    );
    expect(status()).toBe(400);
    expect((json() as { error: string }).error).toMatch(/changed command/);
  });

  it('reports an unknown check as 404', async () => {
    const runChangedCheck = vi.fn(() => {
      throw new Error('No check named "ghost" in the desk manifest');
    });
    const { res, status, json } = fakeRes();
    await route('/api/checks/changed', 'POST', { runChangedCheck }).handle(
      fakeReq('/api/checks/changed?name=ghost'),
      res,
    );
    expect(status()).toBe(404);
    expect((json() as { error: string }).error).toMatch(/ghost/);
  });
});

describe('POST /api/checks/fix', () => {
  it('rejects a missing name with 400', async () => {
    const runFix = vi.fn();
    const { res, status } = fakeRes();
    await route('/api/checks/fix', 'POST', { runFix }).handle(
      fakeReq('/api/checks/fix', '{}'),
      res,
    );
    expect(status()).toBe(400);
    expect(runFix).not.toHaveBeenCalled();
  });

  it('runs the fix and returns the refreshed check state', async () => {
    const state: DeskCheckState = {
      name: 'lint',
      cmd: 'pnpm lint',
      fixCmd: 'pnpm lint:write',
      status: 'pass',
      lastRun: null,
      output: '',
    };
    const runFix = vi.fn(async () => state);
    const { res, status, json } = fakeRes();
    await route('/api/checks/fix', 'POST', { runFix }).handle(
      fakeReq('/api/checks/fix', JSON.stringify({ name: 'lint' })),
      res,
    );
    expect(status()).toBe(200);
    expect(json()).toEqual({ check: state });
    expect(runFix).toHaveBeenCalledWith('lint');
  });

  it('reports a check with no fix command as 400', async () => {
    const runFix = vi.fn(() => {
      throw new MissingFixCmdError('Check "types" has no fix command');
    });
    const { res, status, json } = fakeRes();
    await route('/api/checks/fix', 'POST', { runFix }).handle(
      fakeReq('/api/checks/fix', JSON.stringify({ name: 'types' })),
      res,
    );
    expect(status()).toBe(400);
    expect((json() as { error: string }).error).toMatch(/types/);
  });

  it('reports an unknown check as 404', async () => {
    const runFix = vi.fn(() => {
      throw new Error('No check named "ghost" in the desk manifest');
    });
    const { res, status, json } = fakeRes();
    await route('/api/checks/fix', 'POST', { runFix }).handle(
      fakeReq('/api/checks/fix', JSON.stringify({ name: 'ghost' })),
      res,
    );
    expect(status()).toBe(404);
    expect((json() as { error: string }).error).toMatch(/ghost/);
  });
});
