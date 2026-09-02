import type { IncomingMessage, ServerResponse } from 'node:http';
import type { TailnetPeerRuntime } from '@/types/index';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockDiscoverTailnetPeerRuntimes } = vi.hoisted(() => ({
  mockDiscoverTailnetPeerRuntimes: vi.fn<(refresh: boolean) => Promise<TailnetPeerRuntime[]>>(),
}));
vi.mock('../tailnet-discovery', () => ({
  discoverTailnetPeerRuntimes: mockDiscoverTailnetPeerRuntimes,
}));

import { tailnetDiscoveryRoutes } from './tailnet-discovery';
import type { RouteContext } from './types';

function route(url: string) {
  const found = tailnetDiscoveryRoutes({} as RouteContext).find(
    (r) => r.path === '/api/tailnet/peers',
  );
  if (!found) throw new Error('no route registered for /api/tailnet/peers');
  const req = { url, headers: {} } as unknown as IncomingMessage;
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
  return {
    handle: () => found.handle(req, res),
    status: () => statusCode,
    json: () => JSON.parse(body),
  };
}

describe('GET /api/tailnet/peers', () => {
  afterEach(() => {
    mockDiscoverTailnetPeerRuntimes.mockReset();
  });

  it('returns the discovered peers without asking to refresh', async () => {
    const peers: TailnetPeerRuntime[] = [
      {
        dnsName: 'phobos.pitta-ray.ts.net',
        runtimeUrl: 'http://phobos.pitta-ray.ts.net:3333',
        version: '0.24.0',
      },
    ];
    mockDiscoverTailnetPeerRuntimes.mockResolvedValue(peers);

    const { handle, status, json } = route('/api/tailnet/peers');
    await handle();

    expect(status()).toBe(200);
    expect(json()).toEqual({ peers });
    expect(mockDiscoverTailnetPeerRuntimes).toHaveBeenCalledWith(false);
  });

  it('forces a refresh when ?refresh=1 is present', async () => {
    mockDiscoverTailnetPeerRuntimes.mockResolvedValue([]);

    const { handle } = route('/api/tailnet/peers?refresh=1');
    await handle();

    expect(mockDiscoverTailnetPeerRuntimes).toHaveBeenCalledWith(true);
  });
});
