import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearGithubConfig, readGithubConfig, writeGithubConfig } from './config-store';

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

describe('github config-store', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new FakeLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when nothing is stored', () => {
    expect(readGithubConfig()).toBeNull();
  });

  it('round-trips a written config', () => {
    writeGithubConfig({ owner: 'acme', repo: 'widgets', token: 'ghp_x' });
    expect(readGithubConfig()).toEqual({ owner: 'acme', repo: 'widgets', token: 'ghp_x' });
  });

  it('clears a stored config', () => {
    writeGithubConfig({ owner: 'acme', repo: 'widgets', token: 'ghp_x' });
    clearGithubConfig();
    expect(readGithubConfig()).toBeNull();
  });

  it('treats a partial stored config as absent', () => {
    localStorage.setItem('papercamp:github-corpus', JSON.stringify({ owner: 'acme' }));
    expect(readGithubConfig()).toBeNull();
  });

  it('degrades to null when localStorage throws', () => {
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
    expect(() => writeGithubConfig({ owner: 'a', repo: 'b', token: 'c' })).not.toThrow();
    expect(readGithubConfig()).toBeNull();
  });
});
