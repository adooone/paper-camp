import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TailnetStatus } from '../core/tailnet';

const { mockReadTailnetStatus } = vi.hoisted(() => ({
  mockReadTailnetStatus: vi.fn<() => Promise<TailnetStatus | undefined>>(),
}));
vi.mock('../core/tailnet', () => ({ readTailnetStatus: mockReadTailnetStatus }));

import {
  bestNetworkHost,
  buildRegistrationLinkForMachine,
  buildRegistrationLinkForRuntime,
  hostedClientUrl,
  networkRegistrationLink,
} from './registration-link';

describe('hostedClientUrl', () => {
  afterEach(() => {
    Reflect.deleteProperty(process.env, 'PAPERCAMP_HOSTED_CLIENT_URL');
  });

  it('defaults to the hosted client this package deploys', () => {
    expect(hostedClientUrl()).toBe('https://paper-camp.vercel.app');
  });

  it('is overridable for a fork serving its own deployment', () => {
    process.env.PAPERCAMP_HOSTED_CLIENT_URL = 'https://camp.example.com';
    expect(hostedClientUrl()).toBe('https://camp.example.com');
  });

  it('drops a trailing slash so the link never doubles one up', () => {
    process.env.PAPERCAMP_HOSTED_CLIENT_URL = 'https://camp.example.com/';
    expect(hostedClientUrl()).toBe('https://camp.example.com');
  });

  it('falls back to the default when the override is blank', () => {
    process.env.PAPERCAMP_HOSTED_CLIENT_URL = '   ';
    expect(hostedClientUrl()).toBe('https://paper-camp.vercel.app');
  });
});

describe('buildRegistrationLinkForRuntime', () => {
  // The link's ORIGIN is the hosted client, never the runtime — the runtime address
  // only ever appears as the `runtime` query value. A link at the runtime's own
  // origin would register it into that origin's own localStorage, which no other
  // project's runtime shares, so it could never join a cross-project registry.
  it('carries the runtime as a query value on the hosted client origin', () => {
    expect(
      buildRegistrationLinkForRuntime(
        'https://foo-bar.trycloudflare.com',
        'abc123',
        'https://paper-camp.vercel.app',
      ),
    ).toBe(
      'https://paper-camp.vercel.app/?runtime=https%3A%2F%2Ffoo-bar.trycloudflare.com&token=abc123',
    );
  });

  it('is adopted back into the same runtime URL and token by the client', async () => {
    const { loadRuntimeConnection } = await import('../app/services/runtime-connection');
    const link = buildRegistrationLinkForRuntime(
      'https://foo-bar.trycloudflare.com',
      'def456',
      'https://paper-camp.vercel.app',
    );
    const search = link.slice(link.indexOf('?'));
    expect(loadRuntimeConnection({ search }, null)).toEqual({
      runtimeUrl: 'https://foo-bar.trycloudflare.com',
      pairingToken: 'def456',
    });
  });

  it('defaults to the configured hosted client when none is passed', () => {
    expect(buildRegistrationLinkForRuntime('http://localhost:3333', 'abc123')).toBe(
      'https://paper-camp.vercel.app/?runtime=http%3A%2F%2Flocalhost%3A3333&token=abc123',
    );
  });
});

describe('buildRegistrationLinkForMachine', () => {
  // A `?machine=` link is the daemon declaring it serves a machine, not a single
  // project — the param is how the hub tells the two link shapes apart on sight.
  it('carries the machine as a query value, not a runtime', () => {
    expect(
      buildRegistrationLinkForMachine(
        'http://100.80.79.13:4333',
        'abc123',
        'https://paper-camp.vercel.app',
      ),
    ).toBe('https://paper-camp.vercel.app/?machine=http%3A%2F%2F100.80.79.13%3A4333&token=abc123');
  });

  it('defaults to the configured hosted client when none is passed', () => {
    expect(buildRegistrationLinkForMachine('http://localhost:4333', 'abc123')).toBe(
      'https://paper-camp.vercel.app/?machine=http%3A%2F%2Flocalhost%3A4333&token=abc123',
    );
  });
});

