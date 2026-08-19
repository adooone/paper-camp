import type { EntityEntry } from '@/types/index';
import { describe, expect, it } from 'vitest';
import { checkStaleBaseForRunAll, entityFileInput } from './helpers';

describe('entityFileInput', () => {
  it('carries unknownFrontmatter through so routine writes never drop it', () => {
    const entry: EntityEntry = {
      id: 'IDEA-1',
      title: 'Test',
      created: '2026-08-19',
      tags: [],
      body: '',
      phases: [],
      unknownFrontmatter: { formatVersion: 2 },
    };
    expect(entityFileInput(entry).unknownFrontmatter).toEqual({ formatVersion: 2 });
    expect(entityFileInput(entry, { status: 'done' }).unknownFrontmatter).toEqual({
      formatVersion: 2,
    });
  });
});

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
