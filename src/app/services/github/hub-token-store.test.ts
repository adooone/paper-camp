import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearHubGithubToken, readHubGithubToken, writeHubGithubToken } from './hub-token-store';

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

describe('github hub-token-store', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', new FakeLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when nothing is stored', () => {
    expect(readHubGithubToken()).toBeNull();
  });

  it('round-trips a written token', () => {
    writeHubGithubToken('ghp_x');
    expect(readHubGithubToken()).toBe('ghp_x');
  });

  it('clears a stored token', () => {
    writeHubGithubToken('ghp_x');
    clearHubGithubToken();
    expect(readHubGithubToken()).toBeNull();
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
    expect(() => writeHubGithubToken('ghp_x')).not.toThrow();
    expect(readHubGithubToken()).toBeNull();
  });
});
