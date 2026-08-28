import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { githubDeviceFlowRoutes } from './github-device-flow';
import type { RouteContext } from './types';

function route(method: 'POST', path: string) {
  const found = githubDeviceFlowRoutes({} as RouteContext).find(
    (r) => r.path === path && r.method === method,
  );
  if (!found) throw new Error(`no route registered for ${method} ${path}`);
  return found;
}

function fakeReq(body: string): IncomingMessage {
  const req = {
    headers: {},
    on: (event: string, cb: (chunk?: string) => void) => {
      if (event === 'data') cb(body);
      if (event === 'end') cb();
      return req;
    },
  };
  return req as unknown as IncomingMessage;
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

function jsonResponse(status: number, body: unknown): Response {
  return { status, json: async () => body } as Response;
}

describe('POST /api/github/device-code', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('proxies GitHub’s device code response straight back', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(200, {
          device_code: 'abc',
          user_code: 'WDJB-MJHT',
          verification_uri: 'https://github.com/login/device',
          expires_in: 900,
          interval: 5,
        }),
      ),
    );

    const { res, status, json } = fakeRes();
    await route('POST', '/api/github/device-code').handle(fakeReq(''), res);

    expect(status()).toBe(200);
    expect(json()).toEqual({
      device_code: 'abc',
      user_code: 'WDJB-MJHT',
      verification_uri: 'https://github.com/login/device',
      expires_in: 900,
      interval: 5,
    });
  });
});

describe('POST /api/github/device-token', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects a request with no device_code', async () => {
    const { res, status } = fakeRes();
    await route('POST', '/api/github/device-token').handle(fakeReq(JSON.stringify({})), res);
    expect(status()).toBe(400);
  });

  it('proxies GitHub’s slow_down response, interval included, straight back', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(200, { error: 'slow_down', interval: 10 })),
    );

    const { res, status, json } = fakeRes();
    await route('POST', '/api/github/device-token').handle(
      fakeReq(JSON.stringify({ device_code: 'abc' })),
      res,
    );

    expect(status()).toBe(200);
    expect(json()).toEqual({ error: 'slow_down', interval: 10 });
  });

  it('proxies an approved token response straight back', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse(200, { access_token: 'ghu_xyz', token_type: 'bearer', scope: '' }),
        ),
    );

    const { res, status, json } = fakeRes();
    await route('POST', '/api/github/device-token').handle(
      fakeReq(JSON.stringify({ device_code: 'abc' })),
      res,
    );

    expect(status()).toBe(200);
    expect(json()).toEqual({ access_token: 'ghu_xyz', token_type: 'bearer', scope: '' });
  });
});
