import { describe, expect, it } from 'vitest';
import { buildRegistrationLink, reachableHosts } from './registration-link';

describe('buildRegistrationLink', () => {
  it('carries the runtime origin and pairing token as query params', () => {
    expect(buildRegistrationLink(3333, 'abc123')).toBe(
      'http://localhost:3333/?runtime=http%3A%2F%2Flocalhost%3A3333&token=abc123',
    );
  });

  it('is adopted back into the same runtime URL and token by the client', async () => {
    const { loadRuntimeConnection } = await import('../app/services/runtime-connection');
    const link = buildRegistrationLink(4444, 'def456');
    const search = link.slice(link.indexOf('?'));
    expect(loadRuntimeConnection({ search }, null)).toEqual({
      runtimeUrl: 'http://localhost:4444',
      pairingToken: 'def456',
    });
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

  it('builds a link for whichever host the caller picked', () => {
    expect(buildRegistrationLink(3333, 'abc', 'deimos.pitta-ray.ts.net')).toBe(
      'http://deimos.pitta-ray.ts.net:3333/?runtime=http%3A%2F%2Fdeimos.pitta-ray.ts.net%3A3333&token=abc',
    );
  });
});
