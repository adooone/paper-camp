import { afterEach, describe, expect, it, vi } from 'vitest';
import { githubClientId, requestDeviceCode, requestDeviceToken } from './device-flow';

describe('githubClientId', () => {
  afterEach(() => {
    Reflect.deleteProperty(process.env, 'PAPERCAMP_GITHUB_CLIENT_ID');
  });

  it('defaults to the Paper Scout app client id', () => {
    expect(githubClientId()).toBe('Iv23ligLF1oQlhORSdew');
  });

  it('is overridable for a fork running its own GitHub App', () => {
    process.env.PAPERCAMP_GITHUB_CLIENT_ID = 'Iv23liExampleForkId';
    expect(githubClientId()).toBe('Iv23liExampleForkId');
  });

  it('falls back to the default when the override is blank', () => {
    process.env.PAPERCAMP_GITHUB_CLIENT_ID = '   ';
    expect(githubClientId()).toBe('Iv23ligLF1oQlhORSdew');
  });
});

function jsonResponse(status: number, body: unknown): Response {
  return { status, json: async () => body } as Response;
}

describe('requestDeviceCode', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the client id to the device code endpoint and returns GitHub’s body verbatim', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        device_code: 'abc',
        user_code: 'WDJB-MJHT',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900,
        interval: 5,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { status, body } = await requestDeviceCode();

    expect(status).toBe(200);
    expect(body).toEqual({
      device_code: 'abc',
      user_code: 'WDJB-MJHT',
      verification_uri: 'https://github.com/login/device',
      expires_in: 900,
      interval: 5,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://github.com/login/device/code');
    expect(JSON.parse(init.body as string)).toEqual({ client_id: 'Iv23ligLF1oQlhORSdew' });
  });
});

describe('requestDeviceToken', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the device code to the token endpoint and returns GitHub’s body verbatim', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { error: 'authorization_pending' }));
    vi.stubGlobal('fetch', fetchMock);

    const { status, body } = await requestDeviceToken('device123');

    expect(status).toBe(200);
    expect(body).toEqual({ error: 'authorization_pending' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://github.com/login/oauth/access_token');
    expect(JSON.parse(init.body as string)).toEqual({
      client_id: 'Iv23ligLF1oQlhORSdew',
      device_code: 'device123',
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    });
  });

  it('passes through a slow_down response, interval included, for the caller to honour', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(200, { error: 'slow_down', interval: 10 })),
    );

    const { body } = await requestDeviceToken('device123');

    expect(body).toEqual({ error: 'slow_down', interval: 10 });
  });
});
