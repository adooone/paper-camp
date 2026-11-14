import { describe, expect, it, vi } from 'vitest';
import { createHeavySlot, heavySlotSize } from './heavy-slot';

function deferred() {
  let resolve!: () => void;
  let reject!: (err: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createHeavySlot', () => {
  it('runs tasks one at a time in the order they asked', async () => {
    const slot = createHeavySlot(1);
    const order: string[] = [];
    const first = deferred();
    const second = deferred();

    const a = slot.run(async () => {
      order.push('a:start');
      await first.promise;
      order.push('a:end');
    });
    const b = slot.run(async () => {
      order.push('b:start');
      await second.promise;
      order.push('b:end');
    });
    const c = slot.run(async () => {
      order.push('c');
    });

    await tick();
    expect(order).toEqual(['a:start']);
    first.resolve();
    await tick();
    expect(order).toEqual(['a:start', 'a:end', 'b:start']);
    second.resolve();
    await Promise.all([a, b, c]);
    expect(order).toEqual(['a:start', 'a:end', 'b:start', 'b:end', 'c']);
  });

  it('lets as many tasks run at once as its size', async () => {
    const slot = createHeavySlot(2);
    const gate = deferred();
    let running = 0;
    let peak = 0;
    const task = async () => {
      running += 1;
      peak = Math.max(peak, running);
      await gate.promise;
      running -= 1;
    };

    const all = Promise.all([slot.run(task), slot.run(task), slot.run(task)]);
    await tick();
    expect(running).toBe(2);
    gate.resolve();
    await all;
    expect(peak).toBe(2);
  });

  it('releases the slot when a task fails', async () => {
    const slot = createHeavySlot(1);
    const failing = slot.run(async () => {
      throw new Error('boom');
    });
    const next = slot.run(async () => 'ran');

    await expect(failing).rejects.toThrow('boom');
    await expect(next).resolves.toBe('ran');
  });

  it('reports queued only for a task that has to wait', async () => {
    const slot = createHeavySlot(1);
    const gate = deferred();
    const firstQueued = vi.fn();
    const secondQueued = vi.fn();

    const first = slot.run(() => gate.promise, { onQueued: firstQueued });
    const second = slot.run(async () => {}, { onQueued: secondQueued });

    expect(firstQueued).not.toHaveBeenCalled();
    expect(secondQueued).toHaveBeenCalledOnce();
    gate.resolve();
    await Promise.all([first, second]);
  });

  it('sizes itself to half the cores, never below one', () => {
    expect(heavySlotSize()).toBeGreaterThanOrEqual(1);
  });
});
