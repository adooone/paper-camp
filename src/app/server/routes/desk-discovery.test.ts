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
    const runReadOnlyPrompt = vi.fn(async () => JSON.stringify(proposal));
    const { res, status, json } = fakeRes();
    await route('/tmp', {
      agent: { runReadOnlyPrompt } as unknown as RouteContext['agent'],
    }).handle(fakeReq(), res);
    expect(status()).toBe(200);
    expect(json()).toEqual({ proposal });
    expect(runReadOnlyPrompt).toHaveBeenCalledOnce();
    expect(runReadOnlyPrompt.mock.calls[0]?.[0]).toBe('desk-discovery');
  });

  it('returns 400 when the agent errors', async () => {
    const runReadOnlyPrompt = vi.fn(async () => 'not json');
    const { res, status, json } = fakeRes();
    await route('/tmp', {
      agent: { runReadOnlyPrompt } as unknown as RouteContext['agent'],
    }).handle(fakeReq(), res);
    expect(status()).toBe(400);
    expect(json()).toEqual({
      error: 'Agent did not return a parseable desk config',
    });
  });
});
