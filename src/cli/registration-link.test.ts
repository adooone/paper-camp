import { afterEach, describe, expect, it } from 'vitest';
import {
  buildRegistrationLink,
  buildRegistrationLinkForRuntime,
  hostedClientUrl,
  reachableHosts,
  registrationLinks,
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

describe('buildRegistrationLink', () => {
  it('builds the runtime address from host and port, still on the hosted client origin', () => {
    expect(
      buildRegistrationLink(3333, 'abc123', 'localhost', 'https://paper-camp.vercel.app'),
    ).toBe('https://paper-camp.vercel.app/?runtime=http%3A%2F%2Flocalhost%3A3333&token=abc123');
  });

  it('builds a link for whichever host the caller picked', () => {
    expect(
      buildRegistrationLink(
        3333,
        'abc',
        'deimos.pitta-ray.ts.net',
        'https://paper-camp.vercel.app',
      ),
    ).toBe(
      'https://paper-camp.vercel.app/?runtime=http%3A%2F%2Fdeimos.pitta-ray.ts.net%3A3333&token=abc',
    );
  });
});

describe('reachableHosts', () => {
  const interfaces = {
    lo: [{ family: 'IPv4', internal: true, address: '127.0.0.1' }],
    eth0: [{ family: 'IPv4', internal: false, address: '192.168.1.20' }],
    tailscale0: [
      { family: 'IPv4', internal: false, address: '100.80.79.13' },
      { family: 'IPv6', internal: false, address: 'fd7a:115c::1' },
    ],
  };

  it('offers every non-loopback IPv4 and the hostname alongside localhost', () => {
    expect(reachableHosts(interfaces, 'deimos')).toEqual([
      'localhost',
      'deimos',
      '192.168.1.20',
      '100.80.79.13',
    ]);
  });

  it('drops loopback and IPv6 addresses, which the link cannot use as a bare host', () => {
    expect(reachableHosts(interfaces, 'deimos')).not.toContain('127.0.0.1');
    expect(reachableHosts(interfaces, 'deimos')).not.toContain('fd7a:115c::1');
  });

  it('falls back to localhost alone when nothing else answers', () => {
    expect(reachableHosts({ lo: interfaces.lo }, '')).toEqual(['localhost']);
  });
});

describe('registrationLinks', () => {
  afterEach(() => {
    Reflect.deleteProperty(process.env, 'PAPERCAMP_HOSTED_CLIENT_URL');
  });

  it('emits one hosted-client link per reachable host, varying only the runtime value', () => {
    const links = registrationLinks(3333, 'abc123');
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.startsWith('https://paper-camp.vercel.app/?runtime=')).toBe(true);
    }
  });
});
