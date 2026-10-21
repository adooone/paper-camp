import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { capabilitiesRoutes } from './capabilities';
import type { RouteContext } from './types';

const mock = vi.hoisted(() => ({
  cleared: [] as string[],
  authCleared: [] as string[],
  capabilities: [] as unknown[],
  connections: [] as unknown[],
}));

vi.mock('../capabilities', () => ({
  clearCapabilitiesCache: (root: string) => {
    mock.cleared.push(root);
  },
  clearAgentAuthStatusCache: (root: string) => {
    mock.authCleared.push(root);
  },
  probeCapabilities: async () => mock.capabilities,
  probeConnections: async () => mock.connections,
  runConnect: async () => null,
}));

function route(path: string, method: string) {
  const found = capabilitiesRoutes({ root: '/repo' } as RouteContext).find(
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

describe('GET /api/capabilities', () => {
  it('serves the cached probe without clearing it', async () => {
    mock.cleared.length = 0;
    const { res } = fakeRes();
    await route('/api/capabilities', 'GET').handle(fakeReq('/api/capabilities'), res);
    expect(mock.cleared).toEqual([]);
  });

  it('clears the capabilities cache when recheck is requested', async () => {
    mock.cleared.length = 0;
    const { res } = fakeRes();
    await route('/api/capabilities', 'GET').handle(fakeReq('/api/capabilities?recheck=1'), res);
    expect(mock.cleared).toEqual(['/repo']);
  });
});

describe('GET /api/connections', () => {
  it('serves the cached probe without clearing it', async () => {
    mock.cleared.length = 0;
    mock.authCleared.length = 0;
    const { res } = fakeRes();
    await route('/api/connections', 'GET').handle(fakeReq('/api/connections'), res);
    expect(mock.cleared).toEqual([]);
    expect(mock.authCleared).toEqual([]);
  });

  it('clears the capabilities and Claude auth status caches when recheck is requested', async () => {
    mock.cleared.length = 0;
    mock.authCleared.length = 0;
    const { res } = fakeRes();
    await route('/api/connections', 'GET').handle(fakeReq('/api/connections?recheck=1'), res);
    expect(mock.cleared).toEqual(['/repo']);
    expect(mock.authCleared).toEqual(['/repo']);
  });
});
