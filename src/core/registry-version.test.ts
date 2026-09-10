import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkLatestVersion, isVersionNewer } from './registry-version';

describe('isVersionNewer', () => {
  it('is true when the candidate is ahead', () => {
    expect(isVersionNewer('0.29.1', '0.29.0')).toBe(true);
    expect(isVersionNewer('0.30.0', '0.29.9')).toBe(true);
    expect(isVersionNewer('1.0.0', '0.29.9')).toBe(true);
  });

  it('is false when the candidate is equal or behind', () => {
    expect(isVersionNewer('0.29.0', '0.29.0')).toBe(false);
    expect(isVersionNewer('0.28.4', '0.29.0')).toBe(false);
  });
});

describe('checkLatestVersion', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches the latest dist-tag and compares it to the current version', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe('https://registry.npmjs.org/@dendelion/paper-camp/latest');
      return { ok: true, json: async () => ({ version: '0.29.1' }) };
    });
    vi.stubGlobal('fetch', fetchMock);

    expect(await checkLatestVersion('0.28.4')).toEqual({
      currentVersion: '0.28.4',
      latestVersion: '0.29.1',
      isNewer: true,
    });
  });

  it('reports isNewer as false when already on the latest version', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ version: '0.29.1' }) })),
    );

    expect(await checkLatestVersion('0.29.1')).toEqual({
      currentVersion: '0.29.1',
      latestVersion: '0.29.1',
      isNewer: false,
    });
  });

  it('resolves null when the registry answers with a non-2xx status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false })),
    );

    expect(await checkLatestVersion('0.28.4')).toBeNull();
  });

  it('resolves null when the response has no version field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({}) })),
    );

    expect(await checkLatestVersion('0.28.4')).toBeNull();
  });

  it('resolves null when the fetch throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );

    expect(await checkLatestVersion('0.28.4')).toBeNull();
  });
});
