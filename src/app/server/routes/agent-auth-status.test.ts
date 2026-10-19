import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { agentRoutes } from './agent';
import type { RouteContext } from './types';

const mock = vi.hoisted(() => ({ cleared: [] as string[] }));

vi.mock('../capabilities', () => ({
  clearCapabilitiesCache: () => {},
  clearAgentAuthStatusCache: (root: string) => {
    mock.cleared.push(root);
  },
  probeAgentAuthStatus: async () => ({ loggedIn: null, authMethod: null, apiProvider: null }),
}));

const ROOT = '/papercamp-agent-auth-status-test-root';

function route(path: string) {
  const found = agentRoutes({
    root: ROOT,
    activity: { notifyChanged: () => {}, publish: () => {} },
  } as unknown as RouteContext).find((r) => r.path === path);
  if (!found) throw new Error(`no route registered for ${path}`);
  return found;
}

function fakeReq(url: string): IncomingMessage {
  return { url, headers: { host: 'localhost' } } as unknown as IncomingMessage;
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

describe('GET /api/agent/auth-status', () => {
  it('serves the cached probe without clearing it', async () => {
    mock.cleared.length = 0;
    const { res } = fakeRes();
    await route('/api/agent/auth-status').handle(fakeReq('/api/agent/auth-status'), res);
    expect(mock.cleared).toEqual([]);
  });

  it('clears the agent auth status cache when recheck is requested', async () => {
    mock.cleared.length = 0;
    const { res } = fakeRes();
    await route('/api/agent/auth-status').handle(fakeReq('/api/agent/auth-status?recheck=1'), res);
    expect(mock.cleared).toEqual([ROOT]);
  });
});