describe('bestNetworkHost', () => {
  const lo = [{ family: 'IPv4', internal: true, address: '127.0.0.1' }];

  it('prefers a tailnet address — it reaches the user’s other devices even off-LAN', () => {
    const host = bestNetworkHost(
      {
        lo,
        wan: [{ family: 'IPv4', internal: false, address: '69.62.127.217' }],
        eth0: [{ family: 'IPv4', internal: false, address: '192.168.1.20' }],
        tailscale0: [
          { family: 'IPv4', internal: false, address: '100.80.79.13' },
          { family: 'IPv6', internal: false, address: 'fd7a:115c::1' },
        ],
      },
      'deimos',
    );
    expect(host).toBe('100.80.79.13');
  });

  it('takes a private LAN address over a public one, regardless of interface order', () => {
    const host = bestNetworkHost(
      {
        wan: [{ family: 'IPv4', internal: false, address: '69.62.127.217' }],
        eth0: [{ family: 'IPv4', internal: false, address: '192.168.1.20' }],
      },
      'deimos',
    );
    expect(host).toBe('192.168.1.20');
  });

  it('ignores container and VM bridges even though their addresses look private', () => {
    const host = bestNetworkHost(
      {
        lo,
        docker0: [{ family: 'IPv4', internal: false, address: '172.17.0.1' }],
        'br-f00d': [{ family: 'IPv4', internal: false, address: '172.18.0.1' }],
      },
      'deimos',
    );
    expect(host).toBe('deimos');
  });

  it('still offers a public address when it is all the machine has', () => {
    const host = bestNetworkHost(
      { wan: [{ family: 'IPv4', internal: false, address: '69.62.127.217' }] },
      'deimos',
    );
    expect(host).toBe('69.62.127.217');
  });

  it('skips link-local addresses, which no other machine can route to', () => {
    const host = bestNetworkHost(
      { eth0: [{ family: 'IPv4', internal: false, address: '169.254.10.10' }] },
      'deimos',
    );
    expect(host).toBe('deimos');
  });

  it('returns undefined when there is neither an address nor a hostname', () => {
    expect(bestNetworkHost({ lo }, '')).toBeUndefined();
  });
});

describe('networkRegistrationLink', () => {
  afterEach(() => {
    Reflect.deleteProperty(process.env, 'PAPERCAMP_HOSTED_CLIENT_URL');
    mockReadTailnetStatus.mockReset();
  });

  it('reports blocked, with no link, for the default https hosted client and an http runtime', async () => {
    mockReadTailnetStatus.mockResolvedValue(undefined);
    const registration = await networkRegistrationLink(3333, 'abc123');
    expect(registration.blocked).toBe(true);
    expect(registration.link).toBeUndefined();
  });

  it('prefers the MagicDNS name over an address once an http hosted client makes the pair reachable', async () => {
    process.env.PAPERCAMP_HOSTED_CLIENT_URL = 'http://camp.example.com';
    mockReadTailnetStatus.mockResolvedValue({
      selfDnsName: 'deimos.pitta-ray.ts.net',
      magicDnsSuffix: 'pitta-ray.ts.net',
      onlinePeers: [],
    });
    const registration = await networkRegistrationLink(3333, 'abc123');
    expect(registration.blocked).toBe(false);
    expect(registration.link).toBe(
      'http://camp.example.com/?runtime=http%3A%2F%2Fdeimos.pitta-ray.ts.net%3A3333&token=abc123',
    );
  });

  it('falls back to the address order when Tailscale is down', async () => {
    process.env.PAPERCAMP_HOSTED_CLIENT_URL = 'http://camp.example.com';
    mockReadTailnetStatus.mockResolvedValue(undefined);
    const registration = await networkRegistrationLink(3333, 'abc123');
    expect(registration.link).not.toContain('.ts.net');
  });

  it('builds with the given link builder instead of the runtime default', async () => {
    process.env.PAPERCAMP_HOSTED_CLIENT_URL = 'http://camp.example.com';
    mockReadTailnetStatus.mockResolvedValue(undefined);
    const registration = await networkRegistrationLink(
      4333,
      'abc123',
      buildRegistrationLinkForMachine,
    );
    expect(registration.link).toContain('?machine=');
    expect(registration.link).not.toContain('?runtime=');
  });
});
