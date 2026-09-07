import { describe, expect, it, vi } from 'vitest';
import { type LazyPageEnv, importWithRecovery } from './lazy-page';

const memoryStorage = () => {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
};

const env = (): LazyPageEnv & { reload: ReturnType<typeof vi.fn> } => ({
  wait: async () => {},
  reload: vi.fn(),
  storage: memoryStorage(),
});

describe('importWithRecovery', () => {
  it('returns the module when the import succeeds', async () => {
    const e = env();
    await expect(importWithRecovery('log', async () => 'mod', e)).resolves.toBe('mod');
    expect(e.reload).not.toHaveBeenCalled();
  });

  it('retries once and returns the module when the retry succeeds', async () => {
    const e = env();
    const importer = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('Failed to fetch dynamically imported module'))
      .mockResolvedValueOnce('mod');
    await expect(importWithRecovery('log', importer, e)).resolves.toBe('mod');
    expect(importer).toHaveBeenCalledTimes(2);
    expect(e.reload).not.toHaveBeenCalled();
  });

  it('reloads the page once when both attempts fail, and never resolves', async () => {
    const e = env();
    const importer = async () => {
      throw new Error('Failed to fetch dynamically imported module');
    };
    const pending = importWithRecovery('log', importer, e);
    const outcome = await Promise.race([
      pending.then(() => 'resolved'),
      new Promise((resolve) => setTimeout(() => resolve('pending'), 20)),
    ]);
    expect(outcome).toBe('pending');
    expect(e.reload).toHaveBeenCalledTimes(1);
    expect(e.storage?.getItem('papercamp:chunk-reloaded:log')).toBe('1');
  });

  it('rethrows instead of reloading again after a reload already happened', async () => {
    const e = env();
    e.storage?.setItem('papercamp:chunk-reloaded:log', '1');
    const importer = async () => {
      throw new Error('still failing');
    };
    await expect(importWithRecovery('log', importer, e)).rejects.toThrow('still failing');
    expect(e.reload).not.toHaveBeenCalled();
  });

  it('clears the reload flag once the chunk loads again', async () => {
    const e = env();
    e.storage?.setItem('papercamp:chunk-reloaded:log', '1');
    await importWithRecovery('log', async () => 'mod', e);
    expect(e.storage?.getItem('papercamp:chunk-reloaded:log')).toBeNull();
  });
});
