import { describe, expect, it, vi } from 'vitest';
import { lastRouteFor, rememberRoute } from './last-route-store';

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

const exists = () => true;
const missing = () => false;

describe('rememberRoute / lastRouteFor', () => {
  it('is null with nothing stored', () => {
    expect(lastRouteFor('http://localhost:4333', createStorage(), exists)).toBeNull();
  });

  it('works without a storage backend', () => {
    expect(() => rememberRoute('http://localhost:4333', '/log', null)).not.toThrow();
    expect(lastRouteFor('http://localhost:4333', null, exists)).toBeNull();
  });

  it('recalls the last route written under a runtime URL', () => {
    const storage = createStorage();
    rememberRoute('http://localhost:4333', '/log', storage);
    expect(lastRouteFor('http://localhost:4333', storage, exists)).toBe('/log');
  });

  it('keeps two projects apart, keyed by runtime URL', () => {
    const storage = createStorage();
    rememberRoute('http://localhost:4333', '/log', storage);
    rememberRoute('http://localhost:5000', '/settings/setup', storage);
    expect(lastRouteFor('http://localhost:4333', storage, exists)).toBe('/log');
    expect(lastRouteFor('http://localhost:5000', storage, exists)).toBe('/settings/setup');
  });

  it('overwrites the previous route on every write, not just the first', () => {
    const storage = createStorage();
    rememberRoute('http://localhost:4333', '/log', storage);
    rememberRoute('http://localhost:4333', '/settings/setup', storage);
    expect(lastRouteFor('http://localhost:4333', storage, exists)).toBe('/settings/setup');
  });

  it('treats a stored "/" as nothing to redirect to, since that is already the default', () => {
    const storage = createStorage();
    rememberRoute('http://localhost:4333', '/', storage);
    expect(lastRouteFor('http://localhost:4333', storage, exists)).toBeNull();
  });

  it('clears and returns null for a route that no longer exists', () => {
    const storage = createStorage();
    rememberRoute('http://localhost:4333', '/removed-route', storage);
    expect(lastRouteFor('http://localhost:4333', storage, missing)).toBeNull();
    expect(lastRouteFor('http://localhost:4333', storage, exists)).toBeNull();
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

    expect(() => rememberRoute('http://localhost:4333', '/log', throwing)).not.toThrow();
    expect(lastRouteFor('http://localhost:4333', throwing, exists)).toBeNull();
  });
});
