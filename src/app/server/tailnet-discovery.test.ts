import type { TailnetStatus } from '@/core/tailnet';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockReadTailnetStatus } = vi.hoisted(() => ({
  mockReadTailnetStatus: vi.fn<() => Promise<TailnetStatus | undefined>>(),
}));
vi.mock('@/core/tailnet', () => ({ readTailnetStatus: mockReadTailnetStatus }));

import { discoverTailnetPeerRuntimes, resetTailnetPeerDiscoveryCache } from './tailnet-discovery';

describe('discoverTailnetPeerRuntimes', () => {
  afterEach(() => {
    mockReadTailnetStatus.mockReset();
    resetTailnetPeerDiscoveryCache();
    vi.unstubAllGlobals();
  });

  it('returns nothing and never probes when Tailscale is not running', async () => {
    mockReadTailnetStatus.mockResolvedValue(undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect(await discoverTailnetPeerRuntimes()).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('probes every online peer in parallel and keeps the ones that answer', async () => {
    mockReadTailnetStatus.mockResolvedValue({
      selfDnsName: 'deimos.pitta-ray.ts.net',
      magicDnsSuffix: 'pitta-ray.ts.net',
      onlinePeers: [{ dnsName: 'phobos.pitta-ray.ts.net' }, { dnsName: 'io.pitta-ray.ts.net' }],
    } satisfies TailnetStatus);
    const fetchMock = vi.fn(async (url: string) =>
      url.startsWith('http://phobos.pitta-ray.ts.net:3333')
        ? { ok: true, json: async () => ({ version: '0.24.0' }) }
        : { ok: false },
    );
    vi.stubGlobal('fetch', fetchMock);

    const peers = await discoverTailnetPeerRuntimes();

    expect(peers).toEqual([
      {
        dnsName: 'phobos.pitta-ray.ts.net',
        runtimeUrl: 'http://phobos.pitta-ray.ts.net:3333',
        version: '0.24.0',
      },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('drops a peer whose probe throws (offline, timeout, refused)', async () => {
    mockReadTailnetStatus.mockResolvedValue({
      selfDnsName: 'deimos.pitta-ray.ts.net',
      magicDnsSuffix: 'pitta-ray.ts.net',
      onlinePeers: [{ dnsName: 'phobos.pitta-ray.ts.net' }],
    } satisfies TailnetStatus);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('timeout');
      }),
    );

    expect(await discoverTailnetPeerRuntimes()).toEqual([]);
  });

  it('caches across calls until a refresh is requested', async () => {
    mockReadTailnetStatus.mockResolvedValue({
      selfDnsName: 'deimos.pitta-ray.ts.net',
      magicDnsSuffix: 'pitta-ray.ts.net',
      onlinePeers: [{ dnsName: 'phobos.pitta-ray.ts.net' }],
    } satisfies TailnetStatus);
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ version: '0.24.0' }) }));
    vi.stubGlobal('fetch', fetchMock);

    await discoverTailnetPeerRuntimes();
    await discoverTailnetPeerRuntimes();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await discoverTailnetPeerRuntimes(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
