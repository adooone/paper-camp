import { describe, expect, it } from 'vitest';
import { cached, corpusFingerprint, invalidateCorpusCache } from './corpus-cache';

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

  it('does not cache a result the caller marks uncacheable, so the next call retries', async () => {
    let calls = 0;
    const load = async () => {
      calls++;
      return calls;
    };
    expect(await cached('k4', load, (value) => value > 1)).toBe(1);
    expect(await cached('k4', load, (value) => value > 1)).toBe(2);
  });

  it('caches a result once it is marked cacheable', async () => {
    let calls = 0;
    const load = async () => {
      calls++;
      return calls;
    };
    expect(await cached('k5', load, () => true)).toBe(1);
    expect(await cached('k5', load, () => true)).toBe(1);
    expect(calls).toBe(1);
  });
});

describe('corpus-cache fingerprint', () => {
  it('reloads when the fingerprint changes between reads, and not otherwise', async () => {
    invalidateCorpusCache();
    let stamp = 'a';
    let calls = 0;
    const load = async () => ++calls;
    const fingerprint = async () => stamp;
    expect(await cached('fp', load, () => true, fingerprint)).toBe(1);
    expect(await cached('fp', load, () => true, fingerprint)).toBe(1);
    stamp = 'b';
    expect(await cached('fp', load, () => true, fingerprint)).toBe(2);
    expect(await cached('fp', load, () => true, fingerprint)).toBe(2);
  });

  it('fingerprints the ideas files, their archive and run-order.md', async () => {
    const { mkdtemp, writeFile, mkdir, utimes } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const root = await mkdtemp(join(tmpdir(), 'corpus-fp-'));
    const ideas = join(root, 'ideas');
    await mkdir(join(ideas, 'archive'), { recursive: true });
    await writeFile(join(ideas, 'IDEA-1.md'), 'one');
    const before = await corpusFingerprint(ideas);
    expect(await corpusFingerprint(ideas)).toBe(before);
    await writeFile(join(ideas, 'IDEA-2.md'), 'two');
    const added = await corpusFingerprint(ideas);
    expect(added).not.toBe(before);
    await writeFile(join(ideas, 'IDEA-2.md'), 'two, longer');
    await utimes(join(ideas, 'IDEA-2.md'), new Date(), new Date(Date.now() + 5000));
    expect(await corpusFingerprint(ideas)).not.toBe(added);
  });
});
