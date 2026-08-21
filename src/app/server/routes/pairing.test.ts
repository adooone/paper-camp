import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it } from 'vitest';
import { createPairingManager } from '../pairing';
import { pairingRoutes } from './pairing';
import type { RouteContext } from './types';

function route(pairing: RouteContext['pairing']) {
  const found = pairingRoutes({ pairing } as RouteContext).find(
    (r) => r.path === '/api/pair' && r.method === 'POST',
  );
  if (!found) throw new Error('no route registered for POST /api/pair');
  return found;
}

function fakeReq(body: string, origin: string | undefined): IncomingMessage {
  const req = {
    headers: { origin },
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

describe('POST /api/pair', () => {
  it('pairs the request Origin when the token matches', async () => {
    const pairing = createPairingManager();
    const { res, status, json } = fakeRes();
    await route(pairing).handle(
      fakeReq(JSON.stringify({ token: pairing.token }), 'https://app.papercamp.dev'),
      res,
    );
    expect(status()).toBe(200);
    expect(json()).toEqual({ paired: true, origin: 'https://app.papercamp.dev' });
    expect(pairing.isPairedOrigin('https://app.papercamp.dev')).toBe(true);
  });

  it('rejects a wrong token with 403', async () => {
    const pairing = createPairingManager();
    const { res, status } = fakeRes();
    await route(pairing).handle(
      fakeReq(JSON.stringify({ token: 'wrong' }), 'https://app.papercamp.dev'),
      res,
    );
    expect(status()).toBe(403);
    expect(pairing.isPairedOrigin('https://app.papercamp.dev')).toBe(false);
  });

  it('rejects a request with no Origin header — there is nothing to pair', async () => {
    const pairing = createPairingManager();
    const { res, status } = fakeRes();
    await route(pairing).handle(fakeReq(JSON.stringify({ token: pairing.token }), undefined), res);
    expect(status()).toBe(400);
  });
});
