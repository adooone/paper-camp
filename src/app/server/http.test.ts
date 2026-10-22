import type { IncomingMessage, ServerResponse } from 'node:http';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { HttpError, readJson, sendJson } from './http';

function fakeReq(body: string): IncomingMessage {
  const listeners: Record<string, (chunk?: string) => void> = {};
  const req = {
    on(event: string, cb: (chunk?: string) => void) {
      listeners[event] = cb;
      return req;
    },
  } as unknown as IncomingMessage;
  queueMicrotask(() => {
    listeners.data?.(body);
    listeners.end?.();
  });
  return req;
}

function mockResponse(acceptEncoding: string | undefined) {
  const headers: Record<string, string> = {};
  const end = vi.fn();
  const res = {
    statusCode: 0,
    setHeader: (name: string, value: string) => {
      headers[name] = value;
    },
    end,
    req: { headers: { 'accept-encoding': acceptEncoding } },
  } as unknown as ServerResponse;
  return { res, headers, end };
}

describe('sendJson', () => {
  it('sends the raw body when the client does not accept gzip', () => {
    const { res, headers, end } = mockResponse(undefined);
    const data = { items: Array.from({ length: 200 }, (_, i) => `row-${i}`) };
    sendJson(res, 200, data);
    expect(headers['Content-Encoding']).toBeUndefined();
    expect(end).toHaveBeenCalledWith(JSON.stringify(data));
  });

  it('sends the raw body when under the gzip threshold', () => {
    const { res, headers, end } = mockResponse('gzip, deflate');
    const data = { ok: true };
    sendJson(res, 200, data);
    expect(headers['Content-Encoding']).toBeUndefined();
    expect(end).toHaveBeenCalledWith(JSON.stringify(data));
  });

  it('gzips bodies over 1 KB when the client accepts gzip', async () => {
    const { res, headers, end } = mockResponse('gzip, deflate, br');
    const data = { items: Array.from({ length: 200 }, (_, i) => `row-${i}`) };
    const body = JSON.stringify(data);
    sendJson(res, 200, data);
    await vi.waitFor(() => expect(end).toHaveBeenCalled());
    expect(headers['Content-Encoding']).toBe('gzip');
    expect(headers.Vary).toBe('Accept-Encoding');
    const sent = end.mock.calls[0][0] as Buffer;
    expect(gunzipSync(sent).toString()).toBe(body);
  });
});

describe('readJson', () => {
  it('parses a JSON body', async () => {
    await expect(readJson(fakeReq(JSON.stringify({ a: 1 })))).resolves.toEqual({ a: 1 });
  });

  it('resolves undefined for an empty body', async () => {
    await expect(readJson(fakeReq(''))).resolves.toBeUndefined();
  });

  it('throws an HttpError(400) for a malformed, non-empty body', async () => {
    const error = await readJson(fakeReq('{not json')).catch((e) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(400);
  });
});
