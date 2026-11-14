import { availableParallelism } from 'node:os';

interface HeavySlotRunOptions {
  onQueued?: () => void;
}

export interface HeavySlot {
  run<T>(task: () => Promise<T>, options?: HeavySlotRunOptions): Promise<T>;
}

export const heavySlotSize = (): number => Math.max(1, Math.floor(availableParallelism() / 2));

export function createHeavySlot(size: number = heavySlotSize()): HeavySlot {
  let active = 0;
  const waiting: (() => void)[] = [];

  function acquire(onQueued?: () => void): Promise<void> {
    if (active < size) {
      active += 1;
      return Promise.resolve();
    }
    onQueued?.();
    return new Promise((resolve) => waiting.push(resolve));
  }

  function release(): void {
    const next = waiting.shift();
    if (next) next();
    else active -= 1;
  }

  return {
    async run(task, options = {}) {
      await acquire(options.onQueued);
      try {
        return await task();
      } finally {
        release();
      }
    },
  };
}
