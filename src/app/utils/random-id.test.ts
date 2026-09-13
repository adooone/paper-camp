import { describe, expect, it, vi } from 'vitest';
import { randomId } from './random-id';

describe('randomId', () => {
  it('returns distinct ids', () => {
    expect(randomId()).not.toBe(randomId());
  });

  it('falls back to getRandomValues when randomUUID is missing, as over plain http', () => {
    const original = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: original.getRandomValues.bind(original) });
    try {
      expect(randomId()).toMatch(/^[0-9a-f]{32}$/);
    } finally {
      vi.stubGlobal('crypto', original);
    }
  });
});
