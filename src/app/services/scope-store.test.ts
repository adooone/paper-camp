import { describe, expect, it, vi } from 'vitest';
import { lastScopeFor, rememberScope } from './scope-store';

function createStorage(seed: Record<string, string> = {}): Storage {
  const data = new Map<string, string>(Object.entries(seed));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
    clear: () => data.clear(),
    key: (index) => Array.from(data.keys())[index] ?? null,
    get length() {
      return data.size;
    },
  };
}

describe('rememberScope / lastScopeFor', () => {
  it('is empty with nothing stored', () => {
    expect(lastScopeFor('http://localhost:4333', createStorage())).toEqual([]);
  });

  it('works without a storage backend', () => {
    expect(() => rememberScope('http://localhost:4333', ['paper-ui@deimos'], null)).not.toThrow();
    expect(lastScopeFor('http://localhost:4333', null)).toEqual([]);
  });

  it('recalls the scope written under a runtime URL', () => {
    const storage = createStorage();
    rememberScope('http://localhost:4333', ['paper-camp@deimos', 'paper-ui@deimos'], storage);
    expect(lastScopeFor('http://localhost:4333', storage)).toEqual([
      'paper-camp@deimos',
      'paper-ui@deimos',
    ]);
  });

  it('keeps two projects apart, keyed by runtime URL', () => {
    const storage = createStorage();
    rememberScope('http://localhost:4333', ['paper-ui@deimos'], storage);
    rememberScope('http://localhost:5000', ['paper-camp@deimos'], storage);
    expect(lastScopeFor('http://localhost:4333', storage)).toEqual(['paper-ui@deimos']);
    expect(lastScopeFor('http://localhost:5000', storage)).toEqual(['paper-camp@deimos']);
  });

  it('clears the stored entry when remembering an empty scope', () => {
    const storage = createStorage();
    rememberScope('http://localhost:4333', ['paper-ui@deimos'], storage);
    rememberScope('http://localhost:4333', [], storage);
    expect(lastScopeFor('http://localhost:4333', storage)).toEqual([]);
  });

  it('never throws when storage access itself throws (e.g. private browsing)', () => {
    const throwing = {
      getItem: vi.fn(() => {
        throw new Error('blocked');
      }),
      setItem: vi.fn(() => {
        throw new Error('blocked');
      }),
      removeItem: vi.fn(() => {
        throw new Error('blocked');
      }),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    } as unknown as Storage;

    expect(() =>
      rememberScope('http://localhost:4333', ['paper-ui@deimos'], throwing),
    ).not.toThrow();
    expect(lastScopeFor('http://localhost:4333', throwing)).toEqual([]);
  });
});
