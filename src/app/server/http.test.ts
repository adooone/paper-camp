import type { ServerResponse } from 'node:http';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { sendJson } from './http';

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
