import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/core/ci', () => ({ clearCiCache: vi.fn() }));
vi.mock('@/core/git-pr', () => ({
  clearPrCache: vi.fn().mockResolvedValue(undefined),
  peekCachedPrs: vi.fn().mockReturnValue(undefined),
  resolvePrsByEntity: vi.fn().mockResolvedValue(undefined),
  entitiesWithNewChangesRequested: vi.fn().mockReturnValue([]),
}));

const { statusRoutes } = await import('./status');
import type { RouteContext } from './types';

function fakeReq(url: string): IncomingMessage {
  return { url, headers: {} } as IncomingMessage;
}

function fakeRes(): { res: ServerResponse; status: () => number } {
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
  return { res, status: () => statusCode };
}

describe('POST /api/refresh', () => {
  it('notifies activity once the refresh completes', async () => {
    const notifyChanged = vi.fn();
    const routes = statusRoutes({
      root: '/tmp/papercamp-status-route-test',
      activity: { notifyChanged, publish: () => {} },
      status: { getStatus: async () => ({}) },
    } as unknown as RouteContext);
    const refresh = routes.find((r) => r.path === '/api/refresh');
    if (!refresh) throw new Error('no route registered for /api/refresh');

    const { res, status } = fakeRes();
    await refresh.handle(fakeReq('/api/refresh'), res);

    expect(status()).toBe(200);
    expect(notifyChanged).toHaveBeenCalledOnce();
  });
});
