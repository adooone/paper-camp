import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { probeReachable } from './runtime-slice';

describe('probeReachable', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // A fresh --share tunnel, or pairing that landed a moment ago, can leave the very
  // first probe finding nothing — this is the resilience that used to be a single
  // unretried fetch away from a permanent "unreachable" verdict.
  it('succeeds on the first attempt without retrying', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await expect(probeReachable()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries after a failed response and succeeds on the second attempt', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const result = probeReachable();
    await vi.runAllTimersAsync();

    await expect(result).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries after a thrown error, not just a non-ok response', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const result = probeReachable();
    await vi.runAllTimersAsync();

    await expect(result).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up as unreachable once every attempt has failed', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', fetchMock);

    const result = probeReachable();
    await vi.runAllTimersAsync();

    await expect(result).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
