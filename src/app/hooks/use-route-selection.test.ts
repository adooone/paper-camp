import type { IdeaEntry, PlanEntry } from '@/types/index';
import { describe, expect, it } from 'vitest';
import { resolveByIdOrTitle } from './use-route-selection';

const plan = (overrides: Partial<PlanEntry>): PlanEntry => ({
  title: 'Untitled',
  status: 'planned',
  created: '2026-01-01',
  tags: [],
  body: '',
  phases: [],
  ...overrides,
});

const idea = (overrides: Partial<IdeaEntry>): IdeaEntry => ({
  id: null,
  title: 'Untitled idea',
  body: '',
  ...overrides,
});

describe('resolveByIdOrTitle', () => {
  it('matches by id when present', () => {
    const entries = [plan({ id: '146', title: 'Route plans and ideas by id' })];
    expect(resolveByIdOrTitle(entries, '146')?.title).toBe('Route plans and ideas by id');
  });

  it('falls back to title for an id-less entry', () => {
    const entries = [plan({ id: undefined, title: 'Deliver lives in the idea view' })];
    expect(resolveByIdOrTitle(entries, 'Deliver lives in the idea view')?.title).toBe(
      'Deliver lives in the idea view',
    );
  });

  it('does not fall back to title for an entry that has an id', () => {
    const entries = [plan({ id: '146', title: 'Route plans and ideas by id' })];
    expect(resolveByIdOrTitle(entries, 'Route plans and ideas by id')).toBeNull();
  });

  it('works for id-less idea entries too', () => {
    const entries = [idea({ id: null, title: 'A legacy note' })];
    expect(resolveByIdOrTitle(entries, 'A legacy note')?.title).toBe('A legacy note');
  });

  it('returns null when nothing matches', () => {
    const entries = [plan({ id: '146', title: 'Route plans and ideas by id' })];
    expect(resolveByIdOrTitle(entries, '999')).toBeNull();
  });
});
