import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ProjectStats } from '../../types/index';
import { createProjectStatsStore } from './project-stats';

const stats = (n: number) => ({ generatedAt: String(n) }) as unknown as ProjectStats;

afterEach(() => vi.useRealTimers());

describe('createProjectStatsStore', () => {
  it('computes once at creation and serves the result to every get', async () => {
    const compute = vi.fn(async () => stats(1));
    const store = createProjectStatsStore('/r', compute);
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

  it('retries on get when the first compute failed', async () => {
    const compute = vi
      .fn<(root: string) => Promise<ProjectStats>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue(stats(2));
    const store = createProjectStatsStore('/r', compute);
    await new Promise((r) => setTimeout(r, 0));
    expect(await store.get()).toEqual(stats(2));
    store.close();
  });
});
