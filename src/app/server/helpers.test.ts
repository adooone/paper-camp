import { describe, expect, it } from 'vitest';
import { checkStaleBaseForRunAll } from './helpers';

describe('checkStaleBaseForRunAll', () => {
  it('returns null when the base is not stale', async () => {
    const git = { findStaleBaseRef: async () => null };
    expect(await checkStaleBaseForRunAll(git, 'IDEA-137')).toBeNull();
  });

  it('names the plan, the offending ref, and its count when stale', async () => {
    const git = {
      findStaleBaseRef: async () => ({ ref: 'main', done: 4, total: 4 }),
    };
    const message = await checkStaleBaseForRunAll(git, 'IDEA-137');
    expect(message).toContain('IDEA-137');
    expect(message).toContain('4/4');
    expect(message).toContain('main');
    expect(message).toMatch(/rebase or switch branches/i);
  });
});
