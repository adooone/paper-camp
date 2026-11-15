import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProjectStats } from '../../types/index';
import { createProjectStatsStore } from './project-stats';

const stats = (n: number) => ({ generatedAt: String(n) }) as unknown as ProjectStats;

afterEach(() => vi.useRealTimers());

describe('createProjectStatsStore', () => {
  it('computes on the first get and serves that result to every later get', async () => {
    const compute = vi.fn(async () => stats(1));
    const store = createProjectStatsStore('/r', compute);
    expect(compute).not.toHaveBeenCalled();
    await store.get();
    await store.get();
    expect(compute).toHaveBeenCalledTimes(1);
    store.close();
  });

  it('recomputes once after a burst of scheduled changes', async () => {
    vi.useFakeTimers();
    let n = 0;
    const compute = vi.fn(async () => stats(++n));
    const store = createProjectStatsStore('/r', compute, 100);
    await store.get();
    store.schedule();
    store.schedule();
    store.schedule();
    await vi.advanceTimersByTimeAsync(150);
    expect(compute).toHaveBeenCalledTimes(2);
    expect(await store.get()).toEqual(stats(2));
    store.close();
  });

  it('schedules nothing before the first get', async () => {
    vi.useFakeTimers();
    const compute = vi.fn(async () => stats(1));
    const store = createProjectStatsStore('/r', compute, 100);
    store.schedule();
    await vi.advanceTimersByTimeAsync(150);
    expect(compute).not.toHaveBeenCalled();
    store.close();
  });

  it('keeps serving the last value when a recompute fails', async () => {
    vi.useFakeTimers();
    const compute = vi
      .fn<(root: string) => Promise<ProjectStats>>()
      .mockResolvedValueOnce(stats(1))
      .mockRejectedValueOnce(new Error('boom'));
    const store = createProjectStatsStore('/r', compute, 100);
    await store.get();
    store.schedule();
    await vi.advanceTimersByTimeAsync(150);
    expect(await store.get()).toEqual(stats(1));
    store.close();
  });

  it('retries on get when the first compute failed', async () => {
    const compute = vi
      .fn<(root: string) => Promise<ProjectStats>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue(stats(2));
    const store = createProjectStatsStore('/r', compute);
    await expect(store.get()).rejects.toThrow('boom');
    expect(await store.get()).toEqual(stats(2));
    store.close();
  });
});
