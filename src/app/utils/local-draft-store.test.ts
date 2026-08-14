import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readLocalDraft, removeLocalDraft, writeLocalDraft } from './local-draft-store';

class FakeLocalStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }
}

describe('local-draft-store', () => {
  let fake: FakeLocalStorage;

  beforeEach(() => {
    fake = new FakeLocalStorage();
    vi.stubGlobal('localStorage', fake);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('returns null when nothing is stored', () => {
    expect(readLocalDraft('missing')).toBeNull();
  });

  it('round-trips a written value', () => {
    writeLocalDraft('key', { title: 'hello' });
    expect(readLocalDraft('key')).toEqual({ title: 'hello' });
  });

  it('removes a stored value', () => {
    writeLocalDraft('key', 'value');
    removeLocalDraft('key');
    expect(readLocalDraft('key')).toBeNull();
  });

  it('drops entries past the staleness cap on read', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    writeLocalDraft('key', 'value');

    vi.setSystemTime(14 * 24 * 60 * 60 * 1000 + 1);
    expect(readLocalDraft('key')).toBeNull();
    expect(fake.getItem('key')).toBeNull();
  });

  it('keeps entries within the staleness cap', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    writeLocalDraft('key', 'value');

    vi.setSystemTime(14 * 24 * 60 * 60 * 1000 - 1);
    expect(readLocalDraft('key')).toBe('value');
  });

  it('degrades to in-memory when localStorage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('unavailable');
      },
      setItem: () => {
        throw new Error('unavailable');
      },
      removeItem: () => {
        throw new Error('unavailable');
      },
    });

    expect(() => writeLocalDraft('key', 'value')).not.toThrow();
    expect(() => removeLocalDraft('key')).not.toThrow();
    expect(readLocalDraft('key')).toBeNull();
  });
});
