import { afterEach, describe, expect, it, vi } from 'vitest';
import { cachedProbe, clearProbesWithPrefix } from './probe-cache';

afterEach(() => {
  clearProbesWithPrefix('t:');
  vi.useRealTimers();
});

describe('cachedProbe', () => {
  it('awaits the load on the first call and shares a concurrent one', async () => {
    const load = vi.fn(async () => 1);
    const [a, b] = await Promise.all([
      cachedProbe('t:first', 1000, load),
      cachedProbe('t:first', 1000, load),
    ]);
    expect([a, b]).toEqual([1, 1]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('serves the stored value within the ttl without loading', async () => {
    const load = vi.fn(async () => 'v');
    await cachedProbe('t:ttl', 1000, load);
    await cachedProbe('t:ttl', 1000, load);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('returns the stale value at once and publishes a changed refresh', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    let n = 0;
    const load = vi.fn(async () => ++n);
    const onChange = vi.fn();
    await cachedProbe('t:swr', 1000, load, { onChange });
    vi.setSystemTime(Date.now() + 1001);
    expect(await cachedProbe('t:swr', 1000, load, { onChange })).toBe(1);
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith(2));
    expect(await cachedProbe('t:swr', 1000, load, { onChange })).toBe(2);
  });

  it('does not publish when the refreshed value is unchanged', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const load = vi.fn(async () => ({ a: 1 }));
    const onChange = vi.fn();
    await cachedProbe('t:same', 1000, load, { onChange });
    vi.setSystemTime(Date.now() + 1001);
    await cachedProbe('t:same', 1000, load, { onChange });
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('reloads synchronously when fresh is set', async () => {
    let n = 0;
    const load = vi.fn(async () => ++n);
    await cachedProbe('t:fresh', 60_000, load);
    expect(await cachedProbe('t:fresh', 60_000, load, { fresh: true })).toBe(2);
  });
});
