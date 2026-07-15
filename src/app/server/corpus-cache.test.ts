import { describe, expect, it } from 'vitest';
import { cached, invalidateCorpusCache } from './corpus-cache';

describe('corpus-cache', () => {
  it('serves the same promise for a repeat key without calling load again', async () => {
    let calls = 0;
    const load = async () => {
      calls++;
      return calls;
    };
    expect(await cached('k', load)).toBe(1);
    expect(await cached('k', load)).toBe(1);
    expect(calls).toBe(1);
  });

  it('reloads after invalidateCorpusCache clears the cache', async () => {
    let calls = 0;
    const load = async () => {
      calls++;
      return calls;
    };
    expect(await cached('k2', load)).toBe(1);
    invalidateCorpusCache();
    expect(await cached('k2', load)).toBe(2);
  });

  it('does not cache a failed load, so the next call retries', async () => {
    let calls = 0;
    const load = async () => {
      calls++;
      if (calls === 1) throw new Error('boom');
      return calls;
    };
    await expect(cached('k3', load)).rejects.toThrow('boom');
    expect(await cached('k3', load)).toBe(2);
  });

  it('keys are independent, so two different keys don’t collide', async () => {
    expect(await cached('a', async () => 'A')).toBe('A');
    expect(await cached('b', async () => 'B')).toBe('B');
  });
});
