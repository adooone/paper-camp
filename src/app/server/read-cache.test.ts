import { afterEach, describe, expect, it, vi } from 'vitest';
import { READ_CACHE_TTL_MS, createReadCache } from './read-cache';

afterEach(() => vi.useRealTimers());

describe('createReadCache', () => {
  it('computes nothing until the first get', () => {
    const compute = vi.fn(async () => 1);
    createReadCache(compute);
    expect(compute).not.toHaveBeenCalled();
  });

  it('serves one compute to every get within the TTL', async () => {
    const compute = vi.fn(async () => 1);
    const cache = createReadCache(compute);
    await cache.get();
    expect(await cache.get()).toBe(1);
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('recomputes after five minutes', async () => {
    vi.useFakeTimers();
    let n = 0;
    const cache = createReadCache(async () => ++n);
    expect(await cache.get()).toBe(1);
    vi.advanceTimersByTime(READ_CACHE_TTL_MS - 1);
    expect(await cache.get()).toBe(1);
    vi.advanceTimersByTime(1);
    expect(await cache.get()).toBe(2);
  });

  it('recomputes after a drop', async () => {
    let n = 0;
    const cache = createReadCache(async () => ++n);
    await cache.get();
    cache.drop();
    expect(await cache.get()).toBe(2);
  });

  it('does not keep a failed compute', async () => {
    const compute = vi
      .fn<() => Promise<number>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue(2);
    const cache = createReadCache(compute);
    await expect(cache.get()).rejects.toThrow('boom');
    expect(await cache.get()).toBe(2);
  });

  it('keeps a compute that finishes after a drop out of the cache', async () => {
    const pending = Promise.withResolvers<number>();
    const compute = vi
      .fn<() => Promise<number>>()
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValue(2);
    const cache = createReadCache(compute);
    const first = cache.get();
    cache.drop();
    pending.resolve(1);
    expect(await first).toBe(1);
    expect(await cache.get()).toBe(2);
  });
});
