import { afterEach, describe, expect, it } from 'vitest';
import { isForbiddenRequest, isTrustedHost } from './api';

describe('isTrustedHost', () => {
  afterEach(() => {
    process.env.PAPERCAMP_ALLOWED_HOSTS = '';
  });

  it('trusts loopback and private/Tailscale ranges', () => {
    for (const host of [
      'localhost',
      '127.0.0.1',
      '::1',
      '10.1.2.3',
      '192.168.1.5',
      '172.16.0.1',
      '172.31.255.254',
      '100.100.20.30', // Tailscale CGNAT
      'my-machine.local', // mDNS
      'laptop.tail1234.ts.net', // Tailscale MagicDNS
    ]) {
      expect(isTrustedHost(host), host).toBe(true);
    }
  });

  it('rejects public hosts (DNS-rebinding targets) and empties', () => {
    for (const host of [
      'evil.com',
      'papercamp.evil.com',
      '8.8.8.8',
      '172.32.0.1', // just outside 172.16/12
      '100.63.0.1', // just outside the CGNAT block
      '',
    ]) {
      expect(isTrustedHost(host), host).toBe(false);
    }
  });

  it('honours the PAPERCAMP_ALLOWED_HOSTS escape hatch', () => {
    process.env.PAPERCAMP_ALLOWED_HOSTS = 'dev.example.com, other.host';
    expect(isTrustedHost('dev.example.com')).toBe(true);
    expect(isTrustedHost('unlisted.example.com')).toBe(false);
  });
});

describe('isForbiddenRequest', () => {
  afterEach(() => {
    process.env.PAPERCAMP_ALLOWED_HOSTS = '';
  });

  it('allows a same-machine request with a trusted Host', () => {
    expect(isForbiddenRequest({ headers: { host: 'localhost:3333' }, method: 'GET' })).toBe(false);
    expect(
      isForbiddenRequest({
        headers: { host: '192.168.1.5:3333', origin: 'http://192.168.1.5:3333' },
        method: 'POST',
      }),
    ).toBe(false);
  });

  it('blocks a rebound public Host on any method', () => {
    // DNS rebinding: attacker page is evil.com, so Host and Origin both read evil.com.
    expect(
      isForbiddenRequest({
        headers: { host: 'evil.com:3333', origin: 'http://evil.com:3333' },
        method: 'GET',
      }),
    ).toBe(true);
  });

  it('blocks a cross-site POST whose Origin is foreign even with a trusted Host', () => {
    // Classic CSRF: the fetch targets localhost but the page's Origin is evil.com.
    expect(
      isForbiddenRequest({
        headers: { host: 'localhost:3333', origin: 'https://evil.com' },
        method: 'POST',
      }),
    ).toBe(true);
  });

  it('allows a trusted-Host GET with no Origin (non-browser client)', () => {
    expect(isForbiddenRequest({ headers: { host: '127.0.0.1:3333' }, method: 'GET' })).toBe(false);
  });
});
