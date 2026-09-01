import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DeskConfig } from '@/types/index';
import { describe, expect, it, vi } from 'vitest';
import { deskDiscoveryRoutes } from './desk-discovery';
import type { RouteContext } from './types';

function route(root: string, ctx: Partial<RouteContext>) {
  const found = deskDiscoveryRoutes({ root, ...ctx } as RouteContext).find(
    (r) => r.path === '/api/desk/discover',
  );
  if (!found) throw new Error('no route registered for /api/desk/discover');
  return found;
}

function fakeReq(): IncomingMessage {
  return { url: '', headers: {} } as unknown as IncomingMessage;
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

describe('POST /api/desk/discover', () => {
  it('returns the proposal returned by the agent', async () => {
    const proposal: DeskConfig = {
      services: [{ name: 'Dev', cmd: 'vite' }],
      checks: [{ name: 'Tests', cmd: 'vitest run' }],
      ci: { repo: 'acme/widgets' },
    };
    const runDeskDiscovery = vi.fn(async () => proposal);
    const { res, status, json } = fakeRes();
    await route('/tmp', {
      agent: { runDeskDiscovery } as unknown as RouteContext['agent'],
    }).handle(fakeReq(), res);
    expect(status()).toBe(200);
    expect(json()).toEqual({ proposal });
    expect(runDeskDiscovery).toHaveBeenCalledOnce();
  });

  it('returns 400 when the agent errors', async () => {
    const runDeskDiscovery = vi.fn(async () => {
      throw new Error('Agent did not return valid JSON for the desk config');
    });
    const { res, status, json } = fakeRes();
    await route('/tmp', {
      agent: { runDeskDiscovery } as unknown as RouteContext['agent'],
    }).handle(fakeReq(), res);
    expect(status()).toBe(400);
    expect(json()).toEqual({
      error: 'Agent did not return valid JSON for the desk config',
    });
  });
});
