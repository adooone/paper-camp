import type { IncomingMessage, ServerResponse } from 'node:http';
import { hostname } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { applyCorsHeaders, handlePreflight, isForbiddenRequest, isTrustedHost } from './api';

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

  it("trusts this machine's own hostname (e.g. opening http://deimos:3333)", () => {
    const self = hostname().toLowerCase().split('.')[0];
    expect(isTrustedHost(self)).toBe(true);
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

  it('blocks a cross-site GET whose Origin is foreign, not just writes', () => {
    // A hosted client can now hit localhost too, so a page reading the API is
    // just as much a threat as one writing to it — the check applies to both.
    expect(
      isForbiddenRequest({
        headers: { host: 'localhost:3333', origin: 'https://evil.com' },
        method: 'GET',
      }),
    ).toBe(true);
  });

  it('trusts a paired origin even though it is not on a private network', () => {
    const isPairedOrigin = (origin: string) => origin === 'https://app.papercamp.dev';
    expect(
      isForbiddenRequest(
        { headers: { host: 'localhost:3333', origin: 'https://app.papercamp.dev' }, method: 'GET' },
        isPairedOrigin,
      ),
    ).toBe(false);
    expect(
      isForbiddenRequest(
        { headers: { host: 'localhost:3333', origin: 'https://evil.com' }, method: 'GET' },
        isPairedOrigin,
      ),
    ).toBe(true);
  });
});

function fakeReq(headers: Record<string, string | undefined>): IncomingMessage {
  return { headers } as unknown as IncomingMessage;
}

function fakeRes(): {
  res: ServerResponse;
  headers: () => Record<string, string>;
  status: () => number;
} {
  const headers: Record<string, string> = {};
  let statusCode = 0;
  const res = {
    setHeader: (name: string, value: string) => {
      headers[name] = value;
    },
    end: () => {},
    set statusCode(code: number) {
      statusCode = code;
    },
    get statusCode() {
      return statusCode;
    },
  } as unknown as ServerResponse;
  return { res, headers: () => headers, status: () => statusCode };
}

describe('applyCorsHeaders', () => {
  it('reflects the request Origin so a hosted client can read the response', () => {
    const { res, headers } = fakeRes();
    applyCorsHeaders(fakeReq({ origin: 'https://app.papercamp.dev' }), res);
    expect(headers()).toEqual({
      'Access-Control-Allow-Origin': 'https://app.papercamp.dev',
      Vary: 'Origin',
    });
  });

  it('sets nothing for a same-origin request with no Origin header', () => {
    const { res, headers } = fakeRes();
    applyCorsHeaders(fakeReq({}), res);
    expect(headers()).toEqual({});
  });
});

describe('handlePreflight', () => {
  it('answers a plain CORS preflight with allowed methods and headers', () => {
    const { res, headers, status } = fakeRes();
    handlePreflight(fakeReq({ 'access-control-request-headers': 'content-type' }), res);
    expect(status()).toBe(204);
    expect(headers()['Access-Control-Allow-Methods']).toBe(
      'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    );
    expect(headers()['Access-Control-Allow-Headers']).toBe('content-type');
    expect(headers()['Access-Control-Allow-Private-Network']).toBeUndefined();
  });

  it('grants Private Network Access when the browser requests it', () => {
    const { res, headers } = fakeRes();
    handlePreflight(fakeReq({ 'access-control-request-private-network': 'true' }), res);
    expect(headers()['Access-Control-Allow-Private-Network']).toBe('true');
  });
});
