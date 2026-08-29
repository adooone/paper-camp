import { describe, expect, it } from 'vitest';
import { addHubRepo, listHubRepos, removeHubRepo } from './hub-repo-store';

function createStorage(): Storage {
  const data = new Map<string, string>();
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

describe('listHubRepos', () => {
  it('is empty with no persisted repos', () => {
    expect(listHubRepos(createStorage())).toEqual([]);
  });

  it('works without a storage backend', () => {
    expect(listHubRepos(null)).toEqual([]);
  });
});

describe('addHubRepo', () => {
  it('adds a repo to the working set', () => {
    const storage = createStorage();
    expect(addHubRepo('croco-dendy/paper-camp', storage)).toEqual(['croco-dendy/paper-camp']);
    expect(listHubRepos(storage)).toEqual(['croco-dendy/paper-camp']);
  });

  it('keeps every repo chosen rather than the last one only', () => {
    const storage = createStorage();
    addHubRepo('croco-dendy/paper-camp', storage);
    addHubRepo('croco-dendy/paper-ui', storage);
    expect(listHubRepos(storage)).toEqual(['croco-dendy/paper-camp', 'croco-dendy/paper-ui']);
  });

  it('does not duplicate a repo already chosen', () => {
    const storage = createStorage();
    addHubRepo('croco-dendy/paper-camp', storage);
    addHubRepo('croco-dendy/paper-camp', storage);
    expect(listHubRepos(storage)).toEqual(['croco-dendy/paper-camp']);
  });

  it('works without a storage backend', () => {
    expect(() => addHubRepo('croco-dendy/paper-camp', null)).not.toThrow();
  });
});

describe('removeHubRepo', () => {
  it('forgets a chosen repo', () => {
    const storage = createStorage();
    addHubRepo('croco-dendy/paper-camp', storage);
    addHubRepo('croco-dendy/paper-ui', storage);
    expect(removeHubRepo('croco-dendy/paper-camp', storage)).toEqual(['croco-dendy/paper-ui']);
    expect(listHubRepos(storage)).toEqual(['croco-dendy/paper-ui']);
  });

  it('is a no-op for a repo that was never chosen', () => {
    const storage = createStorage();
    addHubRepo('croco-dendy/paper-camp', storage);
    expect(removeHubRepo('croco-dendy/paper-ui', storage)).toEqual(['croco-dendy/paper-camp']);
  });

  it('works without a storage backend', () => {
    expect(() => removeHubRepo('croco-dendy/paper-camp', null)).not.toThrow();
  });
});
